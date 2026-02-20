import { Result, ok, err } from "@core/result";
import { SafePeripheral } from "@core/safe-peripheral";
import { InventoryItemInfo } from "./types";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Get inventory contents from a peripheral.
 * Returns a map of itemId -> InventoryItemInfo (totalCount + slots).
 *
 * Calls ensureConnected() before reading.
 */
export function getInventoryContents(
    inv: SafePeripheral<InventoryPeripheral>,
): Result<Map<string, InventoryItemInfo>> {
    const contents = new Map<string, InventoryItemInfo>();

    inv.ensureConnected();
    const items = inv.call((p) => p.list(), undefined);

    if (!items) {
        return err("ERR_SCAN_FAILED");
    }

    for (const [slot, item] of pairs(items)) {
        if (item && item.name && item.count > 0) {
            const slotNum = slot as number;
            const existing = contents.get(item.name);
            if (existing) {
                existing.totalCount += item.count;
                existing.slots.push({ slot: slotNum, count: item.count });
            } else {
                contents.set(item.name, {
                    totalCount: item.count,
                    slots: [{ slot: slotNum, count: item.count }],
                });
            }
        }
    }

    return ok(contents);
}

/**
 * Check if an inventory is empty.
 * Does NOT call ensureConnected() - caller must do this.
 */
export function isInventoryEmpty(
    inv: SafePeripheral<InventoryPeripheral>,
): Result<boolean> {
    const items = inv.call((p) => p.list(), undefined);

    if (!items) {
        return err("ERR_PERIPHERAL_DISCONNECTED");
    }

    for (const [, item] of pairs(items)) {
        if (item && item.count > 0) {
            return ok(false);
        }
    }
    return ok(true);
}
