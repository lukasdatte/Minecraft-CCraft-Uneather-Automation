import { SafePeripheral } from "@core/safe-peripheral";
import { DashboardWidget } from "./types";

// MonitorPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Widget-based dashboard renderer.
 * Widgets register themselves and are rendered in order.
 */
export class DashboardRenderer {
    private widgets: DashboardWidget[] = [];

    constructor(private monitor: SafePeripheral<MonitorPeripheral>) {
        monitor.ensureConnected();
        monitor.call((m) => {
            m.setTextScale(0.5);
            m.clear();
        }, undefined);
    }

    /**
     * Register a widget.
     */
    addWidget(widget: DashboardWidget): void {
        this.widgets.push(widget);
        this.widgets.sort((a, b) => a.order - b.order);
    }

    /**
     * Render all widgets.
     */
    render(): void {
        this.monitor.ensureConnected();
        this.monitor.call((m) => {
            m.clear();
            const [width, height] = m.getSize();
            let y = 1;

            for (const widget of this.widgets) {
                if (y > height) break;
                y = widget.render(m, y, width);
            }
        }, undefined);
    }
}
