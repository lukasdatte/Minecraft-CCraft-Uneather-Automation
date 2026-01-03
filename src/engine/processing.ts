import { Result, ok, okNoop, err } from "../core/result";
import { Logger } from "../core/logger";
import { Scanner } from "./scanner";
import {
    AppConfig,
    ProcessingResult,
    InventoryItemInfo,
    STACK_SIZE,
} from "../types";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Engine for material processing (hammer chain: Cobblestone → Dirt → Gravel → Sand → Dust).
 */
export class ProcessingEngine {
    constructor(
        private scanner: Scanner,
        private log: Logger,
    ) {}

    /**
     * Run the complete processing phase.
     * This is the main entry point called from main.ts.
     */
    runPhase(
        config: AppConfig,
        materialSource: InventoryPeripheral,
        processingChest: InventoryPeripheral | undefined,
        processingChestName: string | undefined,
    ): Result<ProcessingResult[]> {
        // Guard: Check if processing is configured
        if (!config.processing || !config.processing.enabled) {
            return okNoop([]);
        }

        // Guard: Check if processing chest is available
        if (!processingChest || !processingChestName) {
            this.log.warn("Processing enabled but processing chest not available");
            return err("ERR_PROCESSING_CHEST_MISSING");
        }

        this.log.debug("Starting processing phase...");

        const results = this.processAllMaterials(
            config,
            materialSource,
            processingChest,
            processingChestName,
        );

        if (results.length > 0) {
            this.log.info("Processing phase complete", { transfers: results.length });
        } else {
            this.log.debug("Processing phase complete (no transfers)");
        }

        return ok(results);
    }

    // ========================================
    // Private methods
    // ========================================

