/**
 * All possible result codes for the application.
 * Used with the Result<T> pattern for type-safe error handling.
 */
export type ResultCode =
  // Success codes
  | "OK"
  | "OK_NOOP"

  // Peripheral errors
  | "ERR_PERIPHERAL_OFFLINE"
  | "ERR_PERIPHERAL_NOT_INVENTORY"
  | "ERR_PERIPHERAL_WRONG_TYPE"
  | "ERR_MODEM_MISSING"
  | "ERR_MODEM_WIRELESS"
  | "ERR_MATERIAL_SOURCE_MISSING"

  // Configuration errors
  | "ERR_CONFIG_INVALID"
  | "ERR_UNKNOWN_MATERIAL"
  | "ERR_UNKNOWN_UNEARTHER_TYPE"
  | "ERR_UNKNOWN_UNEARTHER"

  // Inventory/transfer errors
  | "ERR_INVENTORY_EMPTY"
  | "ERR_INSUFFICIENT_STOCK"
  | "ERR_TRANSFER_FAILED"
  | "ERR_NO_SLOT_FOUND"

  // Scan errors
  | "ERR_SCAN_FAILED"

  // Race condition errors
  | "ERR_SLOT_CHANGED"

  // General errors
  | "ERR_IO";

/**
 * Human-readable descriptions for error codes.
 * Useful for logging and display.
 */
export const ERROR_MESSAGES: Record<ResultCode, string> = {
  OK: "Success",
  OK_NOOP: "Success (no action needed)",

  ERR_PERIPHERAL_OFFLINE: "Peripheral is offline or not connected",
  ERR_PERIPHERAL_NOT_INVENTORY: "Peripheral does not have inventory methods",
  ERR_PERIPHERAL_WRONG_TYPE: "Peripheral type mismatch",
  ERR_MODEM_MISSING: "Wired modem not found on configured side",
  ERR_MODEM_WIRELESS: "Modem is wireless, wired modem required",
  ERR_MATERIAL_SOURCE_MISSING: "Material source (drawer/chest) not found",

  ERR_CONFIG_INVALID: "Configuration is invalid",
  ERR_UNKNOWN_MATERIAL: "Unknown material ID referenced",
  ERR_UNKNOWN_UNEARTHER_TYPE: "Unknown unearther type referenced",
  ERR_UNKNOWN_UNEARTHER: "Unknown unearther ID referenced",

  ERR_INVENTORY_EMPTY: "Inventory is empty",
  ERR_INSUFFICIENT_STOCK: "Insufficient stock (below minimum)",
  ERR_TRANSFER_FAILED: "Item transfer failed",
  ERR_NO_SLOT_FOUND: "No slot found containing the requested item",

  ERR_SCAN_FAILED: "Failed to scan inventory",

  ERR_SLOT_CHANGED: "Slot content changed before transfer (race condition)",

  ERR_IO: "I/O error",
};
