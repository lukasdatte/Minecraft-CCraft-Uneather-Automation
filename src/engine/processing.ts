import { Result, ok, err } from "../core/result";
import { Logger } from "../core/logger";
import { SafePeripheral } from "../core/safe-peripheral";
import { Scanner } from "./scanner";
import {
    ProcessingResult,
    ProcessingChain,
    InventoryItemInfo,
    STACK_SIZE,
} from "../types";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Configuration for a processing phase.
 */
export interface ProcessingPhaseConfig {
    /** Minimum items to keep in reserve */
    minInputReserve: number;
    /** Maximum output before stopping */
    maxOutputStock: number;
    /** Processing chain: inputItemId → outputItemId */
    chain: ProcessingChain;
}

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
     * This is the main entry point called from tasks.
     *
     * @param config - Processing phase configuration
     * @param materialSource - Material source peripheral
     * @param processingChest - Processing chest peripheral
     */
    runPhase(
        config: ProcessingPhaseConfig,
        materialSource: SafePeripheral<InventoryPeripheral>,
        processingChest: SafePeripheral<InventoryPeripheral>,
    ): Result<ProcessingResult[]> {
        this.log.debug("Starting processing phase...");

        const results = this.processAllMaterials(
            config,
            materialSource,
            processingChest,
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
        config: ProcessingPhaseConfig,
        materialSource: SafePeripheral<InventoryPeripheral>,
        processingChest: SafePeripheral<InventoryPeripheral>,
    ): ProcessingResult[] {
        const results: ProcessingResult[] = [];

        // Get current inventory state via Scanner (ensureConnected inside)
        const inventoryRes = this.scanner.getInventoryContents(materialSource);
        if (!inventoryRes.ok) {
            this.log.warn("Failed to get inventory contents for processing");
            return results;
        }
        // Create local copy for tracking (avoid mutating original)
        const localInventory = new Map<string, InventoryItemInfo>();
        for (const [key, value] of inventoryRes.value) {
            localInventory.set(key, {
                totalCount: value.totalCount,
                slots: [...value.slots],
            });
        }

        // Ensure processing chest is connected before operations
        processingChest.ensureConnected();
        const chestContents = processingChest.call((p) => p.list(), undefined);
        if (!chestContents) {
            this.log.warn("Processing chest disconnected");
            return results;
        }

        // Process each mapping in the chain
        for (const [inputItemId, outputItemId] of Object.entries(config.chain)) {
            // Check if processing chest has space
            const spaceRes = this.hasAvailableSpace(processingChest);
            if (!spaceRes.ok || !spaceRes.value) {
                this.log.debug("Processing chest full or disconnected, skipping remaining chain");
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
                localInventory,
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
                processingChest.getName(),
                inputItemId,
                outputItemId,
                shouldRes.value.sourceSlot,
            );

            if (transferRes.ok) {
                results.push(transferRes.value);

                // Update local inventory tracking (not the original!)
                const inputInfo = localInventory.get(inputItemId);
                if (inputInfo) {
                    inputInfo.totalCount -= transferRes.value.itemsTransferred;
                    if (inputInfo.totalCount <= 0) {
                        localInventory.delete(inputItemId);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Check if processing chest has available space.
     * Uses batch call to minimize peripheral operations.
     */
    private hasAvailableSpace(
        processingChest: SafePeripheral<InventoryPeripheral>,
    ): Result<boolean> {
        const result = processingChest.call(
            (p) => {
                const size = p.size();
                const items = p.list();

                if (!items || size === undefined) return undefined;

                // Count occupied slots
                let occupied = 0;
                for (const [, item] of pairs(items)) {
                    if (item && item.count > 0) {
                        occupied++;
                    }
                }

                return occupied < size;
            },
            undefined,
        );

        if (result === undefined) {
            return err("ERR_PERIPHERAL_DISCONNECTED");
        }
        return ok(result);
    }

    /**
     * Check if a single processing operation should be performed.
     */
    private shouldProcess(
        config: ProcessingPhaseConfig,
        inventoryContents: Map<string, InventoryItemInfo>,
        inputItemId: string,
        outputItemId: string,
    ): Result<{ sourceSlot: number }> {
        // Thresholds are already in items (configured as n * STACK_SIZE)
        const minInputReserve = config.minInputReserve;
        const maxOutputStock = config.maxOutputStock;

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
     * Uses batch call to verify slot content and transfer atomically.
     */
    private transferToProcessing(
        materialSource: SafePeripheral<InventoryPeripheral>,
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

        // Ensure connected before transfer
        materialSource.ensureConnected();

        // Batch call: verify slot content and transfer atomically
        type TransferCallResult =
            | { error: "slot_changed"; actual: string | undefined }
            | { error: "transfer_failed" }
            | { error: "disconnected" }
            | { transferred: number };

        const result: TransferCallResult = materialSource.call(
            (p): TransferCallResult => {
                // Verify slot still contains expected item (race condition protection)
                const currentItem = p.getItemDetail(sourceSlot);

                if (!currentItem || currentItem.name !== inputItemId) {
                    return { error: "slot_changed", actual: currentItem?.name };
                }

                // Perform the transfer (exactly 1 stack = 64 items)
                const transferred = p.pushItems(processingChestName, sourceSlot, STACK_SIZE);

                if (transferred === 0) {
                    return { error: "transfer_failed" };
                }

                return { transferred };
            },
            { error: "disconnected" },
        );

        if ("error" in result) {
            if (result.error === "slot_changed") {
                this.log.warn("Slot content changed before processing transfer", {
                    slot: sourceSlot,
                    expected: inputItemId,
                    actual: result.actual ?? "empty",
                });
                return err("ERR_SLOT_CHANGED", {
                    slot: sourceSlot,
                    expected: inputItemId,
                    actual: result.actual ?? "empty",
                });
            }
            if (result.error === "transfer_failed") {
                this.log.warn("Processing transfer returned 0 items", {
                    input: inputItemId,
                    sourceSlot,
                });
                return err("ERR_TRANSFER_FAILED", {
                    input: inputItemId,
                    reason: "no_items_transferred",
                });
            }
            // disconnected
            this.log.warn("Material source disconnected during processing transfer");
            return err("ERR_PERIPHERAL_DISCONNECTED");
        }

        this.log.info("Processing transfer complete", {
            input: inputItemId,
            output: outputItemId,
            items: result.transferred,
        });

        return ok({
            inputItemId,
            outputItemId,
            itemsTransferred: result.transferred,
            sourceSlot,
        });
    }
}
