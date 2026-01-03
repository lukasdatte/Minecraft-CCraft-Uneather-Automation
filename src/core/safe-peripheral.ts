import { Logger } from "./logger";
import { Result, ok, err } from "./result";

/**
 * Generic wrapper for any CC:Tweaked peripheral that provides:
 * - Try/catch around all operations
 * - Explicit connection check and reconnect via ensureConnected()
 *
 * NO automatic retry - caller controls when to reconnect.
 *
 * @template T - The peripheral type (InventoryPeripheral, MonitorPeripheral, etc.)
 */
export class SafePeripheral<T> {
    private wrappedPeripheral: T;

    constructor(
        private readonly modem: WiredModemPeripheral,
        private readonly peripheralName: string,
        initialPeripheral: T,
        private readonly log: Logger,
    ) {
        this.wrappedPeripheral = initialPeripheral;
    }

    /**
     * Check if peripheral is connected to the wired network.
     * Performs actual check via modem.getNamesRemote().
     */
    isConnected(): boolean {
        try {
            const remotes = this.modem.getNamesRemote();
            if (!remotes) return false;
            for (const [, name] of pairs(remotes)) {
                if (name === this.peripheralName) return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Ensure peripheral is connected. If not, try to reconnect.
     * Caller should call this BEFORE critical operations.
     *
     * @returns true if connected (or successfully reconnected), false otherwise
     */
    ensureConnected(): boolean {
        // Actual connection check via modem
        if (this.isConnected()) {
            return true;
        }

        // Not connected - try to reconnect
        return this.tryReconnect();
    }

    /**
     * Execute an operation with try/catch protection.
     * NO automatic reconnect - caller should call ensureConnected() before if needed.
     *
     * @param operation - Function that receives the peripheral and returns a value
     * @param fallback - Value to return if operation fails
     * @returns The operation result, or fallback on failure
     */
    call<R>(operation: (p: T) => R, fallback: R): R {
        try {
            return operation(this.wrappedPeripheral);
        } catch (e) {
            this.log.warn("Peripheral operation failed", {
                name: this.peripheralName,
                error: String(e),
            });
            return fallback;
        }
    }

    /**
     * Execute an operation with try/catch protection.
     * Returns Result for explicit error handling.
     * NO automatic reconnect - caller should call ensureConnected() before if needed.
     *
     * @param operation - Function that receives the peripheral and returns a value
     * @returns Result with the value on success, or error on failure
     */
    tryCall<R>(operation: (p: T) => R): Result<R> {
        try {
            return ok(operation(this.wrappedPeripheral));
        } catch (e) {
            return err("ERR_PERIPHERAL_DISCONNECTED", {
                name: this.peripheralName,
                error: String(e),
            });
        }
    }

    /**
     * Get the peripheral name (for pushItems target, logging, etc.)
     */
    getName(): string {
        return this.peripheralName;
    }

    /**
     * Get direct access to the underlying peripheral.
     * Use with caution - no error protection!
     */
    unwrap(): T {
        return this.wrappedPeripheral;
    }

    // ========================================
    // Private methods
    // ========================================

    /**
     * Try to re-wrap the peripheral after disconnect/reconnect.
     * Returns true if successful.
     */
    private tryReconnect(): boolean {
        try {
            const raw = peripheral.wrap(this.peripheralName) as T | undefined;
            if (raw) {
                this.wrappedPeripheral = raw;
                this.log.info("Peripheral reconnected", { name: this.peripheralName });
                return true;
            }
        } catch {
            // Wrap failed
        }
        return false;
    }
}

/**
 * Wrap an existing peripheral in a SafePeripheral.
 */
export function wrapPeripheral<T>(
    modem: WiredModemPeripheral,
    name: string,
    wrappedPeripheral: T,
    log: Logger,
): SafePeripheral<T> {
    return new SafePeripheral(modem, name, wrappedPeripheral, log);
}
