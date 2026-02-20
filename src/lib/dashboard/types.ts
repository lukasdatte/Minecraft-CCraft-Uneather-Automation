// MonitorPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * A single dashboard widget that renders a section of the monitor.
 */
export interface DashboardWidget {
    /** Unique widget identifier */
    id: string;
    /** Display order (lower = renders first) */
    order: number;
    /**
     * Render this widget on the monitor.
     *
     * @param monitor - The monitor peripheral to render on
     * @param y - Starting y position
     * @param width - Available width in characters
     * @returns Next y position after this widget
     */
    render(monitor: MonitorPeripheral, y: number, width: number): number;
}
