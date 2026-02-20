// Re-export Scheduler interface from orchestrator
export type { Scheduler } from "@lib/orchestrator/types";

/**
 * Definition of a material for scheduling.
 */
export interface MaterialDefinition {
    /** Internal material ID (e.g., "sand") */
    id: string;
    /** Minecraft item ID (e.g., "minecraft:sand") */
    itemId: string;
    /** Minimum stock to keep in reserve (won't take below this) */
    minStock: number;
    /** Weight for selection probability (higher = more likely) */
    weight: number;
}

/**
 * Definition of a machine type for scheduling.
 * Maps machine type IDs to the materials they can process.
 */
export interface MachineTypeDefinition {
    /** Machine type ID (e.g., "brusher") */
    id: string;
    /** Material IDs this type can process */
    supportedMaterials: string[];
}
