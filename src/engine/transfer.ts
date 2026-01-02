import { Result, ok, err } from "../core/result";
import { log } from "../core/logger";
import {
  AppConfig,
  UneartherInstance,
  InventoryPeripheral,
  MaterialId,
  ItemDetail,
} from "../types";
import { MaterialSelection } from "./scheduler";

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
 * Transfer items from material source to an unearther's input chest.
 *
 * @param materialSource - The source inventory (drawer controller/chest)
 * @param targetChestName - Name of the target chest for pushItems
 * @param unearther - The unearther instance
 * @param selection - Material selection from scheduler
 * @param stackSize - Number of items to transfer
 * @returns Transfer result or error
 */
export function transferToUnearther(
  materialSource: InventoryPeripheral,
  targetChestName: string,
  unearther: UneartherInstance,
  selection: MaterialSelection,
  stackSize: number
): Result<TransferResult> {
  log.debug("Starting transfer", {
    unearther: unearther.id,
    material: selection.materialId,
    sourceSlot: selection.sourceSlot,
    targetChest: targetChestName,
    amount: stackSize,
  });

  // Verify slot still contains expected item (race condition protection)
  const [detailSuccess, currentItem] = pcall(() =>
    materialSource.getItemDetail(selection.sourceSlot)
  ) as LuaMultiReturn<[boolean, ItemDetail | null]>;

  if (!detailSuccess || !currentItem || currentItem.name !== selection.material.itemId) {
    log.warn("Slot content changed before transfer", {
      slot: selection.sourceSlot,
      expected: selection.material.itemId,
      actual: currentItem?.name ?? "empty",
    });
    return err("ERR_SLOT_CHANGED", {
      slot: selection.sourceSlot,
      expected: selection.material.itemId,
      actual: currentItem?.name ?? "empty",
    });
  }

  // Perform the transfer using pushItems
  const [success, transferred] = pcall(() =>
    materialSource.pushItems(
      targetChestName,
      selection.sourceSlot,
      stackSize
    )
  ) as LuaMultiReturn<[boolean, number]>;

  if (!success) {
    log.error("Transfer failed (pushItems error)", {
      unearther: unearther.id,
      material: selection.materialId,
    });
    return err("ERR_TRANSFER_FAILED", {
      unearther: unearther.id,
      material: selection.materialId,
    });
  }

  if (transferred === 0) {
    log.warn("Transfer returned 0 items", {
      unearther: unearther.id,
      material: selection.materialId,
      sourceSlot: selection.sourceSlot,
    });
    // Not necessarily an error - slot might have been emptied by another process
    return err("ERR_TRANSFER_FAILED", {
      unearther: unearther.id,
      material: selection.materialId,
      reason: "no_items_transferred",
    });
  }

  log.info("Transfer complete", {
    unearther: unearther.id,
    material: selection.materialId,
    items: transferred,
  });

  return ok({
    unearther,
    materialId: selection.materialId,
    itemsTransferred: transferred,
    sourceSlot: selection.sourceSlot,
  });
}

/**
 * Process all empty unearthers and transfer materials to them.
 *
 * @param config - Application configuration
 * @param materialSource - Source inventory
 * @param emptyUneartherIds - List of empty unearther IDs
 * @param scheduler - Weighted scheduler for material selection
 * @param inventoryContents - Current inventory contents
 * @returns List of successful transfers
 */
export function processEmptyUnearthers(
  config: AppConfig,
  materialSource: InventoryPeripheral,
  emptyUneartherIds: string[],
  selectMaterial: (
    unearther: UneartherInstance,
    contents: Map<string, { totalCount: number; slots: number[] }>,
    stackSize: number
  ) => MaterialSelection | null,
  inventoryContents: Map<string, { totalCount: number; slots: number[] }>
): TransferResult[] {
  const results: TransferResult[] = [];
  const stackSize = config.system.transferStackSize;

  for (const uneartherId of emptyUneartherIds) {
    const unearther = config.unearthers[uneartherId];
    if (!unearther) {
      log.warn("Unknown unearther ID", { id: uneartherId });
      continue;
    }

    // Select material for this unearther
    const selection = selectMaterial(unearther, inventoryContents, stackSize);
    if (!selection) {
      log.debug("No material available for unearther", { id: uneartherId });
      continue;
    }

    // Perform transfer
    const transferRes = transferToUnearther(
      materialSource,
      unearther.inputChest,
      unearther,
      selection,
      stackSize
    );

    if (transferRes.ok) {
      results.push(transferRes.value);

      // Update inventory contents to reflect the transfer
      const itemInfo = inventoryContents.get(selection.material.itemId);
      if (itemInfo) {
        itemInfo.totalCount -= transferRes.value.itemsTransferred;
        // Remove slot if empty (simplified - in reality we'd need to re-scan)
        if (itemInfo.totalCount <= 0) {
          inventoryContents.delete(selection.material.itemId);
        }
      }
    }
  }

  return results;
}
