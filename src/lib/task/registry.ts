import { Logger } from "@core/logger";
import { InventoryItemInfo } from "@lib/inventory/types";
import { Task, TaskContext, RegisteredTask } from "./types";

/**
 * Central task registry for managing task lifecycle.
 * Tasks are executed in registration order with pcall isolation.
 */
export class TaskRegistry {
    private tasks: RegisteredTask[] = [];

    constructor(private log: Logger) {}

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

    init(context: TaskContext): void {
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
                continue;
            }

            if (!result.ok) {
                this.log.warn("Task execution failed", {
                    id: entry.task.id,
                    code: result.code,
                });
                continue;
            }

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

    getTaskCount(): number {
        return this.tasks.length;
    }

    getEnabledTaskCount(): number {
        return this.tasks.filter((t) => t.enabled).length;
    }

    getTaskStates(): Map<string, unknown> {
        const states = new Map<string, unknown>();
        for (const entry of this.tasks) {
            if (entry.enabled && entry.state !== null) {
                states.set(entry.task.id, entry.state);
            }
        }
        return states;
    }
}
