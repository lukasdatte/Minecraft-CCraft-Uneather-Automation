import { Result, ok, err } from "../core/result";
import { log } from "../core/logger";
import {
    AppConfig,
    UneartherId,
    UneartherInstance,
    InventoryPeripheral,
    WiredModem,
    ItemDetail,
    InventoryItemInfo,
} from "../types";

/**
 * Result of scanning a single unearther.
 */
export interface UneartherScanResult {
    id: UneartherId;
    isEmpty: boolean;
}

/**
 * Result of scanning all unearthers.
 */
export interface ScanResult {
    /** All unearther scan results */
    results: UneartherScanResult[];
    /** IDs of empty unearthers (ready for refill) */
    emptyUnearthers: UneartherId[];
}

/**
 * Check if an inventory is empty.
 */
function isInventoryEmpty(inv: InventoryPeripheral): boolean {
    const items = inv.list();
    // In Lua, an empty table has no keys
    // We check by iterating - if we get any item, it's not empty
    for (const [, item] of pairs(items)) {
        if (item && item.count > 0) {
            return false;
        }
    }
    return true;
}

/**
 * Scan a single unearther's input chest.
 */
function scanUnearther(
    modem: WiredModem,
    unearther: UneartherInstance,
): Result<UneartherScanResult> {
    // Check if chest is online
    if (!modem.isPresentRemote(unearther.inputChest)) {
        log.warn("Unearther input chest offline", {
            id: unearther.id,
            chest: unearther.inputChest,
        });
        return err("ERR_PERIPHERAL_OFFLINE", {
            id: unearther.id,
            chest: unearther.inputChest,
        });
    }

    // Wrap the chest
    const [success, inv] = pcall(() =>
        peripheral.wrap(unearther.inputChest),
    ) as LuaMultiReturn<[boolean, InventoryPeripheral | null]>;

    if (!success || !inv) {
        log.warn("Failed to wrap unearther chest", { id: unearther.id });
        return err("ERR_SCAN_FAILED", { id: unearther.id });
    }

    // Check if empty
    const isEmpty = isInventoryEmpty(inv);

    log.debug("Scanned unearther", { id: unearther.id, isEmpty });

    return ok({
        id: unearther.id,
        isEmpty,
    });
}

/**
 * Scan all unearthers in the config.
 * Returns scan results for each unearther and a list of empty ones.
 */
export function scanAllUnearthers(
    config: AppConfig,
    modem: WiredModem,
): Result<ScanResult> {
    log.debug("Starting scan of all unearthers", {
        count: Object.keys(config.unearthers).length,
    });

    const results: UneartherScanResult[] = [];
    const emptyUnearthers: UneartherId[] = [];
    let errors = 0;

    for (const [id, unearther] of Object.entries(config.unearthers)) {
        const scanRes = scanUnearther(modem, unearther);

        if (scanRes.ok) {
            results.push(scanRes.value);
            if (scanRes.value.isEmpty) {
                emptyUnearthers.push(id);
            }
        } else {
            // Log error but continue scanning others
            errors++;
            // Still add a result with empty=false so we don't try to fill broken chests
            results.push({ id, isEmpty: false });
        }
    }

    if (errors > 0) {
        log.warn("Some unearthers failed to scan", { errors, total: results.length });
    }

    log.info("Scan complete", {
        total: results.length,
        empty: emptyUnearthers.length,
    });

    return ok({
        results,
        emptyUnearthers,
    });
}

/**
 * Get inventory contents from material source.
 * Returns a map of itemId -> InventoryItemInfo (totalCount + slots).
 */
export function getInventoryContents(
    inv: InventoryPeripheral,
): Result<Map<string, InventoryItemInfo>> {
    const contents = new Map<string, InventoryItemInfo>();

    const [success, items] = pcall(() => inv.list()) as LuaMultiReturn<
        [boolean, LuaTable<number, ItemDetail> | null]
    >;

    if (!success || !items) {
        return err("ERR_SCAN_FAILED");
    }

    for (const [slot, item] of pairs(items)) {
        if (item && item.name && item.count > 0) {
            const existing = contents.get(item.name);
            if (existing) {
                existing.totalCount += item.count;
                existing.slots.push(slot as number);
            } else {
                contents.set(item.name, {
                    totalCount: item.count,
                    slots: [slot as number],
                });
            }
        }
    }

    return ok(contents);
}
