import { Logger } from "./logger";
import { Result, ok, err } from "./result";

/**
 * Generic wrapper for any CC:Tweaked peripheral that provides:
 * - Try/catch around all operations
 * - Automatic re-wrap after disconnect/reconnect (lazy recovery)
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

    /**
     * Execute an operation with try/catch and automatic reconnect retry.
     *
     * @param operation - Function that receives the peripheral and returns a value
     * @param fallback - Value to return if operation fails
     * @returns The operation result, or fallback on failure
     */
    call<R>(operation: (p: T) => R, fallback: R): R {
        // First attempt
        try {
            return operation(this.wrappedPeripheral);
        } catch (e) {
            // Try to reconnect and retry once
            if (this.tryReconnect()) {
                try {
                    return operation(this.wrappedPeripheral);
                } catch {
                    // Still failed after re-wrap
                }
            }
            this.log.warn("Peripheral operation failed", {
                name: this.peripheralName,
                error: String(e),
            });
            return fallback;
        }
    }

    /**
     * Execute an operation with try/catch and automatic reconnect retry.
     * Returns Result for explicit error handling.
     *
     * @param operation - Function that receives the peripheral and returns a value
     * @returns Result with the value on success, or error on failure
     */
    tryCall<R>(operation: (p: T) => R): Result<R> {
        // First attempt
        try {
            return ok(operation(this.wrappedPeripheral));
        } catch (e) {
            // Try to reconnect and retry once
            if (this.tryReconnect()) {
                try {
                    return ok(operation(this.wrappedPeripheral));
                } catch {
                    // Still failed after re-wrap
                }
            }
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
