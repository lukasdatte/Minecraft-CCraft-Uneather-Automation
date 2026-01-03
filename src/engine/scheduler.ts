import { Logger } from "../core/logger";
import {
    AppConfig,
    MaterialId,
    MaterialConfig,
    UneartherInstance,
} from "../types";

/**
 * Selection result from the scheduler.
 */
export interface MaterialSelection {
    /** Selected material ID */
    materialId: MaterialId;
    /** Material configuration */
    material: MaterialConfig;
    /** Slot in the source inventory containing this item */
    sourceSlot: number;
}

/**
 * Available material info for selection.
 */
interface AvailableMaterial {
    materialId: MaterialId;
    config: MaterialConfig;
    availableCount: number;
    slots: number[];
}

/**
 * Weighted Round-Robin Scheduler for material selection.
 *
 * Uses weighted probability to select materials:
 * - Higher weight = more likely to be selected
 * - Respects minimum stock levels
 * - Only selects from materials the unearther can process
 */
export class Scheduler {
    constructor(
        private config: AppConfig,
        private log: Logger,
    ) {}

    /**
     * Select a material for an unearther based on weighted probability.
     *
     * @param unearther - The unearther instance needing material
     * @param inventoryContents - Current inventory contents (itemId -> {totalCount, slots})
     * @param stackSize - How many items will be transferred
     * @returns Selected material or null if none available
     */
    selectMaterial(
        unearther: UneartherInstance,
        inventoryContents: Map<string, { totalCount: number; slots: number[] }>,
        stackSize: number,
    ): MaterialSelection | null {
        // Get unearther type and supported materials
        const uType = this.config.uneartherTypes[unearther.type];
        if (!uType) {
            this.log.error("Unknown unearther type", { type: unearther.type });
            return null;
        }

        // Filter to available materials (enough stock)
        const available: AvailableMaterial[] = [];

        for (const matId of uType.supportedMaterials) {
            const matConfig = this.config.materials[matId];
            if (!matConfig) {
                this.log.warn("Unknown material in type definition", {
                    type: unearther.type,
                    material: matId,
                });
                continue;
            }

            // Check inventory for this item
            const invEntry = inventoryContents.get(matConfig.itemId);
            if (!invEntry) {
                this.log.debug("Material not in inventory", { material: matId });
                continue;
            }

            // Check if we have enough (minStock + stackSize)
            const required = matConfig.minStock + stackSize;
            if (invEntry.totalCount < required) {
                this.log.debug("Insufficient stock for material", {
                    material: matId,
                    have: invEntry.totalCount,
                    required,
                });
                continue;
            }

            available.push({
                materialId: matId,
                config: matConfig,
                availableCount: invEntry.totalCount,
                slots: invEntry.slots,
            });
        }

        if (available.length === 0) {
            this.log.warn("No materials available for unearther", {
                id: unearther.id,
                type: unearther.type,
            });
            return null;
        }

        // Weighted random selection
        const selected = this.weightedSelect(available);
        if (!selected) {
            return null;
        }

        this.log.debug("Selected material for unearther", {
            unearther: unearther.id,
            material: selected.materialId,
            weight: selected.config.weight,
        });

        return {
            materialId: selected.materialId,
            material: selected.config,
            sourceSlot: selected.slots[0],
        };
    }

    /**
     * Get supported materials for an unearther.
     */
    getSupportedMaterials(unearther: UneartherInstance): MaterialId[] {
        const uType = this.config.uneartherTypes[unearther.type];
        return uType ? uType.supportedMaterials : [];
    }

    /**
     * Check if a material can be used by an unearther.
     */
    canProcessMaterial(unearther: UneartherInstance, materialId: MaterialId): boolean {
        const supported = this.getSupportedMaterials(unearther);
        return supported.includes(materialId);
    }

    // ========================================
    // Private methods
    // ========================================

    /**
     * Perform weighted random selection.
     * Higher weight = higher probability of selection.
     */
    private weightedSelect(materials: AvailableMaterial[]): AvailableMaterial | null {
        if (materials.length === 0) return null;
        if (materials.length === 1) return materials[0];

        // Calculate total weight
        let totalWeight = 0;
        for (const mat of materials) {
            totalWeight += mat.config.weight;
        }

        // Random value between 0 and totalWeight
        const random = math.random() * totalWeight;

        // Find the selected material
        let cumulative = 0;
        for (const mat of materials) {
            cumulative += mat.config.weight;
            if (random < cumulative) {
                return mat;
            }
        }

        // Fallback (should not reach here)
        return materials[0];
    }
}
