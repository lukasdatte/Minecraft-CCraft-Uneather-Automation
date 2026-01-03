import { Result, ok, err } from "../core/result";
import { Logger } from "../core/logger";
import { SafePeripheral, wrapPeripheral } from "../core/safe-peripheral";
import { AppConfig, Side } from "../types";

// Types from @jackmacwindows/craftos-types are globally declared (not module exports)

/**
 * Validated peripheral registry with wrapped peripherals.
 * All peripherals (except modem) are wrapped in SafePeripheral for resilience.
 */
export interface ValidatedPeripherals {
    modem: WiredModemPeripheral;
    materialSource: SafePeripheral<InventoryPeripheral>;
    monitor?: SafePeripheral<MonitorPeripheral>;
    processingChest?: SafePeripheral<InventoryPeripheral>;
    uneartherChests: Map<string, SafePeripheral<InventoryPeripheral>>;
}

/**
 * Peripheral registry for validating and wrapping CC:Tweaked peripherals.
 */
export class PeripheralRegistry {
    constructor(private log: Logger) {}

    /**
     * Validate all peripherals in the config and return wrapped instances.
     */
    validate(config: AppConfig): Result<ValidatedPeripherals> {
        this.log.info("Validating peripherals...");

        // 1. Get wired modem (stays raw - needed for connectivity checks)
        const modemSide = config.peripherals.modem.name as Side;
        const modemRes = this.getWiredModem(modemSide);
        if (!modemRes.ok) {
            this.log.error("Failed to get wired modem", { side: modemSide, code: modemRes.code });
            return modemRes as Result<ValidatedPeripherals>;
        }
        const modem = modemRes.value;
        this.log.debug("Wired modem found", { side: modemSide });

        // 2. List all remote peripherals for debugging
        const remotes = modem.getNamesRemote();
        this.log.debug("Remote peripherals found", { count: remotes.length, names: remotes });

        // 3. Validate material source (wrapped in SafePeripheral)
        const materialSourceName = config.peripherals.materialSource.name;
        const materialSourceRes = this.validateInventory(modem, materialSourceName);
        if (!materialSourceRes.ok) {
            this.log.error("Failed to get material source", {
                name: materialSourceName,
                code: materialSourceRes.code,
            });
            return materialSourceRes as Result<ValidatedPeripherals>;
        }
        const materialSource = materialSourceRes.value;
        this.log.info("Material source validated", { name: materialSourceName });

        // 4. Validate and wrap all unearther input chests
        const uneartherChests = new Map<string, SafePeripheral<InventoryPeripheral>>();
        for (const [id, unearther] of Object.entries(config.unearthers)) {
            const chestRes = this.validateInventory(modem, unearther.inputChest);
            if (!chestRes.ok) {
                this.log.warn("Unearther chest not available at boot", {
                    id,
                    chest: unearther.inputChest,
                    code: chestRes.code,
                });
                // Continue with other unearthers instead of failing completely
                continue;
            }
            uneartherChests.set(unearther.inputChest, chestRes.value);
            this.log.debug("Unearther input chest validated", { id, chest: unearther.inputChest });
        }

        if (uneartherChests.size === 0) {
            this.log.error("No unearther chests could be validated");
            return err("ERR_PERIPHERAL_OFFLINE", { reason: "no_unearther_chests" });
        }

        // 5. Validate monitor (optional, wrapped in SafePeripheral)
        let monitor: SafePeripheral<MonitorPeripheral> | undefined;
        if (config.peripherals.monitor) {
            const monitorName = config.peripherals.monitor.name;
            const monitorRes = this.validateMonitor(modem, monitorName);
            if (monitorRes.ok) {
                monitor = monitorRes.value;
                this.log.info("Monitor validated", { name: monitorName });
            } else {
                this.log.warn("Monitor not available, continuing without", {
                    name: monitorName,
                    code: monitorRes.code,
                });
            }
        }

        // 6. Validate processing chest (optional, wrapped in SafePeripheral)
        let processingChest: SafePeripheral<InventoryPeripheral> | undefined;
        if (config.peripherals.processingChest && config.processing?.enabled) {
            const processingChestName = config.peripherals.processingChest.name;
            const processingChestRes = this.validateInventory(modem, processingChestName);
            if (processingChestRes.ok) {
                processingChest = processingChestRes.value;
                this.log.info("Processing chest validated", { name: processingChestName });
            } else {
                this.log.warn("Processing chest not available, processing disabled", {
                    name: processingChestName,
                    code: processingChestRes.code,
                });
            }
        }

        // 7. Validate config consistency (unearther types exist, materials exist)
        for (const [id, unearther] of Object.entries(config.unearthers)) {
            const uType = config.uneartherTypes[unearther.type];
            if (!uType) {
                this.log.error("Unknown unearther type", { id, type: unearther.type });
                return err("ERR_UNKNOWN_UNEARTHER_TYPE", { id, type: unearther.type });
            }

            for (const matId of uType.supportedMaterials) {
                if (!config.materials[matId]) {
                    this.log.error("Unknown material in unearther type", {
                        uneartherType: unearther.type,
                        material: matId,
                    });
                    return err("ERR_UNKNOWN_MATERIAL", { type: unearther.type, material: matId });
                }
            }
        }

        this.log.info("All peripherals validated successfully", {
            uneartherChests: uneartherChests.size,
            hasMonitor: !!monitor,
            hasProcessingChest: !!processingChest,
        });

        return ok({
            modem,
            materialSource,
            monitor,
            processingChest,
            uneartherChests,
        });
    }

