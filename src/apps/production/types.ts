import { MachineConfig } from "@lib/orchestrator/types";
import { RecipeDefinition, StockTarget } from "@lib/scheduler/stock-based";

/**
 * Configuration for the Production application.
 */
export interface ProductionConfig {
    /** Task enabled? */
    enabled: boolean;

    /** Machines used for production */
    machines: MachineConfig[];

    /** Recipes per machine type */
    recipes: Record<string, RecipeDefinition[]>;

    /** Stock targets for output materials */
    stockTargets: StockTarget[];

    /** Items per transfer */
    transferAmount: number;
}

/**
 * Runtime state for the Production application.
 */
export interface ProductionState {
    /** Total processing operations since start */
    totalOperations: number;

    /** Total items transferred since start */
    totalTransferred: number;

    /** Last processing timestamp */
    lastProcessingTime: number;

    /** Status of each machine */
    machineStatus: Record<string, {
        isEmpty: boolean;
        currentItem?: string;
        currentCount?: number;
    }>;
}
