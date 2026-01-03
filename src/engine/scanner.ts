import { Result, ok, err } from "../core/result";
import { Logger } from "../core/logger";
import { PeripheralRegistry } from "../registry/peripheral";
import {
    AppConfig,
    UneartherId,
    UneartherInstance,
    InventoryItemInfo,
} from "../types";

// Types InventoryPeripheral, WiredModemPeripheral from @jackmacwindows/craftos-types are globally declared

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
 * Scanner for checking unearther status and inventory contents.
 */
export class Scanner {
    constructor(
        private peripheralRegistry: PeripheralRegistry,
        private log: Logger,
    ) {}

    /**
     * Scan all unearthers in the config.
     * Returns scan results for each unearther and a list of empty ones.
     */
    scanAllUnearthers(config: AppConfig, modem: WiredModemPeripheral): Result<ScanResult> {
        this.log.debug("Starting scan of all unearthers", {
            count: Object.keys(config.unearthers).length,
        });

        const results: UneartherScanResult[] = [];
        const emptyUnearthers: UneartherId[] = [];
        let errors = 0;

        for (const [id, unearther] of Object.entries(config.unearthers)) {
            const scanRes = this.scanUnearther(modem, unearther);

            if (scanRes.ok) {
                results.push(scanRes.value);
                if (scanRes.value.isEmpty) {
                    emptyUnearthers.push(id);
                }
            } else {
                errors++;
                results.push({ id, isEmpty: false });
            }
        }

        if (errors > 0) {
            this.log.warn("Some unearthers failed to scan", { errors, total: results.length });
        }

        this.log.info("Scan complete", {
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
    getInventoryContents(inv: InventoryPeripheral): Result<Map<string, InventoryItemInfo>> {
        const contents = new Map<string, InventoryItemInfo>();

        const items = inv.list();

        if (!items) {
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

    // ========================================
    // Private methods
    // ========================================

    private scanUnearther(
        modem: WiredModemPeripheral,
        unearther: UneartherInstance,
    ): Result<UneartherScanResult> {
        if (type(unearther.inputChest) !== "string") {
            this.log.error("scanUnearther received non-string inputChest", {
                id: unearther.id,
                chestType: type(unearther.inputChest),
                chest: tostring(unearther.inputChest),
            });
            return err("ERR_CONFIG_INVALID", { id: unearther.id });
        }

        if (!this.peripheralRegistry.isRemotePresent(modem, unearther.inputChest)) {
            this.log.warn("Unearther input chest offline", {
                id: unearther.id,
                chest: unearther.inputChest,
            });
            return err("ERR_PERIPHERAL_OFFLINE", {
                id: unearther.id,
                chest: unearther.inputChest,
            });
        }

        const inv = peripheral.wrap(unearther.inputChest) as InventoryPeripheral | null;

        if (!inv) {
            this.log.warn("Failed to wrap unearther chest", { id: unearther.id });
            return err("ERR_SCAN_FAILED", { id: unearther.id });
        }

        const isEmpty = this.isInventoryEmpty(inv);

        this.log.debug("Scanned unearther", { id: unearther.id, isEmpty });

        return ok({
            id: unearther.id,
            isEmpty,
        });
    }

    private isInventoryEmpty(inv: InventoryPeripheral): boolean {
        const items = inv.list();
        for (const [, item] of pairs(items)) {
            if (item && item.count > 0) {
                return false;
            }
        }
        return true;
    }
}
