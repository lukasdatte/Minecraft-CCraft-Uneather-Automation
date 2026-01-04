import { Task, TaskContext, TaskExecutionResult, TaskDiagnostics } from "../types";
import { HammeringConfig, HammeringState, InventoryItemInfo, STACK_SIZE } from "../../types";
import { Result, ok, err, ErrorCode } from "../../core/result";
import { ProcessingEngine } from "../../engine/processing";
import { Scanner } from "../../engine/scanner";

/**
 * HammeringTask - Processes materials through the hammer chain.
 *
 * Transforms materials: Cobblestone → Dirt → Gravel → Sand → Dust
 * Transfers items to a processing chest for external pipe handling.
 */
export class HammeringTask implements Task<HammeringConfig, HammeringState> {
    readonly id = "hammering";
    readonly name = "Material Processing";

    private processingEngine!: ProcessingEngine;
    private context!: TaskContext;
    private config!: HammeringConfig;

    init(
        context: TaskContext,
        config: HammeringConfig,
    ): Result<HammeringState> {
        this.context = context;
        this.config = config;

        // ProcessingEngine needs Scanner for inventory scans
        const scanner = new Scanner(context.logger);
        this.processingEngine = new ProcessingEngine(scanner, context.logger);

        // Validate processing chest exists (from PeripheralRegistry)
        if (!context.peripherals.processingChest) {
            return err("ERR_PROCESSING_CHEST_MISSING");
        }

        return ok({
            totalOperations: 0,
            lastProcessingTime: 0,
        });
    }

    execute(
        state: HammeringState,
        _inventory: Map<string, InventoryItemInfo>,
    ): Result<TaskExecutionResult<HammeringState>> {
        const { peripherals } = this.context;

        // ProcessingEngine accepts ProcessingPhaseConfig
        const result = this.processingEngine.runPhase(
            {
                minInputReserve: this.config.minInputReserve,
                maxOutputStock: this.config.maxOutputStock,
                chain: this.config.chain,
            },
            peripherals.materialSource,
            peripherals.processingChest!,
        );

        if (!result.ok) {
            return err(result.code as ErrorCode);
        }

        const operations = result.value.length;

        return ok({
            state: {
                totalOperations: state.totalOperations + operations,
                lastProcessingTime: operations > 0 ? os.epoch("utc") : state.lastProcessingTime,
            },
            operationsCount: operations,
            summary: operations > 0
                ? `Processed ${operations} material types`
                : undefined,
        });
    }

    getRequiredPeripherals(config: HammeringConfig): string[] {
        return [config.processingChest.name];
    }

    getDiagnostics(config: HammeringConfig): TaskDiagnostics {
        return {
            sections: [
                {
                    title: "PROCESSING CHAIN",
                    lines: Object.entries(config.chain).map(
                        ([input, output]) => `${input} -> ${output}`,
                    ),
                },
                {
                    title: "THRESHOLDS",
                    lines: [
                        `Min Input Reserve: ${config.minInputReserve} (${config.minInputReserve / STACK_SIZE} stacks)`,
                        `Max Output Stock: ${config.maxOutputStock} (${config.maxOutputStock / STACK_SIZE} stacks)`,
                    ],
                },
            ],
        };
    }
}
