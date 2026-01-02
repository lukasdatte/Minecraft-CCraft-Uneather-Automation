// ============================================================
// PERIPHERAL TYPES
// ============================================================

/** Side names for local peripherals */
export type Side = "left" | "right" | "front" | "back" | "top" | "bottom";

/** Supported peripheral types for type-safe wrapping */
export type PeripheralType =
  | "drawer_controller"
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

/** Central peripheral registry */
export interface PeripheralRegistry {
  /** Wired modem on the computer (side name like "left", "right", etc.) */
  modem: PeripheralConfig;
  /** Central material source (drawer controller or chest) */
  materialSource: PeripheralConfig;
  /** Optional status monitor */
  monitor?: PeripheralConfig;
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
  /** Items per transfer (typically 64 for full stack) */
  transferStackSize: number;
  /** Logging verbosity */
  logLevel: LogLevel;
}

// ============================================================
// APP CONFIG (ROOT)
// ============================================================

/** Complete application configuration */
export interface AppConfig {
  /** Peripheral registry */
  peripherals: PeripheralRegistry;
  /** Material definitions */
  materials: MaterialRegistry;
  /** Unearther type definitions */
  uneartherTypes: UneartherTypeRegistry;
  /** Unearther instances */
  unearthers: UneartherRegistry;
  /** System settings */
  system: SystemConfig;
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
  /** Last scan timestamp */
  lastScanTime: number;
  /** Warnings to display */
  warnings: string[];
}

// ============================================================
// INVENTORY PERIPHERAL INTERFACE
// ============================================================

/** CC:Tweaked inventory item details */
export interface ItemDetail {
  name: string;
  count: number;
  nbt?: string;
}

/** CC:Tweaked inventory peripheral interface */
export interface InventoryPeripheral {
  /** List all items in the inventory */
  list(): LuaTable<number, ItemDetail>;
  /** Get the size of the inventory */
  size(): number;
  /** Push items to another inventory */
  pushItems(toName: string, fromSlot: number, limit?: number, toSlot?: number): number;
  /** Pull items from another inventory */
  pullItems(fromName: string, fromSlot: number, limit?: number, toSlot?: number): number;
  /** Get detailed item info for a slot */
  getItemDetail(slot: number): ItemDetail | null;
}

/** CC:Tweaked wired modem interface */
export interface WiredModem {
  /** Check if this is a wireless modem */
  isWireless(): boolean;
  /** Get names of all remote peripherals */
  getNamesRemote(): string[];
  /** Check if a remote peripheral is present */
  isPresentRemote(name: string): boolean;
  /** Get the local name of this modem on the network */
  getNameLocal(): string;
}

/** CC:Tweaked monitor interface */
export interface MonitorPeripheral {
  /** Write text at current cursor position */
  write(text: string): void;
  /** Clear the screen */
  clear(): void;
  /** Set cursor position */
  setCursorPos(x: number, y: number): void;
  /** Get monitor size */
  getSize(): LuaMultiReturn<[number, number]>;
  /** Set text color */
  setTextColor(color: number): void;
  /** Set background color */
  setBackgroundColor(color: number): void;
  /** Set text scale */
  setTextScale(scale: number): void;
}
