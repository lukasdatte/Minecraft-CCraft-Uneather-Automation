import { Logger } from "@core/logger";
import { InventoryItemInfo, SlotInfo } from "@lib/inventory/types";
import { MachineState, Assignment, Scheduler } from "@lib/orchestrator/types";
import { MaterialDefinition, MachineTypeDefinition } from "./types";

/**
 * Available material for selection (internal).
 */
interface AvailableMaterial {
    definition: MaterialDefinition;
    slots: SlotInfo[];
}

/**
 * Configuration for the WeightedScheduler.
 */
export interface WeightedSchedulerConfig {
    /** Material definitions keyed by material ID */
    materials: Record<string, MaterialDefinition>;
    /** Machine type definitions keyed by type ID */
    machineTypes: Record<string, MachineTypeDefinition>;
    /** Items per transfer */
    transferAmount: number;
}

/**
 * Weighted random scheduler for material distribution.
 *
 * For each empty machine:
 * 1. Get supported materials for that machine type
 * 2. Filter to materials with enough stock
 * 3. Weighted random selection
 * 4. Create assignment
 */
export class WeightedScheduler implements Scheduler {
    constructor(
        private config: WeightedSchedulerConfig,
        private log: Logger,
    ) {}

    schedule(
        machines: MachineState[],
        inventory: Map<string, InventoryItemInfo>,
    ): Assignment[] {
        const assignments: Assignment[] = [];

        // Create local inventory copy for tracking (deep copy slots)
        const localInventory = new Map<string, InventoryItemInfo>();
        for (const [key, value] of inventory) {
            localInventory.set(key, {
                totalCount: value.totalCount,
                slots: value.slots.map((s: SlotInfo) => ({ slot: s.slot, count: s.count })),
            });
        }

        for (const machine of machines) {
            if (!machine.isEmpty) continue;

            const machineType = this.config.machineTypes[machine.type];
            if (!machineType) {
                this.log.warn("Unknown machine type", { id: machine.id, type: machine.type });
                continue;
            }

            // Filter to available materials
            const available = this.getAvailableMaterials(
                machineType,
                localInventory,
                this.config.transferAmount,
            );

            if (available.length === 0) {
                this.log.debug("No materials available for machine", {
                    id: machine.id,
                    type: machine.type,
                });
                continue;
            }

            // Weighted random selection
            const selected = this.weightedSelect(available);
            if (!selected) continue;

            // Find a slot with enough items, fallback to first slot
            const slotInfo = selected.slots.find(
                (s: SlotInfo) => s.count >= this.config.transferAmount,
            ) ?? selected.slots[0];
            if (!slotInfo) continue;

            assignments.push({
                machineId: machine.id,
                targetChest: machine.inputChest,
                itemId: selected.definition.itemId,
                sourceSlot: slotInfo.slot,
                amount: this.config.transferAmount,
            });

            // Update local inventory: reduce slot count, remove empty slots
            const itemInfo = localInventory.get(selected.definition.itemId);
            if (itemInfo) {
                slotInfo.count -= this.config.transferAmount;
                itemInfo.totalCount -= this.config.transferAmount;
                if (slotInfo.count <= 0) {
                    itemInfo.slots = itemInfo.slots.filter((s: SlotInfo) => s !== slotInfo);
                }
                if (itemInfo.totalCount <= 0) {
                    localInventory.delete(selected.definition.itemId);
                }
            }

            this.log.debug("Assigned material to machine", {
                machine: machine.id,
                material: selected.definition.id,
                slot: slotInfo.slot,
            });
        }

        return assignments;
    }

    private getAvailableMaterials(
        machineType: MachineTypeDefinition,
        inventory: Map<string, InventoryItemInfo>,
        transferAmount: number,
    ): AvailableMaterial[] {
        const available: AvailableMaterial[] = [];

        for (const matId of machineType.supportedMaterials) {
            const matDef = this.config.materials[matId];
            if (!matDef) continue;

            const invEntry = inventory.get(matDef.itemId);
            if (!invEntry) continue;

            const required = matDef.minStock + transferAmount;
            if (invEntry.totalCount < required) continue;

            available.push({
                definition: matDef,
                slots: invEntry.slots,
            });
        }

        return available;
    }

    private weightedSelect(materials: AvailableMaterial[]): AvailableMaterial | null {
        if (materials.length === 0) return null;
        if (materials.length === 1) return materials[0];

        let totalWeight = 0;
        for (const mat of materials) {
            totalWeight += mat.definition.weight;
        }

        const random = math.random() * totalWeight;

        let cumulative = 0;
        for (const mat of materials) {
            cumulative += mat.definition.weight;
            if (random < cumulative) {
                return mat;
            }
        }

        return materials[0];
    }
}
