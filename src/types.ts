// ============================================================
// PERIPHERAL TYPES
// ============================================================

/** Side names for local peripherals */
export type Side = "left" | "right" | "front" | "back" | "top" | "bottom";

/** Supported peripheral types for type-safe wrapping */
export type PeripheralType =
  | "drawer_controller"
  | "inventory"
  | "chest"
  | "modem"
  | "monitor";

/** Configuration for a single peripheral */
export interface PeripheralConfig {
    /** CC:Tweaked peripheral name (e.g., "minecraft:chest_0") or side for local */
    name: string;
    /** Type for compile-time safety */
    type: PeripheralType;
}

// ============================================================
// MATERIAL TYPES
// ============================================================

/** Unique identifier for a material (e.g., "sand", "soul_sand") */
export type MaterialId = string;

/** Configuration for a single material type */
export interface MaterialConfig {
    /** Minecraft item ID (e.g., "minecraft:sand") */
    itemId: string;
    /** Minimum stock to keep in drawer (won't take below this) */
    minStock: number;
    /** Weight for round-robin selection (higher = more frequent) */
    weight: number;
}

/** Registry of all materials */
export type MaterialRegistry = Record<MaterialId, MaterialConfig>;

// ============================================================
// UNEARTHER TYPES
// ============================================================

/** Unique identifier for an unearther type (e.g., "brusher") */
export type UneartherTypeId = string;

/** Definition of an unearther type (what materials it can process) */
export interface UneartherTypeDefinition {
    /** List of material IDs this type can process */
    supportedMaterials: MaterialId[];
}

/** Registry of all unearther types */
export type UneartherTypeRegistry = Record<UneartherTypeId, UneartherTypeDefinition>;

/** Unique identifier for an unearther instance */
export type UneartherId = string;

/** Configuration for a single unearther instance */
export interface UneartherInstance {
    /** Unique identifier */
    id: UneartherId;
    /** Reference to unearther type */
    type: UneartherTypeId;
    /** CC:Tweaked peripheral name of the input chest */
    inputChest: string;
}

/** Registry of all unearther instances */
export type UneartherRegistry = Record<UneartherId, UneartherInstance>;

// ============================================================
// SYSTEM CONFIG
// ============================================================

/** Log level for the application */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** General system configuration */
export interface SystemConfig {
    /** How often to scan unearthers (in seconds) */
    scanIntervalSeconds: number;
    /** Logging verbosity */
    logLevel: LogLevel;
    /** Optional log file path for persistent logging */
    logFile?: string;
}

// ============================================================
// PROCESSING TYPES
// ============================================================

/** Stack size constant for quantity calculations */
export const STACK_SIZE = 64;

/**
 * Mapping of input item ID to output item ID for processing chains.
 * Key: Input Minecraft item ID (e.g., "minecraft:cobblestone")
 * Value: Output Minecraft item ID (e.g., "minecraft:dirt")
 */
export type ProcessingChain = Record<string, string>;

/** Configuration for material processing */
export interface ProcessingConfig {
    /** Whether processing is enabled */
    enabled: boolean;
    /**
     * Minimum items to keep in reserve for input material.
     * Processing will not occur if taking would drop below this.
     * Recommended: Use `n * STACK_SIZE` for stack-based values (e.g., `2 * STACK_SIZE` = 128 items).
     */
    minInputReserve: number;
    /**
     * Maximum items of output material before stopping processing.
     * Processing will not occur if output exceeds this.
     * Recommended: Use `n * STACK_SIZE` for stack-based values (e.g., `4 * STACK_SIZE` = 256 items).
     */
    maxOutputStock: number;
    /** Input -> Output material mappings */
    chain: ProcessingChain;
}

/** Result of a single processing operation */
export interface ProcessingResult {
    /** Input material that was processed */
    inputItemId: string;
    /** Output material expected */
    outputItemId: string;
    /** Number of items transferred to processing chest */
    itemsTransferred: number;
    /** Source slot used */
    sourceSlot: number;
}

// ============================================================
// TASK-SPECIFIC CONFIGS
// ============================================================

/**
 * Configuration for the Hammering Task.
 * Controls material processing (Cobblestone → Dirt → ...).
 */
export interface HammeringConfig {
    /** Task enabled? */
    enabled: boolean;

    /** Processing chest peripheral name */
    processingChest: PeripheralConfig;

    /** Minimum items to keep in reserve */
    minInputReserve: number;

    /** Maximum output before stopping */
    maxOutputStock: number;

