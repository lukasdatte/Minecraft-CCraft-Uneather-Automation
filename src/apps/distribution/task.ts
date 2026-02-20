import { Result, ok } from "@core/result";
import { SafePeripheral } from "@core/safe-peripheral";
import { Orchestrator } from "@lib/orchestrator/orchestrator";
import { WeightedScheduler } from "@lib/scheduler/weighted";
import { InventoryItemInfo } from "@lib/inventory/types";
import {
    Task,
    TaskContext,
    TaskExecutionResult,
    TaskDiagnostics,
} from "@lib/task/types";
import { DistributionConfig, DistributionState } from "./types";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Distribution task: uses Orchestrator + WeightedScheduler
 * to distribute materials to machines using weighted random selection.
 */
export class DistributionTask implements Task<DistributionConfig, DistributionState> {
    readonly id = "distribution";
    readonly name = "Material Distribution";

    private orchestrator!: Orchestrator;
    private config!: DistributionConfig;
    private machineChests!: Map<string, SafePeripheral<InventoryPeripheral>>;
    private materialSource!: SafePeripheral<InventoryPeripheral>;

    init(
        context: TaskContext,
        config: DistributionConfig,
    ): Result<DistributionState> {
        this.config = config;
        this.machineChests = context.peripherals.machineChests;
        this.materialSource = context.peripherals.materialSource;

        const scheduler = new WeightedScheduler(
            {
                materials: config.materials,
                machineTypes: config.machineTypes,
                transferAmount: config.transferAmount,
            },
            context.logger,
        );

        this.orchestrator = new Orchestrator(scheduler, context.logger);

        // Create initial state
        const machineStatus: DistributionState["machineStatus"] = {};
        for (const machine of config.machines) {
            machineStatus[machine.id] = { isEmpty: false };
        }

        return ok({
            machineStatus,
            totalTransfers: 0,
        });
    }

    execute(
        state: DistributionState,
        inventory: Map<string, InventoryItemInfo>,
    ): Result<TaskExecutionResult<DistributionState>> {
        const result = this.orchestrator.run(
            this.config.machines,
            this.machineChests,
            this.materialSource,
            inventory,
        );

        let transferCount = 0;
        const newMachineStatus = { ...state.machineStatus };

        if (result.ok) {
            const runResult = result.value;

            // Update isEmpty from real orchestrator scan results
            for (const ms of runResult.machineStates) {
                const existing = newMachineStatus[ms.id];
                newMachineStatus[ms.id] = {
                    isEmpty: ms.isEmpty,
                    lastMaterial: existing?.lastMaterial,
                    lastTransferTime: existing?.lastTransferTime,
                };
            }

            // Update from transfers
            for (const transfer of runResult.transfers) {
                transferCount++;
                newMachineStatus[transfer.machineId] = {
                    isEmpty: false,
                    lastMaterial: transfer.itemId,
                    lastTransferTime: os.epoch("utc"),
                };
            }
        }

        return ok({
            state: {
                machineStatus: newMachineStatus,
                totalTransfers: state.totalTransfers + transferCount,
            },
            operationsCount: transferCount,
            summary: transferCount > 0
                ? `${transferCount} transfers to machines`
                : undefined,
        });
    }

    getDiagnostics(config: DistributionConfig): TaskDiagnostics {
        return {
            sections: [
                {
                    title: "MATERIALS",
                    lines: Object.values(config.materials).map(
                        (mat) => `${mat.id}: ${mat.itemId} (min: ${mat.minStock}, weight: ${mat.weight})`,
                    ),
                },
                {
                    title: "MACHINE TYPES",
                    lines: Object.values(config.machineTypes).map(
                        (t) => `${t.id}: ${t.supportedMaterials.join(", ")}`,
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
