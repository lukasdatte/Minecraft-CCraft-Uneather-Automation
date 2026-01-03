import { Result, ok, err } from "../core/result";
import { log } from "../core/logger";
import { AppConfig, Side } from "../types";

// Types from @jackmacwindows/craftos-types are globally declared (not module exports)

/**
 * Validated peripheral registry with wrapped peripherals.
 */
export interface ValidatedPeripherals {
    modem: WiredModemPeripheral;
    materialSource: InventoryPeripheral;
    materialSourceName: string;
    monitor?: MonitorPeripheral;
    processingChest?: InventoryPeripheral;
    processingChestName?: string;
}

/**
 * Get wired modem on the specified side.
 */
function getWiredModem(side: Side): Result<WiredModemPeripheral> {
    // peripheral.hasType checks if any of the types match (supports multi-type peripherals)
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

/**
 * Check if a remote peripheral is present using getNamesRemote.
 * Workaround for isPresentRemote method call issues.
 */
export function isRemotePresent(modem: WiredModemPeripheral, name: string): boolean {
    const remotes = modem.getNamesRemote();
    for (const remote of remotes) {
        if (remote === name) {
            return true;
        }
    }
    return false;
}

/**
 * Wrap a remote peripheral as an inventory.
 */
function wrapInventory(modem: WiredModemPeripheral, name: string): Result<InventoryPeripheral> {
    if (!isRemotePresent(modem, name)) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    const inv = peripheral.wrap(name) as InventoryPeripheral;
    if (!inv) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    // Check if it has inventory methods
    if (typeof inv.list !== "function" || typeof inv.pushItems !== "function") {
        return err("ERR_PERIPHERAL_NOT_INVENTORY", { name });
    }

    return ok(inv);
}

/**
 * Wrap a remote monitor peripheral.
 */
function wrapMonitor(modem: WiredModemPeripheral, name: string): Result<MonitorPeripheral> {
    if (!isRemotePresent(modem, name)) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    const mon = peripheral.wrap(name) as MonitorPeripheral;
    if (!mon) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    // Check if it has monitor methods
    if (typeof mon.write !== "function" || typeof mon.clear !== "function") {
        return err("ERR_PERIPHERAL_WRONG_TYPE", { name, expected: "monitor" });
    }

    return ok(mon);
}

/**
 * Validate all peripherals in the config and return wrapped instances.
 */
export function validatePeripherals(config: AppConfig): Result<ValidatedPeripherals> {
    log.info("Validating peripherals...");

    // 1. Get wired modem
    const modemSide = config.peripherals.modem.name as Side;
    const modemRes = getWiredModem(modemSide);
    if (!modemRes.ok) {
        log.error("Failed to get wired modem", { side: modemSide, code: modemRes.code });
        return modemRes as Result<ValidatedPeripherals>;
    }
    const modem = modemRes.value;
    log.debug("Wired modem found", { side: modemSide });

    // 2. List all remote peripherals for debugging
    const remotes = modem.getNamesRemote();
    log.debug("Remote peripherals found", { count: remotes.length, names: remotes });

    // 3. Validate material source
    const materialSourceName = config.peripherals.materialSource.name;
    const materialSourceRes = wrapInventory(modem, materialSourceName);
    if (!materialSourceRes.ok) {
        log.error("Failed to get material source", {
            name: materialSourceName,
            code: materialSourceRes.code,
        });
        return materialSourceRes as Result<ValidatedPeripherals>;
    }
    log.info("Material source validated", { name: materialSourceName });

    // 4. Validate all unearther input chests
    for (const [id, unearther] of Object.entries(config.unearthers)) {
        const chestRes = wrapInventory(modem, unearther.inputChest);
        if (!chestRes.ok) {
            log.error("Failed to validate unearther input chest", {
                id,
                chest: unearther.inputChest,
                code: chestRes.code,
            });
            return chestRes as Result<ValidatedPeripherals>;
        }
        log.debug("Unearther input chest validated", { id, chest: unearther.inputChest });
    }

    // 5. Validate monitor (optional)
    let monitor: MonitorPeripheral | undefined;
    if (config.peripherals.monitor) {
        const monitorName = config.peripherals.monitor.name;
        const monitorRes = wrapMonitor(modem, monitorName);
        if (monitorRes.ok) {
            monitor = monitorRes.value;
            log.info("Monitor validated", { name: monitorName });
        } else {
            log.warn("Monitor not available, continuing without", {
                name: monitorName,
                code: monitorRes.code,
            });
        }
    }

    // 6. Validate processing chest (optional, only if processing enabled)
    let processingChest: InventoryPeripheral | undefined;
    let processingChestName: string | undefined;
    if (config.peripherals.processingChest && config.processing?.enabled) {
        processingChestName = config.peripherals.processingChest.name;
        const processingChestRes = wrapInventory(modem, processingChestName);
        if (processingChestRes.ok) {
            processingChest = processingChestRes.value;
            log.info("Processing chest validated", { name: processingChestName });
        } else {
            log.warn("Processing chest not available, processing disabled", {
                name: processingChestName,
                code: processingChestRes.code,
            });
            // Reset name so we know it's not available
            processingChestName = undefined;
        }
    }

    // 7. Validate config consistency (unearther types exist, materials exist)
    for (const [id, unearther] of Object.entries(config.unearthers)) {
        const uType = config.uneartherTypes[unearther.type];
        if (!uType) {
            log.error("Unknown unearther type", { id, type: unearther.type });
            return err("ERR_UNKNOWN_UNEARTHER_TYPE", { id, type: unearther.type });
        }

        for (const matId of uType.supportedMaterials) {
            if (!config.materials[matId]) {
                log.error("Unknown material in unearther type", {
                    uneartherType: unearther.type,
                    material: matId,
                });
                return err("ERR_UNKNOWN_MATERIAL", { type: unearther.type, material: matId });
            }
        }
    }

    log.info("All peripherals validated successfully");

    return ok({
        modem,
        materialSource: materialSourceRes.value,
        materialSourceName,
        monitor,
        processingChest,
        processingChestName,
    });
}

/**
 * Wrap an unearther's input chest.
 * Call this during runtime when you need to interact with a specific chest.
 */
export function wrapUneartherChest(
    modem: WiredModemPeripheral,
    chestName: string,
): Result<InventoryPeripheral> {
    return wrapInventory(modem, chestName);
}

/**
 * Get the name of the material source for use in pushItems.
 */
export function getMaterialSourceName(config: AppConfig): string {
    return config.peripherals.materialSource.name;
}