    /**
     * Process all eligible materials in the chain.
     */
    private processAllMaterials(
        config: AppConfig,
        materialSource: InventoryPeripheral,
        processingChest: InventoryPeripheral,
        processingChestName: string,
    ): ProcessingResult[] {
        const results: ProcessingResult[] = [];
        const processing = config.processing;

        // Guard: processing must be configured and enabled
        if (!processing || !processing.enabled) {
            this.log.debug("Processing disabled or not configured");
            return results;
        }

        // Get current inventory state via Scanner
        const inventoryRes = this.scanner.getInventoryContents(materialSource);
        if (!inventoryRes.ok) {
            this.log.warn("Failed to get inventory contents for processing");
            return results;
        }
        const inventoryContents = inventoryRes.value;

        // Get processing chest contents once (reused for all materials)
        const chestContents = processingChest.list();

        // Process each mapping in the chain
        for (const [inputItemId, outputItemId] of Object.entries(processing.chain)) {
            // Check if processing chest has space
            if (!this.hasAvailableSpace(processingChest)) {
                this.log.debug("Processing chest full, skipping remaining chain");
                break;
            }

            // Check if processing chest already contains this input material
            let alreadyInChest = false;
            for (const [, item] of pairs(chestContents)) {
                if (item && item.name === inputItemId) {
                    alreadyInChest = true;
                    break;
                }
            }
            if (alreadyInChest) {
                this.log.debug("Processing chest already contains input material", {
                    input: inputItemId,
                });
                continue;
            }

            // Check if this material should be processed
            const shouldRes = this.shouldProcess(
                config,
                inventoryContents,
                inputItemId,
                outputItemId,
            );

            if (!shouldRes.ok) {
                // Not an error - just skip this material
                continue;
            }

            // Perform the transfer
            const transferRes = this.transferToProcessing(
                materialSource,
                processingChestName,
                inputItemId,
                outputItemId,
                shouldRes.value.sourceSlot,
            );

            if (transferRes.ok) {
                results.push(transferRes.value);

                // Update local inventory tracking to reflect transfer
                const inputInfo = inventoryContents.get(inputItemId);
                if (inputInfo) {
                    inputInfo.totalCount -= transferRes.value.itemsTransferred;
                    if (inputInfo.totalCount <= 0) {
                        inventoryContents.delete(inputItemId);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Check if processing chest has available space.
     */
    private hasAvailableSpace(processingChest: InventoryPeripheral): boolean {
        const size = processingChest.size();
        const items = processingChest.list();

        // Count occupied slots
        let occupied = 0;
        for (const [, item] of pairs(items)) {
            if (item && item.count > 0) {
                occupied++;
            }
        }

        return occupied < size;
    }

    /**
     * Check if a single processing operation should be performed.
     */
    private shouldProcess(
        config: AppConfig,
        inventoryContents: Map<string, InventoryItemInfo>,
        inputItemId: string,
        outputItemId: string,
    ): Result<{ sourceSlot: number }> {
        const processing = config.processing!;

        // Thresholds are already in items (configured as n * STACK_SIZE)
        const minInputReserve = processing.minInputReserve;
        const maxOutputStock = processing.maxOutputStock;

        // Check input material stock
        const inputInfo = inventoryContents.get(inputItemId);
        const inputCount = inputInfo?.totalCount ?? 0;

        // Need: minInputReserve + 1 stack to process
        const requiredInput = minInputReserve + STACK_SIZE;

        if (inputCount < requiredInput) {
            this.log.debug("Input below threshold", {
                input: inputItemId,
                have: inputCount,
                required: requiredInput,
            });
            return err("ERR_INPUT_BELOW_RESERVE", {
                input: inputItemId,
                have: inputCount,
                required: requiredInput,
            });
        }

        // Check output material stock
        const outputInfo = inventoryContents.get(outputItemId);
        const outputCount = outputInfo?.totalCount ?? 0;

        if (outputCount >= maxOutputStock) {
            this.log.debug("Output at max stock", {
                output: outputItemId,
                have: outputCount,
                max: maxOutputStock,
            });
            return err("ERR_OUTPUT_AT_MAX", {
                output: outputItemId,
                have: outputCount,
                max: maxOutputStock,
            });
        }

        // Find source slot with items
        const sourceSlot = inputInfo?.slots[0];
        if (!sourceSlot) {
            return err("ERR_NO_SLOT_FOUND", { input: inputItemId });
        }

        return ok({ sourceSlot });
    }

    /**
     * Perform a single transfer to the processing chest.
     */
    private transferToProcessing(
        materialSource: InventoryPeripheral,
        processingChestName: string,
        inputItemId: string,
        outputItemId: string,
        sourceSlot: number,
    ): Result<ProcessingResult> {
        this.log.debug("Starting processing transfer", {
            input: inputItemId,
            output: outputItemId,
            sourceSlot,
            target: processingChestName,
        });

        // Verify slot still contains expected item (race condition protection)
        const currentItem = materialSource.getItemDetail(sourceSlot);

        if (!currentItem || currentItem.name !== inputItemId) {
            this.log.warn("Slot content changed before processing transfer", {
                slot: sourceSlot,
                expected: inputItemId,
                actual: currentItem?.name ?? "empty",
            });
            return err("ERR_SLOT_CHANGED", {
                slot: sourceSlot,
                expected: inputItemId,
                actual: currentItem?.name ?? "empty",
            });
        }

        // Perform the transfer (exactly 1 stack = 64 items)
        const transferred = materialSource.pushItems(
            processingChestName,
            sourceSlot,
            STACK_SIZE,
        );

        if (transferred === 0) {
            this.log.warn("Processing transfer returned 0 items", {
                input: inputItemId,
                sourceSlot,
            });
            return err("ERR_TRANSFER_FAILED", {
                input: inputItemId,
                reason: "no_items_transferred",
            });
        }

        this.log.info("Processing transfer complete", {
            input: inputItemId,
            output: outputItemId,
            items: transferred,
        });

        return ok({
            inputItemId,
            outputItemId,
            itemsTransferred: transferred,
            sourceSlot,
        });
    }
}
