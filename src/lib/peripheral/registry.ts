import { Result, ok, err, forwardErr } from "@core/result";
import { Logger } from "@core/logger";
import { SafePeripheral, wrapPeripheral } from "@core/safe-peripheral";
import {
    Side,
    ValidatedPeripherals,
    PeripheralValidationRequest,
} from "./types";

// Types from @jackmacwindows/craftos-types are globally declared

/**
 * Generic peripheral validator.
 * Validates modem, material source, monitor, and a list of chest names.
 * Has NO task-specific knowledge.
 */
export function validatePeripherals(
    req: PeripheralValidationRequest,
    log: Logger,
): Result<ValidatedPeripherals> {
    log.info("Validating peripherals...");

    // 1. Get wired modem
    const modemRes = getWiredModem(req.modemSide);
    if (!modemRes.ok) {
        log.error("Failed to get wired modem", { side: req.modemSide, code: modemRes.code });
        return forwardErr(modemRes);
    }
    const modem = modemRes.value;
    log.debug("Wired modem found", { side: req.modemSide });

    // 2. List remote peripherals for debugging
    const remotes = modem.getNamesRemote();
    log.debug("Remote peripherals found", { count: remotes.length, names: remotes });

    // 3. Validate material source
    const materialSourceRes = validateInventory(modem, req.materialSourceName, log);
    if (!materialSourceRes.ok) {
        log.error("Failed to get material source", {
            name: req.materialSourceName,
            code: materialSourceRes.code,
        });
        return forwardErr(materialSourceRes);
    }
    const materialSource = materialSourceRes.value;
    log.info("Material source validated", { name: req.materialSourceName });

    // 4. Validate all chests
    const machineChests = new Map<string, SafePeripheral<InventoryPeripheral>>();
    for (const chestName of req.chestNames) {
        const chestRes = validateInventory(modem, chestName, log);
        if (!chestRes.ok) {
            log.warn("Chest not available at boot", {
                chest: chestName,
                code: chestRes.code,
            });
            continue;
        }
        machineChests.set(chestName, chestRes.value);
        log.debug("Chest validated", { chest: chestName });
    }

    // 5. Validate monitor (optional)
    let monitor: SafePeripheral<MonitorPeripheral> | undefined;
    if (req.monitorName) {
        const monitorRes = validateMonitor(modem, req.monitorName, log);
        if (monitorRes.ok) {
            monitor = monitorRes.value;
            log.info("Monitor validated", { name: req.monitorName });
        } else {
            log.warn("Monitor not available, continuing without", {
                name: req.monitorName,
                code: monitorRes.code,
            });
        }
    }

    log.info("All peripherals validated successfully", {
        machineChests: machineChests.size,
        hasMonitor: !!monitor,
    });

    return ok({
        modem,
        materialSource,
        monitor,
        machineChests,
    });
}

/**
 * Check if a remote peripheral is present using getNamesRemote.
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
 * Retry connecting chests that were missing at boot.
 * Checks all chest names and adds any newly available ones to the map.
 *
 * @returns Number of recovered chests
 */
export function retryMissingChests(
    modem: WiredModemPeripheral,
    allChestNames: string[],
    existingChests: Map<string, SafePeripheral<InventoryPeripheral>>,
    log: Logger,
): number {
    let recovered = 0;
    for (const name of allChestNames) {
        if (existingChests.has(name)) continue;
        const res = validateInventory(modem, name, log);
        if (res.ok) {
            existingChests.set(name, res.value);
            log.info("Recovered peripheral", { chest: name });
            recovered++;
        }
    }
    return recovered;
}

// ========================================
// Private helpers
// ========================================

function getWiredModem(side: Side): Result<WiredModemPeripheral> {
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

function validateInventory(
    modem: WiredModemPeripheral,
    name: string,
    log: Logger,
): Result<SafePeripheral<InventoryPeripheral>> {
    if (!isRemotePresent(modem, name)) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    const inv = peripheral.wrap(name) as InventoryPeripheral | undefined;
    if (!inv) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    if (typeof inv.list !== "function" || typeof inv.pushItems !== "function") {
        return err("ERR_PERIPHERAL_NOT_INVENTORY", { name });
    }

    return ok(wrapPeripheral(modem, name, inv, log));
}

function validateMonitor(
    modem: WiredModemPeripheral,
    name: string,
    log: Logger,
): Result<SafePeripheral<MonitorPeripheral>> {
    if (!isRemotePresent(modem, name)) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    const mon = peripheral.wrap(name) as MonitorPeripheral | undefined;
    if (!mon) {
        return err("ERR_PERIPHERAL_OFFLINE", { name });
    }

    if (typeof mon.write !== "function" || typeof mon.clear !== "function") {
        return err("ERR_PERIPHERAL_WRONG_TYPE", { name, expected: "monitor" });
    }

    return ok(wrapPeripheral(modem, name, mon, log));
}
