import { Result, ok } from "@core/result";
import { SafePeripheral } from "@core/safe-peripheral";
import { Orchestrator } from "@lib/orchestrator/orchestrator";
import { StockBasedScheduler } from "@lib/scheduler/stock-based";
import { InventoryItemInfo } from "@lib/inventory/types";
import {
    Task,
    TaskContext,
    TaskExecutionResult,
    TaskDiagnostics,
} from "@lib/task/types";
import { ProductionConfig, ProductionState } from "./types";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Production task: uses Orchestrator + StockBasedScheduler
 * to fill machine input chests based on stock urgency.
 */
export class ProductionTask implements Task<ProductionConfig, ProductionState> {
    readonly id = "production";
    readonly name = "Material Production";

    private orchestrator!: Orchestrator;
    private config!: ProductionConfig;
    private machineChests!: Map<string, SafePeripheral<InventoryPeripheral>>;
    private materialSource!: SafePeripheral<InventoryPeripheral>;

    init(
        context: TaskContext,
        config: ProductionConfig,
    ): Result<ProductionState> {
        this.config = config;
        this.machineChests = context.peripherals.machineChests;
        this.materialSource = context.peripherals.materialSource;

        const scheduler = new StockBasedScheduler(
            {
                recipes: config.recipes,
                stockTargets: config.stockTargets,
                transferAmount: config.transferAmount,
            },
            context.logger,
        );

        this.orchestrator = new Orchestrator(scheduler, context.logger);

        return ok({
            totalOperations: 0,
            totalTransferred: 0,
            lastProcessingTime: 0,
            machineStatus: {},
        });
    }

    execute(
        state: ProductionState,
        inventory: Map<string, InventoryItemInfo>,
    ): Result<TaskExecutionResult<ProductionState>> {
        const result = this.orchestrator.run(
            this.config.machines,
            this.machineChests,
            this.materialSource,
            inventory,
        );

        const runResult = result.ok ? result.value : undefined;
        const transfers = runResult?.transfers ?? [];
        const operations = transfers.length;

        // Build machine status from orchestrator scan results
        const machineStatus: ProductionState["machineStatus"] = {};
        if (runResult) {
            for (const ms of runResult.machineStates) {
                machineStatus[ms.id] = {
                    isEmpty: ms.isEmpty,
                    currentItem: ms.currentItem,
                    currentCount: ms.currentCount,
                };
            }
            // After transfer, override with transfer data (more accurate than pre-transfer scan)
            for (const transfer of transfers) {
                const entry = machineStatus[transfer.machineId];
                if (entry) {
                    entry.isEmpty = false;
                    entry.currentItem = transfer.itemId;
                    entry.currentCount = transfer.itemsTransferred;
                }
            }
        }

        let totalTransferred = state.totalTransferred;
        for (const transfer of transfers) {
            totalTransferred += transfer.itemsTransferred;
        }

        return ok({
            state: {
                totalOperations: state.totalOperations + operations,
                totalTransferred,
                lastProcessingTime: operations > 0 ? os.epoch("utc") : state.lastProcessingTime,
                machineStatus,
            },
            operationsCount: operations,
            summary: operations > 0
                ? `Processed ${operations} machine assignments`
                : undefined,
        });
    }

    getDiagnostics(config: ProductionConfig): TaskDiagnostics {
        const recipeLines: string[] = [];
        for (const [machineType, recipes] of Object.entries(config.recipes)) {
            for (const recipe of recipes) {
                recipeLines.push(`[${machineType}] ${recipe.input} -> ${recipe.output}`);
            }
        }

        return {
            sections: [
                {
                    title: "PRODUCTION RECIPES",
                    lines: recipeLines,
                },
                {
                    title: "STOCK TARGETS",
                    lines: config.stockTargets.map(
                        (t) => `${t.itemId}: target=${t.targetCount}, weight=${t.weight}`,
                    ),
                },
                {
                    title: "MACHINES",
                    lines: config.machines.map(
                        (m) => `${m.id}: type=${m.type}, chest=${m.inputChest}`,
                    ),
                },
            ],
        };
    }
}
