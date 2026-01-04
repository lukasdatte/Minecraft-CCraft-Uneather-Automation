import { Result, ok, err } from "../core/result";
import { Logger } from "../core/logger";
import { SafePeripheral } from "../core/safe-peripheral";
import { UneartherInstance, UneartherRegistry, MaterialId } from "../types";
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
     * Note: Does NOT mutate inventoryContents. Caller should track transfers via returned results.
     *
     * @param unearthers - Registry of unearthers
     * @param materialSource - Material source peripheral
     * @param emptyUneartherIds - IDs of empty unearthers
     * @param selectMaterial - Function to select material for an unearther (returns Result)
     * @param inventoryContents - Current inventory state (read-only)
     * @param stackSize - Items per transfer
     */
    processEmptyUnearthers(
        unearthers: UneartherRegistry,
        materialSource: SafePeripheral<InventoryPeripheral>,
        emptyUneartherIds: string[],
        selectMaterial: (
            unearther: UneartherInstance,
            contents: Map<string, { totalCount: number; slots: number[] }>,
            stackSize: number,
        ) => Result<MaterialSelection>,
        inventoryContents: Map<string, { totalCount: number; slots: number[] }>,
        stackSize: number,
    ): TransferResult[] {
        const results: TransferResult[] = [];

        // Create local copy for tracking (avoid mutating original)
        const localInventory = new Map<string, { totalCount: number; slots: number[] }>();
        for (const [key, value] of inventoryContents) {
            localInventory.set(key, {
                totalCount: value.totalCount,
                slots: [...value.slots],
            });
        }

        for (const uneartherId of emptyUneartherIds) {
            const unearther = unearthers[uneartherId];
            if (!unearther) {
                this.log.warn("Unknown unearther ID", { id: uneartherId });
                continue;
            }

            // Select material for this unearther
            const selectionRes = selectMaterial(unearther, localInventory, stackSize);
            if (!selectionRes.ok) {
                this.log.debug("No material available for unearther", { id: uneartherId });
                continue;
            }

            // Perform transfer
            const transferRes = this.transferToUnearther(
                materialSource,
                unearther.inputChest,
                unearther,
                selectionRes.value,
                stackSize,
            );

            if (transferRes.ok) {
                results.push(transferRes.value);

                // Update local inventory tracking (not the original!)
                const itemInfo = localInventory.get(selectionRes.value.material.itemId);
                if (itemInfo) {
                    itemInfo.totalCount -= transferRes.value.itemsTransferred;
                    if (itemInfo.totalCount <= 0) {
                        localInventory.delete(selectionRes.value.material.itemId);
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
