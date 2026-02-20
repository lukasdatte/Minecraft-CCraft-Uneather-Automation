import { SafePeripheral } from "@core/safe-peripheral";

// Types from @jackmacwindows/craftos-types are globally declared

/** Side names for local peripherals */
export type Side = "left" | "right" | "front" | "back" | "top" | "bottom";

/** Configuration for a single peripheral */
export interface PeripheralConfig {
    /** CC:Tweaked peripheral name (e.g., "minecraft:chest_0") or side for local */
    name: string;
    /** Type for compile-time safety */
    type: string;
}

/**
 * Generic validated peripherals.
 * Task-agnostic: only knows about modem, material source, monitor, and generic chests.
 */
export interface ValidatedPeripherals {
    modem: WiredModemPeripheral;
    materialSource: SafePeripheral<InventoryPeripheral>;
    monitor?: SafePeripheral<MonitorPeripheral>;
    /** All machine/chest peripherals keyed by their CC:Tweaked name */
    machineChests: Map<string, SafePeripheral<InventoryPeripheral>>;
}

/**
 * Input for peripheral validation.
 * Describes what peripherals to validate without task-specific knowledge.
 */
export interface PeripheralValidationRequest {
    /** Modem side (e.g., "left") */
    modemSide: Side;
    /** Material source peripheral name */
    materialSourceName: string;
    /** Optional monitor peripheral name */
    monitorName?: string;
    /** List of chest peripheral names to validate */
    chestNames: string[];
}
