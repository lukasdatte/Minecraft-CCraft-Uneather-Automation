import { PeripheralConfig, Side } from "@lib/peripheral/types";
import { ProductionConfig } from "@apps/production/types";
import { DistributionConfig } from "@apps/distribution/types";

/**
 * System-level configuration.
 */
export interface SystemConfig {
    scanIntervalSeconds: number;
    logLevel: "debug" | "info" | "warn" | "error";
    logFile?: string;
    maxLogLines?: number;
}

/**
 * Global peripherals shared by all tasks.
 */
export interface GlobalPeripherals {
    modem: { name: Side; type: "modem" };
    materialSource: PeripheralConfig;
    monitor?: PeripheralConfig;
}

/**
 * Complete application configuration for this entry point.
 */
export interface AppConfig {
    peripherals: GlobalPeripherals;
    system: SystemConfig;
    production: ProductionConfig;
    distribution: DistributionConfig;
}
