import { Result, ok, err, ErrorCode } from "../core/result";
import { Logger } from "../core/logger";
import { SafePeripheral } from "../core/safe-peripheral";
import { ValidatedPeripherals } from "../registry/peripheral";
import {
    UneartherId,
    UneartherInstance,
    UneartherRegistry,
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
    constructor(private log: Logger) {}

    /**
     * Scan all unearthers.
     * Returns scan results for each unearther and a list of empty ones.
     *
     * @param unearthers - Registry of unearthers to scan
     * @param peripherals - Validated peripherals
     */
    scanAllUnearthers(
        unearthers: UneartherRegistry,
        peripherals: ValidatedPeripherals,
    ): Result<ScanResult> {
        this.log.debug("Starting scan of all unearthers", {
            count: Object.keys(unearthers).length,
        });

        const results: UneartherScanResult[] = [];
        const emptyUnearthers: UneartherId[] = [];
        let errors = 0;

        for (const [id, unearther] of Object.entries(unearthers)) {
            const scanRes = this.scanUnearther(peripherals, unearther);

            if (scanRes.ok) {
                results.push(scanRes.value);
                if (scanRes.value.isEmpty) {
                    emptyUnearthers.push(id);
                }
            } else {
                errors++;
                this.log.warn("Failed to scan unearther", {
                    id,
                    code: scanRes.code,
                });
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
    getInventoryContents(
        inv: SafePeripheral<InventoryPeripheral>,
    ): Result<Map<string, InventoryItemInfo>> {
        const contents = new Map<string, InventoryItemInfo>();

        // Ensure connected before operation
        inv.ensureConnected();
        const items = inv.call((p) => p.list(), undefined);

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
        peripherals: ValidatedPeripherals,
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

        // Get pre-wrapped SafePeripheral from ValidatedPeripherals
        const safeInv = peripherals.uneartherChests.get(unearther.inputChest);
        if (!safeInv) {
            this.log.warn("Unearther chest not in validated peripherals", {
                id: unearther.id,
                chest: unearther.inputChest,
            });
            return err("ERR_PERIPHERAL_OFFLINE", {
                id: unearther.id,
                chest: unearther.inputChest,
            });
        }

        // Ensure connected before scanning
        safeInv.ensureConnected();
        const isEmptyRes = this.isInventoryEmpty(safeInv);
        if (!isEmptyRes.ok) {
            return err(isEmptyRes.code as ErrorCode, { id: unearther.id });
        }

        this.log.debug("Scanned unearther", { id: unearther.id, isEmpty: isEmptyRes.value });

        return ok({
            id: unearther.id,
            isEmpty: isEmptyRes.value,
        });
    }

    private isInventoryEmpty(inv: SafePeripheral<InventoryPeripheral>): Result<boolean> {
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
}
