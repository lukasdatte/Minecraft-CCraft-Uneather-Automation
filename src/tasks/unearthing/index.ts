import { Task, TaskContext, TaskExecutionResult, TaskDiagnostics } from "../types";
import { UnearthingConfig, UnearthingState, InventoryItemInfo } from "../../types";
import { Result, ok, err, ErrorCode } from "../../core/result";
import { Scanner } from "../../engine/scanner";
import { Scheduler } from "../../engine/scheduler";
import { TransferEngine } from "../../engine/transfer";

/**
 * UnearthingTask - Distributes materials to unearthers.
 *
 * Scans all unearthers for empty input chests and transfers
 * materials from central storage using weighted selection.
 */
export class UnearthingTask implements Task<UnearthingConfig, UnearthingState> {
    readonly id = "unearthing";
    readonly name = "Material Distribution";

    private scanner!: Scanner;
    private scheduler!: Scheduler;
    private transferEngine!: TransferEngine;
    private config!: UnearthingConfig;
    private context!: TaskContext;

    init(
        context: TaskContext,
        config: UnearthingConfig,
    ): Result<UnearthingState> {
        this.context = context;
        this.config = config;

        // Create engine instances
        this.scanner = new Scanner(context.logger);
        this.scheduler = new Scheduler(
            { materials: config.materials, uneartherTypes: config.uneartherTypes },
            context.logger,
        );
        this.transferEngine = new TransferEngine(context.logger);

        // Create initial state
        const uneartherStatus: UnearthingState["uneartherStatus"] = {};
        for (const id of Object.keys(config.unearthers)) {
            uneartherStatus[id] = { isEmpty: false };
        }

        return ok({
            uneartherStatus,
            totalTransfers: 0,
        });
    }

    execute(
        state: UnearthingState,
        inventory: Map<string, InventoryItemInfo>,
    ): Result<TaskExecutionResult<UnearthingState>> {
        const { peripherals } = this.context;
        const log = this.context.logger;

        // 1. Scan all unearthers
        const scanRes = this.scanner.scanAllUnearthers(
            this.config.unearthers,
            peripherals,
        );

        if (!scanRes.ok) {
            return err(scanRes.code as ErrorCode);
        }

        const { emptyUnearthers } = scanRes.value;

        // Update state with scan results (create new state, don't mutate)
        const newUneartherStatus = { ...state.uneartherStatus };
        for (const result of scanRes.value.results) {
            if (newUneartherStatus[result.id]) {
                newUneartherStatus[result.id] = {
                    ...newUneartherStatus[result.id],
                    isEmpty: result.isEmpty,
                };
            }
        }

        if (emptyUnearthers.length === 0) {
            return ok({
                state: { ...state, uneartherStatus: newUneartherStatus },
                operationsCount: 0,
            });
        }

        // 2. Transfer materials to empty unearthers
        let transferCount = 0;
        let newTotalTransfers = state.totalTransfers;

        // Deep copy inventory for local tracking
        const localInventory = new Map<string, InventoryItemInfo>();
        for (const [key, value] of inventory) {
            localInventory.set(key, {
                totalCount: value.totalCount,
                slots: [...value.slots],
            });
        }

        for (const uneartherId of emptyUnearthers) {
            const unearther = this.config.unearthers[uneartherId];
            if (!unearther) continue;

            // Select material (Result-based)
            const selectionRes = this.scheduler.selectMaterial(
                unearther,
                localInventory,
                this.config.transferStackSize,
            );

            if (!selectionRes.ok) {
                log.debug("No material for unearther", { id: uneartherId });
                continue;
            }

            // Transfer
            const transferRes = this.transferEngine.transferToUnearther(
                peripherals.materialSource,
                unearther.inputChest,
                unearther,
                selectionRes.value,
                this.config.transferStackSize,
            );

            if (transferRes.ok) {
                transferCount++;
                newTotalTransfers++;
                newUneartherStatus[uneartherId] = {
                    isEmpty: false,
                    lastMaterial: selectionRes.value.materialId,
                    lastTransferTime: os.epoch("utc"),
                };

                // Update local inventory (not the original!)
                const itemId = selectionRes.value.material.itemId;
                const itemInfo = localInventory.get(itemId);
                if (itemInfo) {
                    itemInfo.totalCount -= transferRes.value.itemsTransferred;
                    if (itemInfo.totalCount <= 0) {
                        localInventory.delete(itemId);
                    }
                }
            }
        }

        return ok({
            state: {
                uneartherStatus: newUneartherStatus,
                totalTransfers: newTotalTransfers,
            },
            operationsCount: transferCount,
            summary: transferCount > 0 ? `${transferCount} transfers to unearthers` : undefined,
        });
    }

    getRequiredPeripherals(config: UnearthingConfig): string[] {
        return Object.values(config.unearthers).map((u) => u.inputChest);
    }

    getDiagnostics(config: UnearthingConfig): TaskDiagnostics {
        return {
            sections: [
                {
                    title: "MATERIALS",
                    lines: Object.entries(config.materials).map(
                        ([id, mat]) => `${id}: ${mat.itemId} (min: ${mat.minStock}, weight: ${mat.weight})`,
                    ),
                },
                {
                    title: "UNEARTHER TYPES",
                    lines: Object.entries(config.uneartherTypes).map(
                        ([id, t]) => `${id}: ${t.supportedMaterials.join(", ")}`,
                    ),
                },
                {
                    title: "UNEARTHERS",
                    lines: Object.entries(config.unearthers).map(
                        ([id, u]) => `${id}: type=${u.type}, chest=${u.inputChest}`,
                    ),
                },
            ],
        };
    }
}
