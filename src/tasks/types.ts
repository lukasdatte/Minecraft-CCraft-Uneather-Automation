import { Result } from "../core/result";
import { Logger } from "../core/logger";
import { ValidatedPeripherals } from "../registry/peripheral";
import { InventoryItemInfo } from "../types";

// ============================================================
// TASK INTERFACE - Generic über Config und State
// ============================================================

/**
 * Task<TConfig, TState> - Generisches Task Interface
 *
 * TConfig = Task-spezifische Konfiguration (z.B. HammeringConfig)
 * TState  = Task-spezifischer Runtime-State (z.B. HammeringState)
 */
export interface Task<TConfig, TState> {
    /** Eindeutige Task-ID (z.B. "hammering", "unearthing") */
    readonly id: string;

    /** Anzeigename (z.B. "Material Hammering") */
    readonly name: string;

    /**
     * Initialisiert den Task mit Kontext und Konfiguration.
     * Wird einmal beim Start aufgerufen.
     * @returns Initial-State oder Error
     */
    init(context: TaskContext, config: TConfig): Result<TState>;

    /**
     * Führt einen Zyklus des Tasks aus.
     * Wird in jedem Main-Loop-Durchlauf aufgerufen.
     * @param state - Aktueller State (von init oder letztem execute)
     * @param inventory - Aktuelle Inventory-Contents (NICHT mutieren!)
     * @returns Execution-Result mit neuem State
     */
    execute(
        state: TState,
        inventory: Map<string, InventoryItemInfo>
    ): Result<TaskExecutionResult<TState>>;

    /**
     * Gibt benötigte Peripheral-Namen zurück für Validierung.
     */
    getRequiredPeripherals(config: TConfig): string[];

    /**
     * Generiert Task-spezifische Startup-Diagnostik.
     */
    getDiagnostics(config: TConfig): TaskDiagnostics;
}

// ============================================================
// TASK CONTEXT - Shared Resources für alle Tasks
// ============================================================

/**
 * TaskContext enthält shared Resources, die alle Tasks nutzen können.
 * Wird von TaskRegistry an jeden Task übergeben.
 */
export interface TaskContext {
    /** Validierte Peripherals (alle als SafePeripheral gewrapped) */
    peripherals: ValidatedPeripherals;

    /** Shared Logger */
    logger: Logger;

    /** System-Konfiguration (scanInterval, logLevel, etc.) */
    systemConfig: {
        scanIntervalSeconds: number;
        logLevel: string;
    };
}

// ============================================================
// TASK EXECUTION RESULT - Rückgabe von execute()
// ============================================================

/**
 * Ergebnis einer Task-Ausführung.
 * Enthält neuen State und Statistiken.
 */
export interface TaskExecutionResult<TState> {
    /** Neuer State für nächsten Zyklus */
    state: TState;

    /** Anzahl durchgeführter Operationen (für Logging) */
    operationsCount: number;

    /** Optionale Zusammenfassung für Log */
    summary?: string;
}

// ============================================================
// TASK DIAGNOSTICS - Startup-Anzeige
// ============================================================

export interface TaskDiagnostics {
    sections: DiagnosticSection[];
}

export interface DiagnosticSection {
    title: string;
    lines: string[];
}

// ============================================================
// REGISTERED TASK - Interner Typ für TaskRegistry
// ============================================================

/**
 * Interner Wrapper für registrierte Tasks.
 * Ermöglicht type-erasure für heterogene Task-Liste.
 */
export interface RegisteredTask {
    task: Task<unknown, unknown>;
    config: unknown;
    state: unknown;
    enabled: boolean;
}
