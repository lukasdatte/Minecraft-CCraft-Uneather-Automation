import { Logger } from "../core/logger";
import { Task, TaskContext, RegisteredTask } from "./types";
import { InventoryItemInfo } from "../types";

/**
 * TaskRegistry - Zentraler Orchestrator für alle Tasks.
 *
 * Verwaltet die Registrierung, Initialisierung und Ausführung von Tasks.
 * Fehler in einem Task stoppen nicht die anderen (Error-Isolation via pcall).
 */
export class TaskRegistry {
    private tasks: RegisteredTask[] = [];
    private context: TaskContext | null = null;

    constructor(private log: Logger) {}

    /**
     * Registriert einen Task mit seiner Konfiguration.
     * Tasks werden in Registrierungsreihenfolge ausgeführt.
     */
    register<TConfig, TState>(
        task: Task<TConfig, TState>,
        config: TConfig,
    ): void {
        this.tasks.push({
            task: task as Task<unknown, unknown>,
            config,
            state: null,
            enabled: true,
        });
        this.log.info("Task registered", { id: task.id, name: task.name });
    }

    /**
     * Initialisiert alle registrierten Tasks.
     * Muss vor runCycle() aufgerufen werden.
     */
    init(context: TaskContext): void {
        this.context = context;

        for (const entry of this.tasks) {
            const [success, result] = pcall(() =>
                entry.task.init(context, entry.config),
            );

            if (!success) {
                this.log.error("Task init crashed", {
                    id: entry.task.id,
                    error: tostring(result),
                });
                entry.enabled = false;
                continue;
            }

            if (!result.ok) {
                this.log.error("Task init failed", {
                    id: entry.task.id,
                    code: result.code,
                });
                entry.enabled = false;
                continue;
            }

            entry.state = result.value;
            this.log.info("Task initialized", { id: entry.task.id });
        }
    }

    /**
     * Führt einen Zyklus aller aktivierten Tasks aus.
     * Fehler in einem Task stoppen nicht die anderen.
     */
    runCycle(inventory: Map<string, InventoryItemInfo>): void {
        for (const entry of this.tasks) {
            if (!entry.enabled) continue;

            const [success, result] = pcall(() =>
                entry.task.execute(entry.state, inventory),
            );

            if (!success) {
                this.log.error("Task crashed", {
                    id: entry.task.id,
                    error: tostring(result),
                });
                // Task bleibt enabled, wird nächsten Zyklus erneut versucht
                continue;
            }

            if (!result.ok) {
                this.log.warn("Task execution failed", {
                    id: entry.task.id,
                    code: result.code,
                });
                continue;
            }

            // State aktualisieren
            entry.state = result.value.state;

            if (result.value.operationsCount > 0) {
                this.log.info("Task completed", {
                    id: entry.task.id,
                    operations: result.value.operationsCount,
                    summary: result.value.summary,
                });
            }
        }
    }

    /**
     * Gibt Diagnostik aller Tasks aus.
     */
    printDiagnostics(): void {
        for (const entry of this.tasks) {
            const diag = entry.task.getDiagnostics(entry.config);
            for (const section of diag.sections) {
                print("");
                print(`>> ${section.title}`);
                print(string.rep("-", 50));
                for (const line of section.lines) {
                    print(`  ${line}`);
                }
            }
        }
    }

    /**
     * Gibt die Anzahl registrierter Tasks zurück.
     */
    getTaskCount(): number {
        return this.tasks.length;
    }

    /**
     * Gibt die Anzahl aktivierter Tasks zurück.
     */
    getEnabledTaskCount(): number {
        return this.tasks.filter((t) => t.enabled).length;
    }
}
