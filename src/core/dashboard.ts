import { SafePeripheral } from "./safe-peripheral";
import {
    InventoryItemInfo,
    MaterialRegistry,
    UneartherRegistry,
    HammeringState,
    UnearthingState,
} from "../types";

// MonitorPeripheral from @jackmacwindows/craftos-types is globally declared

/** Data required to render the dashboard */
export interface DashboardData {
    inventory: Map<string, InventoryItemInfo>;
    materials: MaterialRegistry;
    hammeringState: HammeringState | null;
    unearthingState: UnearthingState | null;
    unearthers: UneartherRegistry;
    cycleCount: number;
    startTime: number;
}

/**
 * Dashboard renders a status overview on a CC:Tweaked monitor.
 *
 * Layout:
 *   Header, Stock table, Unearthers status, Hammering stats.
 *   Redraws completely each cycle (no flicker on external monitors).
 */
export class Dashboard {
    constructor(private monitor: SafePeripheral<MonitorPeripheral>) {
        // Initialize monitor scale
        monitor.call((m) => {
            m.setTextScale(0.5);
            m.clear();
        }, undefined);
    }

    update(data: DashboardData): void {
        this.monitor.ensureConnected();
        this.monitor.call((m) => {
            m.clear();
            let y = 1;

            // === Header ===
            m.setTextColor(colors.yellow);
            m.setCursorPos(1, y);
            m.write("=== Unearther Distribution System ===");
            y++;

            m.setTextColor(colors.white);
            m.setCursorPos(1, y);
            const uptime = this.formatUptime(data.startTime);
            m.write(`Cycle: ${data.cycleCount} | Up: ${uptime}`);
            y += 2;

            // === Stock ===
            m.setTextColor(colors.yellow);
            m.setCursorPos(1, y);
            m.write("--- Stock ---");
            y++;

            for (const [matId, matConfig] of Object.entries(data.materials)) {
                const itemInfo = data.inventory.get(matConfig.itemId);
                const count = itemInfo ? itemInfo.totalCount : 0;
                const belowMin = count < matConfig.minStock;

                m.setCursorPos(1, y);
                m.setTextColor(belowMin ? colors.red : colors.white);

                const name = this.shortenName(matId, 16);
                const countStr = this.formatNumber(count);
                const minStr = this.formatNumber(matConfig.minStock);
                m.write(`${name} ${countStr}  (min: ${minStr})`);
                y++;
            }

            y++;

            // === Unearthers ===
            m.setTextColor(colors.yellow);
            m.setCursorPos(1, y);
            m.write("--- Unearthers ---");
            y++;

            for (const [uId] of Object.entries(data.unearthers)) {
                m.setCursorPos(1, y);

                const status = data.unearthingState?.uneartherStatus[uId];
                const isEmpty = status?.isEmpty ?? true;
                const lastMat = status?.lastMaterial;

                if (isEmpty) {
                    m.setTextColor(colors.yellow);
                    const suffix = lastMat ? `  (last: ${lastMat})` : "";
                    m.write(`${this.padRight(uId, 20)} EMPTY${suffix}`);
                } else {
                    m.setTextColor(colors.green);
                    const suffix = lastMat ? `  (last: ${lastMat})` : "";
                    m.write(`${this.padRight(uId, 20)} FULL${suffix}`);
                }
                y++;
            }

            y++;

            // === Hammering ===
            if (data.hammeringState) {
                m.setTextColor(colors.yellow);
                m.setCursorPos(1, y);
                m.write("--- Hammering ---");
                y++;

                m.setTextColor(colors.white);
                m.setCursorPos(1, y);

                const ops = data.hammeringState.totalOperations;
                const lastTime = data.hammeringState.lastProcessingTime;
                const agoStr = lastTime > 0 ? this.formatAgo(lastTime) : "never";
                m.write(`Ops: ${ops} | Last: ${agoStr}`);
            }
        }, undefined);
    }

    // ========================================
    // Private helpers
    // ========================================

    private formatUptime(startTime: number): string {
        const elapsed = math.floor((os.epoch("utc") - startTime) / 1000);
        const hours = math.floor(elapsed / 3600);
        const minutes = math.floor((elapsed % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    private formatAgo(timestamp: number): string {
        const elapsed = math.floor((os.epoch("utc") - timestamp) / 1000);
        if (elapsed < 60) return `${elapsed}s ago`;
        const minutes = math.floor(elapsed / 60);
        return `${minutes}m ago`;
    }

    private formatNumber(n: number): string {
        // Right-align to 6 chars
        const s = tostring(n);
        const pad = 6 - s.length;
        return pad > 0 ? string.rep(" ", pad) + s : s;
    }

    private shortenName(name: string, maxLen: number): string {
        if (name.length > maxLen) {
            return string.sub(name, 1, maxLen);
        }
        // Pad with spaces to align columns
        return name + string.rep(" ", maxLen - name.length);
    }

    private padRight(s: string, width: number): string {
        if (s.length >= width) return string.sub(s, 1, width);
        return s + string.rep(" ", width - s.length);
    }
}
