import { Result, ok, err } from "../core/result";
import { Logger } from "../core/logger";
import { SafePeripheral } from "../core/safe-peripheral";
import { AppConfig, UneartherInstance, MaterialId } from "../types";
import { MaterialSelection } from "./scheduler";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Result of a transfer operation.
 */
export interface TransferResult {
    /** Unearther that received items */
    unearther: UneartherInstance;
    /** Material that was transferred */
    materialId: MaterialId;
    /** Number of items transferred */
    itemsTransferred: number;
    /** Source slot used */
    sourceSlot: number;
}

/**
 * Engine for transferring materials to unearthers.
 */
export class TransferEngine {
    constructor(private log: Logger) {}

    /**
     * Transfer items from material source to an unearther's input chest.
     * Uses batch call to verify slot content and transfer atomically.
     */
    transferToUnearther(
        materialSource: SafePeripheral<InventoryPeripheral>,
        targetChestName: string,
        unearther: UneartherInstance,
        selection: MaterialSelection,
        stackSize: number,
    ): Result<TransferResult> {
        this.log.debug("Starting transfer", {
            unearther: unearther.id,
            material: selection.materialId,
            sourceSlot: selection.sourceSlot,
            targetChest: targetChestName,
            amount: stackSize,
        });

        // Batch call: verify slot content and transfer atomically
        type TransferCallResult =
            | { error: "slot_changed"; actual: string | undefined }
            | { error: "transfer_failed" }
            | { error: "disconnected" }
            | { transferred: number };

        const result: TransferCallResult = materialSource.call(
            (p): TransferCallResult => {
                // Verify slot still contains expected item (race condition protection)
                const currentItem = p.getItemDetail(selection.sourceSlot);

                if (!currentItem || currentItem.name !== selection.material.itemId) {
                    return { error: "slot_changed", actual: currentItem?.name };
                }

                // Perform the transfer using pushItems
                const transferred = p.pushItems(targetChestName, selection.sourceSlot, stackSize);

                if (transferred === 0) {
                    return { error: "transfer_failed" };
                }

                return { transferred };
            },
            { error: "disconnected" },
        );

        if ("error" in result) {
            if (result.error === "slot_changed") {
                this.log.warn("Slot content changed before transfer", {
                    slot: selection.sourceSlot,
                    expected: selection.material.itemId,
                    actual: result.actual ?? "empty",
                });
                return err("ERR_SLOT_CHANGED", {
                    slot: selection.sourceSlot,
                    expected: selection.material.itemId,
                    actual: result.actual ?? "empty",
                });
            }
            if (result.error === "transfer_failed") {
                this.log.warn("Transfer returned 0 items", {
                    unearther: unearther.id,
                    material: selection.materialId,
                    sourceSlot: selection.sourceSlot,
                });
                return err("ERR_TRANSFER_FAILED", {
                    unearther: unearther.id,
                    material: selection.materialId,
                    reason: "no_items_transferred",
                });
            }
            // disconnected
            this.log.warn("Material source disconnected during transfer", {
                unearther: unearther.id,
            });
            return err("ERR_PERIPHERAL_DISCONNECTED");
        }

        this.log.info("Transfer complete", {
            unearther: unearther.id,
            material: selection.materialId,
            items: result.transferred,
        });

        return ok({
            unearther,
            materialId: selection.materialId,
            itemsTransferred: result.transferred,
            sourceSlot: selection.sourceSlot,
        });
    }

    /**
     * Process all empty unearthers and transfer materials to them.
     */
    processEmptyUnearthers(
        config: AppConfig,
        materialSource: SafePeripheral<InventoryPeripheral>,
        emptyUneartherIds: string[],
        selectMaterial: (
            unearther: UneartherInstance,
            contents: Map<string, { totalCount: number; slots: number[] }>,
            stackSize: number,
        ) => MaterialSelection | null,
        inventoryContents: Map<string, { totalCount: number; slots: number[] }>,
    ): TransferResult[] {
        const results: TransferResult[] = [];
        const stackSize = config.system.transferStackSize;

        for (const uneartherId of emptyUneartherIds) {
            const unearther = config.unearthers[uneartherId];
            if (!unearther) {
                this.log.warn("Unknown unearther ID", { id: uneartherId });
                continue;
            }

            // Select material for this unearther
            const selection = selectMaterial(unearther, inventoryContents, stackSize);
            if (!selection) {
                this.log.debug("No material available for unearther", { id: uneartherId });
                continue;
            }

            // Perform transfer
            const transferRes = this.transferToUnearther(
                materialSource,
                unearther.inputChest,
                unearther,
                selection,
                stackSize,
            );

            if (transferRes.ok) {
                results.push(transferRes.value);

                // Update inventory contents to reflect the transfer
                const itemInfo = inventoryContents.get(selection.material.itemId);
                if (itemInfo) {
                    itemInfo.totalCount -= transferRes.value.itemsTransferred;
                    if (itemInfo.totalCount <= 0) {
                        inventoryContents.delete(selection.material.itemId);
                    }
                }
            } else {
                // Explicitly log failed transfers
                this.log.warn("Transfer failed for unearther", {
                    unearther: uneartherId,
                    code: transferRes.code,
                    detail: "detail" in transferRes ? transferRes.detail : undefined,
                });
            }
        }

        return results;
    }
}