    /** Processing chain: inputItemId → outputItemId */
    chain: ProcessingChain;
}

/**
 * Configuration for the Unearthing Task.
 * Controls material distribution to unearthers.
 */
export interface UnearthingConfig {
    /** Task enabled? */
    enabled: boolean;

    /** Material definitions */
    materials: MaterialRegistry;

    /** Unearther type definitions */
    uneartherTypes: UneartherTypeRegistry;

    /** Unearther instances */
    unearthers: UneartherRegistry;

    /** Items per transfer */
    transferStackSize: number;
}

/**
 * Container for all task configurations.
 */
export interface TaskConfigs {
    /** Hammering task (material processing) */
    hammering: HammeringConfig;

    /** Unearthing task (material distribution) */
    unearthing: UnearthingConfig;
}

// ============================================================
// TASK-SPECIFIC STATES
// ============================================================

/**
 * Runtime state for Hammering Task.
 */
export interface HammeringState {
    /** Number of processing operations since start */
    totalOperations: number;

    /** Last processing timestamp */
    lastProcessingTime: number;
}

/**
 * Runtime state for Unearthing Task.
 */
export interface UnearthingState {
    /** Status of each unearther */
    uneartherStatus: Record<string, {
        isEmpty: boolean;
        lastMaterial?: string;
        lastTransferTime?: number;
    }>;

    /** Number of transfers since start */
    totalTransfers: number;
}

// ============================================================
// GLOBAL PERIPHERAL REGISTRY (for task-based config)
// ============================================================

/**
 * Global peripherals shared by all tasks.
 * Task-specific peripherals (like processingChest) are in task configs.
 */
export interface GlobalPeripheralRegistry {
    /** Wired modem on the computer (side name) */
    modem: PeripheralConfig;
    /** Central material source (drawer controller or chest) */
    materialSource: PeripheralConfig;
    /** Optional status monitor */
    monitor?: PeripheralConfig;
}

// ============================================================
// APP CONFIG (ROOT)
// ============================================================

/** Complete application configuration */
export interface AppConfig {
    /** Global peripherals (shared by all tasks) */
    peripherals: GlobalPeripheralRegistry;

    /** System settings */
    system: SystemConfig;

    /** Task-specific configurations */
    tasks: TaskConfigs;
}

// ============================================================
// LEGACY TYPES (for compatibility during migration)
// ============================================================

/**
 * @deprecated Use GlobalPeripheralRegistry instead.
 * Kept for backwards compatibility with PeripheralRegistry class.
 */
export type PeripheralRegistryConfig = PeripheralRegistry;

/** Legacy peripheral registry with optional processing chest */
export interface PeripheralRegistry {
    /** Wired modem on the computer (side name like "left", "right", etc.) */
    modem: PeripheralConfig;
    /** Central material source (drawer controller or chest) */
    materialSource: PeripheralConfig;
    /** Optional status monitor */
    monitor?: PeripheralConfig;
    /** Optional processing chest for material transformation chain */
    processingChest?: PeripheralConfig;
}

// ============================================================
// RUNTIME TYPES
// ============================================================

/** Inventory slot information */
export interface SlotInfo {
    name: string;
    count: number;
    slot: number;
}

/** Drawer/chest contents mapped by item ID */
export type InventoryContents = Map<string, SlotInfo[]>;

/**
 * Information about a single item type in an inventory.
 * Used by scanner and processing modules.
 */
export interface InventoryItemInfo {
    /** Total count of this item across all slots */
    totalCount: number;
    /** Slot numbers containing this item */
    slots: number[];
}

/** Status of a single unearther */
export interface UneartherStatus {
    id: UneartherId;
    isEmpty: boolean;
    lastMaterial?: MaterialId;
    lastTransferTime?: number;
}

/** Application runtime state */
export interface AppState {
    /** Status of each unearther */
    uneartherStatus: Record<UneartherId, UneartherStatus>;
    /** Total transfers since start */
    totalTransfers: number;
    /** Total processing operations since start */
    totalProcessingOps: number;
    /** Last scan timestamp */
    lastScanTime: number;
    /** Warnings to display */
    warnings: string[];
}

// ============================================================
// CC:TWEAKED PERIPHERAL TYPES - RE-EXPORTED FROM craftos-types
// ============================================================
// IMPORTANT: Do NOT define custom peripheral interfaces here!
// Use the types from @jackmacwindows/craftos-types which have
// proper @noSelf annotations for TSTL compatibility.
// See CLAUDE.md for details on why this matters.
