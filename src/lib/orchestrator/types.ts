import { InventoryItemInfo } from "@lib/inventory/types";

/**
 * Configuration for a single machine (unearther, hammer, etc.).
 */
export interface MachineConfig {
    /** Unique machine identifier */
    id: string;
    /** Machine type (e.g., "hammer", "brusher") */
    type: string;
    /** CC:Tweaked peripheral name of the input chest */
    inputChest: string;
}

/**
 * Runtime state of a single machine.
 */
export interface MachineState {
    /** Unique machine identifier */
    id: string;
    /** Machine type */
    type: string;
    /** CC:Tweaked peripheral name of the input chest */
    inputChest: string;
    /** Whether the input chest is empty (machine needs refill) */
    isEmpty: boolean;
}

/**
 * Assignment: what to put into which machine.
 * Created by a Scheduler, executed by the Orchestrator.
 */
export interface Assignment {
    /** Target machine ID */
    machineId: string;
    /** Target chest peripheral name (for pushItems) */
    targetChest: string;
    /** Minecraft item ID to transfer */
    itemId: string;
    /** Source slot in material source */
    sourceSlot: number;
    /** Number of items to transfer */
    amount: number;
}

/**
 * Scheduler interface.
 * Takes machine states + inventory and decides what goes where.
 * Different implementations for different strategies (stock-based, weighted, etc.).
 */
export interface Scheduler {
    /**
     * Create assignments for empty machines.
     *
     * @param machines - Current state of all machines (including non-empty ones for context)
     * @param inventory - Current inventory contents
     * @returns List of assignments to execute
     */
    schedule(
        machines: MachineState[],
        inventory: Map<string, InventoryItemInfo>,
    ): Assignment[];
}

/**
 * Result of a single orchestrator transfer.
 */
export interface OrchestratorTransferResult {
    /** Machine that received items */
    machineId: string;
    /** Item that was transferred */
    itemId: string;
    /** Number of items transferred */
    itemsTransferred: number;
    /** Source slot used */
    sourceSlot: number;
}

/**
 * Combined result of an orchestrator run cycle.
 * Includes both machine states (from scanning) and transfer results.
 */
export interface OrchestratorRunResult {
    /** Scanned machine states (with real isEmpty) */
    machineStates: MachineState[];
    /** Transfer results */
    transfers: OrchestratorTransferResult[];
}
