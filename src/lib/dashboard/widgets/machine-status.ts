import { DashboardWidget } from "../types";

// MonitorPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Status of a single machine for display.
 */
export interface MachineDisplayStatus {
    /** Machine ID */
    id: string;
    /** Whether the machine's input is empty */
    isEmpty: boolean;
    /** Item currently in the chest (undefined if empty) */
    currentItem?: string;
    /** Count of items currently in the chest */
    currentCount?: number;
}

/**
 * Machine status widget showing machine states with chest contents.
 */
export class MachineStatusWidget implements DashboardWidget {
    id: string;
    order: number;

    private title: string;
    private machines: MachineDisplayStatus[] = [];

    constructor(id: string, title: string, order: number) {
        this.id = id;
        this.title = title;
        this.order = order;
    }

    /** Update machine status data before render */
    update(machines: MachineDisplayStatus[]): void {
        this.machines = machines;
    }

    render(monitor: MonitorPeripheral, y: number, _width: number): number {
        monitor.setTextColor(colors.yellow);
        monitor.setCursorPos(1, y);
        monitor.write(`--- ${this.title} ---`);
        y++;

        for (const machine of this.machines) {
            monitor.setCursorPos(1, y);

            if (machine.isEmpty) {
                monitor.setTextColor(colors.yellow);
                monitor.write(`${this.padRight(machine.id, 20)} EMPTY`);
            } else {
                monitor.setTextColor(colors.green);
                const itemName = this.extractShortName(machine.currentItem ?? "unknown");
                const countStr = machine.currentCount ? `${machine.currentCount}x ` : "";
                monitor.write(`${this.padRight(machine.id, 20)} ${countStr}${itemName}`);
            }
            y++;
        }

        y++;
        return y;
    }

    /** Extract short name from item ID: "minecraft:cobblestone" -> "cobblestone" */
    private extractShortName(itemId: string): string {
        const parts = itemId.split(":");
        return parts[1] ?? itemId;
    }

    private padRight(s: string, width: number): string {
        if (s.length >= width) return string.sub(s, 1, width);
        return s + string.rep(" ", width - s.length);
    }
}
