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
  | "ERR_PERIPHERAL_DISCONNECTED"
  | "ERR_PERIPHERAL_NOT_INVENTORY"
  | "ERR_PERIPHERAL_WRONG_TYPE"
  | "ERR_MODEM_MISSING"
  | "ERR_MODEM_WIRELESS"

  // Transfer errors
  | "ERR_TRANSFER_FAILED"
  | "ERR_SLOT_CHANGED"

  // Scan errors
  | "ERR_SCAN_FAILED"

  // General errors
  | "ERR_CONFIG_INVALID"
  | "ERR_IO";
