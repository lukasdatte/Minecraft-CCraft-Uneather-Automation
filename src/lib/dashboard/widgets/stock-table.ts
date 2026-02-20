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
    /** Minimum stock level (shown as reference) */
    minStock: number;
}

/**
 * Stock table widget showing material inventory levels.
 */
export class StockTableWidget implements DashboardWidget {
    id = "stock-table";
    order = 10;

    private entries: StockEntry[] = [];
    private inventory = new Map<string, InventoryItemInfo>();

    /** Set stock entries to display */
    setEntries(entries: StockEntry[]): void {
        this.entries = entries;
    }

    /** Update inventory data before render */
    updateInventory(inventory: Map<string, InventoryItemInfo>): void {
        this.inventory = inventory;
    }

    render(monitor: MonitorPeripheral, y: number, _width: number): number {
        monitor.setTextColor(colors.yellow);
        monitor.setCursorPos(1, y);
        monitor.write("--- Stock ---");
        y++;

        for (const entry of this.entries) {
            const itemInfo = this.inventory.get(entry.itemId);
            const count = itemInfo ? itemInfo.totalCount : 0;
            const belowMin = count < entry.minStock;

            monitor.setCursorPos(1, y);
            monitor.setTextColor(belowMin ? colors.red : colors.white);

            const name = this.shortenName(entry.name, 16);
            const countStr = this.formatNumber(count);
            const minStr = this.formatNumber(entry.minStock);
            monitor.write(`${name} ${countStr}  (min: ${minStr})`);
            y++;
        }

        y++;
        return y;
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
