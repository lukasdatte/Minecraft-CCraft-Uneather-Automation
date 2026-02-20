import { MachineConfig } from "@lib/orchestrator/types";
import { MaterialDefinition, MachineTypeDefinition } from "@lib/scheduler/types";

/**
 * Configuration for the Distribution application.
 */
export interface DistributionConfig {
    /** Task enabled? */
    enabled: boolean;

    /** Machines to distribute materials to */
    machines: MachineConfig[];

    /** Material definitions */
    materials: Record<string, MaterialDefinition>;

    /** Machine type definitions */
    machineTypes: Record<string, MachineTypeDefinition>;

    /** Items per transfer */
    transferAmount: number;
}

/**
 * Runtime state for the Distribution application.
 */
export interface DistributionState {
    /** Status of each machine */
    machineStatus: Record<string, {
        isEmpty: boolean;
    }>;

    /** Total transfers since start */
    totalTransfers: number;
}
