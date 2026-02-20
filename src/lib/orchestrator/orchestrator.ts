import { Result, ok } from "@core/result";
import { Logger } from "@core/logger";
import { SafePeripheral } from "@core/safe-peripheral";
import { getInventoryContents } from "@lib/inventory/scanner";
import { isInventoryEmpty } from "@lib/inventory/scanner";
import { executeTransfer } from "@lib/transfer/transfer";
import { InventoryItemInfo } from "@lib/inventory/types";
import {
    MachineConfig,
    MachineState,
    Assignment,
    Scheduler,
    OrchestratorTransferResult,
    OrchestratorRunResult,
} from "./types";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Generic orchestrator for machine-based item distribution.
 *
 * Responsibilities:
 * - Scan machines (check if input chests are empty)
 * - Get inventory contents from material source
 * - Ask scheduler for assignments
 * - Execute transfers
 *
 * Does NOT know about recipes, priorities, or business logic.
 * All decisions come from the Scheduler.
 */
export class Orchestrator {
    constructor(
        private scheduler: Scheduler,
        private log: Logger,
    ) {}

    /**
     * Run a complete orchestration cycle.
     *
     * @param machines - Machine configurations
     * @param machineChests - Map of chest name -> SafePeripheral
     * @param materialSource - Central material source
     * @param preScannedInventory - Optional pre-scanned inventory to avoid redundant scans
     * @returns Machine states and transfer results
     */
    run(
        machines: MachineConfig[],
        machineChests: Map<string, SafePeripheral<InventoryPeripheral>>,
        materialSource: SafePeripheral<InventoryPeripheral>,
        preScannedInventory?: Map<string, InventoryItemInfo>,
    ): Result<OrchestratorRunResult> {
        // 1. Scan all machines
        const states = this.scanMachines(machines, machineChests);

        const emptyCount = states.filter((s) => s.isEmpty).length;
        if (emptyCount === 0) {
            this.log.debug("No empty machines, skipping cycle");
            return ok({ machineStates: states, transfers: [] });
        }
        this.log.debug("Machines scanned", { total: states.length, empty: emptyCount });

        // 2. Get inventory contents (use pre-scanned if provided)
        let inventory: Map<string, InventoryItemInfo>;
        if (preScannedInventory) {
            inventory = preScannedInventory;
        } else {
            const inventoryRes = getInventoryContents(materialSource);
            if (!inventoryRes.ok) {
                this.log.warn("Failed to get inventory contents");
                return ok({ machineStates: states, transfers: [] });
            }
            inventory = inventoryRes.value;
        }

        // 3. Ask scheduler for assignments (scheduler makes its own inventory copy)
        const assignments = this.scheduler.schedule(states, inventory);
        if (assignments.length === 0) {
            this.log.debug("Scheduler returned no assignments");
            return ok({ machineStates: states, transfers: [] });
        }
        this.log.debug("Scheduler created assignments", { count: assignments.length });

        // 4. Execute assignments
        const results = this.executeAssignments(assignments, materialSource);

        if (results.length > 0) {
            this.log.info("Orchestrator cycle complete", { transfers: results.length });
        }

        return ok({ machineStates: states, transfers: results });
    }

    /**
     * Scan all machines to determine their state.
     */
    private scanMachines(
        machines: MachineConfig[],
        machineChests: Map<string, SafePeripheral<InventoryPeripheral>>,
    ): MachineState[] {
        const states: MachineState[] = [];

        for (const machine of machines) {
            const chest = machineChests.get(machine.inputChest);
            if (!chest) {
                this.log.warn("Machine chest not available", {
                    id: machine.id,
                    chest: machine.inputChest,
                });
                // Treat as non-empty (don't try to fill unknown chests)
                states.push({
                    id: machine.id,
                    type: machine.type,
                    inputChest: machine.inputChest,
                    isEmpty: false,
                });
                continue;
            }

            chest.ensureConnected();
            const emptyRes = isInventoryEmpty(chest);
            const isEmpty = emptyRes.ok ? emptyRes.value : false;

            states.push({
                id: machine.id,
                type: machine.type,
                inputChest: machine.inputChest,
                isEmpty,
            });
        }

        return states;
    }

    /**
     * Execute a list of assignments using race-condition-safe transfers.
     */
    private executeAssignments(
        assignments: Assignment[],
        materialSource: SafePeripheral<InventoryPeripheral>,
    ): OrchestratorTransferResult[] {
        const results: OrchestratorTransferResult[] = [];

        for (const assignment of assignments) {
            const transferRes = executeTransfer({
                source: materialSource,
                targetName: assignment.targetChest,
                sourceSlot: assignment.sourceSlot,
                expectedItemId: assignment.itemId,
                amount: assignment.amount,
            });

            if (transferRes.ok) {
                results.push({
                    machineId: assignment.machineId,
                    itemId: assignment.itemId,
                    itemsTransferred: transferRes.value.transferred,
                    sourceSlot: assignment.sourceSlot,
                });
            } else {
                this.log.warn("Assignment transfer failed", {
                    machine: assignment.machineId,
                    item: assignment.itemId,
                    code: transferRes.code,
                });
            }
        }

        return results;
    }
}
