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
    /** Last material assigned (optional) */
    lastMaterial?: string;
}

/**
 * Machine status widget showing machine states (EMPTY/FULL).
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
                const suffix = machine.lastMaterial ? `  (last: ${machine.lastMaterial})` : "";
                monitor.write(`${this.padRight(machine.id, 20)} EMPTY${suffix}`);
            } else {
                monitor.setTextColor(colors.green);
                const suffix = machine.lastMaterial ? `  (last: ${machine.lastMaterial})` : "";
                monitor.write(`${this.padRight(machine.id, 20)} FULL${suffix}`);
            }
            y++;
        }

        y++;
        return y;
    }

    private padRight(s: string, width: number): string {
        if (s.length >= width) return string.sub(s, 1, width);
        return s + string.rep(" ", width - s.length);
    }
}
