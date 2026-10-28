import { DashboardWidget } from "../types";
import { InventoryItemInfo } from "@lib/inventory/types";

// MonitorPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Entry for displaying a stock item.
 */
export interface StockEntry {
    /** Display name (e.g., "sand", "gravel") */
    name: string;
    /** Minecraft item ID for inventory lookup */
    itemId: string;
    /** Reference stock level (targetCount for production, minStock for distribution) */
    minStock: number;
    /** If true, uses 4-color production logic (green/yellow/red/white) */
    isProductionOutput?: boolean;
}

/**
 * Stock table widget showing material inventory levels.
 *
 * Production items use 4-color status:
 * - Green: target reached
 * - Yellow: actively being produced (items in hammer chests)
 * - Red: input below craftingMinimum (can't produce)
 * - White: idle, could produce
 *
 * Non-production items use simple red/white based on minStock.
 */
export class StockTableWidget implements DashboardWidget {
    id = "stock-table";
    order = 10;

    private entries: StockEntry[] = [];
    private inventory = new Map<string, InventoryItemInfo>();
    /** Map of output itemId -> count of items in hammer chests being processed into this output */
    private inProduction = new Map<string, number>();
    /** Set of output itemIds that are blocked (input below craftingMinimum) */
    private blockedOutputs = new Set<string>();

    /** Set stock entries to display */
    setEntries(entries: StockEntry[]): void {
        this.entries = entries;
    }

    /** Update inventory data before render */
    updateInventory(inventory: Map<string, InventoryItemInfo>): void {
        this.inventory = inventory;
    }

    /** Update production status: which outputs are being produced and which are blocked */
    updateProductionStatus(
        inProduction: Map<string, number>,
        blockedOutputs: Set<string>,
    ): void {
        this.inProduction = inProduction;
        this.blockedOutputs = blockedOutputs;
    }

    render(monitor: MonitorPeripheral, y: number, _width: number): number {
        monitor.setTextColor(colors.yellow);
        monitor.setCursorPos(1, y);
        monitor.write("--- Stock ---");
        y++;

        for (const entry of this.entries) {
            const itemInfo = this.inventory.get(entry.itemId);
            const count = itemInfo ? itemInfo.totalCount : 0;

            monitor.setCursorPos(1, y);

            let statusText = "";
            if (entry.isProductionOutput) {
                const status = this.getProductionStatus(entry, count);
                monitor.setTextColor(status.color);
                statusText = status.label;
            } else {
                monitor.setTextColor(count < entry.minStock ? colors.red : colors.white);
            }

            const name = this.shortenName(entry.name, 16);
            const countStr = this.formatNumber(count);
            const minStr = this.formatNumber(entry.minStock);
            const suffix = statusText ? ` ${statusText}` : "";
            monitor.write(`${name} ${countStr}  (min: ${minStr})${suffix}`);
            y++;
        }

        y++;
        return y;
    }

    /** Determine color and status label for a production output item */
    private getProductionStatus(entry: StockEntry, count: number): { color: number; label: string } {
        if (count >= entry.minStock) {
            return { color: colors.green, label: "DONE" };
        }
        const producing = this.inProduction.get(entry.itemId) ?? 0;
        if (producing > 0) {
            return { color: colors.yellow, label: "PROD" };
        }
        if (this.blockedOutputs.has(entry.itemId)) {
            return { color: colors.red, label: "BLOCKED" };
        }
        return { color: colors.white, label: "IDLE" };
    }

    private formatNumber(n: number): string {
        const s = tostring(n);
        const pad = 6 - s.length;
        return pad > 0 ? string.rep(" ", pad) + s : s;
    }

    private shortenName(name: string, maxLen: number): string {
        if (name.length > maxLen) {
            return string.sub(name, 1, maxLen);
        }
        return name + string.rep(" ", maxLen - name.length);
    }
}
