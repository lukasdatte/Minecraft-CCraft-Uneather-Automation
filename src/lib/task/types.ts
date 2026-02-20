import { Result } from "@core/result";
import { Logger } from "@core/logger";
import { InventoryItemInfo } from "@lib/inventory/types";
import { ValidatedPeripherals } from "@lib/peripheral/types";

// ============================================================
// TASK INTERFACE
// ============================================================

/**
 * Task<TConfig, TState> - Generic task interface.
 *
 * TConfig = Task-specific configuration
 * TState  = Task-specific runtime state
 */
export interface Task<TConfig, TState> {
    /** Unique task ID (e.g., "production", "distribution") */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /**
     * Initialize the task.
     * Called once at startup.
     */
    init(context: TaskContext, config: TConfig): Result<TState>;

    /**
     * Execute one cycle.
     * Called in every main loop iteration.
     */
    execute(
        state: TState,
        inventory: Map<string, InventoryItemInfo>,
    ): Result<TaskExecutionResult<TState>>;

    /**
     * Generate startup diagnostics.
     */
    getDiagnostics(config: TConfig): TaskDiagnostics;
}

// ============================================================
// TASK CONTEXT
// ============================================================

/**
 * Shared resources for all tasks.
 */
export interface TaskContext {
    /** Validated peripherals */
    peripherals: ValidatedPeripherals;

    /** Shared logger */
    logger: Logger;

    /** System configuration */
    systemConfig: {
        scanIntervalSeconds: number;
        logLevel: string;
    };
}

// ============================================================
// TASK EXECUTION RESULT
// ============================================================

export interface TaskExecutionResult<TState> {
    /** New state for next cycle */
    state: TState;

    /** Number of operations performed */
    operationsCount: number;

    /** Optional summary for logging */
    summary?: string;
}

// ============================================================
// TASK DIAGNOSTICS
// ============================================================

export interface TaskDiagnostics {
    sections: DiagnosticSection[];
}

export interface DiagnosticSection {
    title: string;
    lines: string[];
}

// ============================================================
// REGISTERED TASK (internal type for TaskRegistry)
// ============================================================

export interface RegisteredTask {
    task: Task<unknown, unknown>;
    config: unknown;
    state: unknown;
    enabled: boolean;
}
