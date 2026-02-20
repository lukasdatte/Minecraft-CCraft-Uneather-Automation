import { DashboardWidget } from "../types";

// MonitorPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Header widget showing system title, cycle count, and uptime.
 */
export class HeaderWidget implements DashboardWidget {
    id = "header";
    order = 0;

    private title: string;
    private cycleCount = 0;
    private startTime = 0;

    constructor(title: string) {
        this.title = title;
    }

    /** Update cycle data before render */
    update(cycleCount: number, startTime: number): void {
        this.cycleCount = cycleCount;
        this.startTime = startTime;
    }

    render(monitor: MonitorPeripheral, y: number, _width: number): number {
        monitor.setTextColor(colors.yellow);
        monitor.setCursorPos(1, y);
        monitor.write(`=== ${this.title} ===`);
        y++;

        monitor.setTextColor(colors.white);
        monitor.setCursorPos(1, y);
        const uptime = this.formatUptime(this.startTime);
        monitor.write(`Cycle: ${this.cycleCount} | Up: ${uptime}`);
        y += 2;

        return y;
    }

    private formatUptime(startTime: number): string {
        const elapsed = math.floor((os.epoch("utc") - startTime) / 1000);
        const hours = math.floor(elapsed / 3600);
        const minutes = math.floor((elapsed % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
}