    /**
     * Check if a remote peripheral is present using getNamesRemote.
     */
    isRemotePresent(modem: WiredModemPeripheral, name: string): boolean {
        const remotes = modem.getNamesRemote();
        for (const remote of remotes) {
            if (remote === name) {
                return true;
            }
        }
        return false;
    }

    // ========================================
    // Private methods
    // ========================================

    private getWiredModem(side: Side): Result<WiredModemPeripheral> {
        if (!peripheral.hasType(side, "modem")) {
            const pType = peripheral.getType(side) as unknown as string | undefined;
            return err("ERR_MODEM_MISSING", { side, foundType: pType });
        }

        const modem = peripheral.wrap(side) as WiredModemPeripheral;
        if (!modem) {
            return err("ERR_MODEM_MISSING", { side });
        }

        if (modem.isWireless()) {
            return err("ERR_MODEM_WIRELESS", { side });
        }

        return ok(modem);
    }

    private validateInventory(
        modem: WiredModemPeripheral,
        name: string,
    ): Result<SafePeripheral<InventoryPeripheral>> {
        if (!this.isRemotePresent(modem, name)) {
            return err("ERR_PERIPHERAL_OFFLINE", { name });
        }

        const inv = peripheral.wrap(name) as InventoryPeripheral | undefined;
        if (!inv) {
            return err("ERR_PERIPHERAL_OFFLINE", { name });
        }

        if (typeof inv.list !== "function" || typeof inv.pushItems !== "function") {
            return err("ERR_PERIPHERAL_NOT_INVENTORY", { name });
        }

        return ok(wrapPeripheral(modem, name, inv, this.log));
    }

    private validateMonitor(
        modem: WiredModemPeripheral,
        name: string,
    ): Result<SafePeripheral<MonitorPeripheral>> {
        if (!this.isRemotePresent(modem, name)) {
            return err("ERR_PERIPHERAL_OFFLINE", { name });
        }

        const mon = peripheral.wrap(name) as MonitorPeripheral | undefined;
        if (!mon) {
            return err("ERR_PERIPHERAL_OFFLINE", { name });
        }

        if (typeof mon.write !== "function" || typeof mon.clear !== "function") {
            return err("ERR_PERIPHERAL_WRONG_TYPE", { name, expected: "monitor" });
        }

        return ok(wrapPeripheral(modem, name, mon, this.log));
    }
}
