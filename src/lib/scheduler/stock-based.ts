import { Logger } from "@core/logger";
import { InventoryItemInfo, SlotInfo } from "@lib/inventory/types";
import { MachineState, Assignment, Scheduler } from "@lib/orchestrator/types";

/**
 * A recipe that a machine can process.
 */
export interface RecipeDefinition {
    /** Input Minecraft item ID */
    input: string;
    /** Output Minecraft item ID */
    output: string;
}

/**
 * Target stock level for a material.
 */
export interface StockTarget {
    /** Minecraft item ID */
    itemId: string;
    /** Desired stock count */
    targetCount: number;
    /** Priority weight (higher = more important) */
    weight: number;
    /** Minimum stock before this material can be consumed as input for the next chain step.
     *  Defaults to 0 if not set (no reserve). */
    minReserve?: number;
}

/**
 * Configuration for the StockBasedScheduler.
 */
export interface StockBasedSchedulerConfig {
    /** Recipes per machine type: machineType -> RecipeDefinition[] */
    recipes: Record<string, RecipeDefinition[]>;
    /** Stock targets: what we want to produce */
    stockTargets: StockTarget[];
    /** Items per transfer */
    transferAmount: number;
}

/**
 * Internal: recipe with calculated urgency.
 */
interface ScoredRecipe {
    recipe: RecipeDefinition;
    urgency: number;
}

/**
 * Stock-based scheduler for production systems.
 *
 * Algorithm:
 * 1. For each StockTarget: urgency = max(0, (target - current) / target) * weight
 * 2. For each empty machine: find recipe whose OUTPUT has highest urgency
 * 3. Check if INPUT material is available (above minReserve + transferAmount)
 * 4. Distribute machines proportionally to urgency
 */
export class StockBasedScheduler implements Scheduler {
    constructor(
        private config: StockBasedSchedulerConfig,
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

        // Get empty machines
        const emptyMachines = machines.filter((m) => m.isEmpty);
        if (emptyMachines.length === 0) return assignments;

        // For each empty machine, find best recipe
        for (const machine of emptyMachines) {
            const recipes = this.config.recipes[machine.type];
            if (!recipes || recipes.length === 0) {
                this.log.debug("No recipes for machine type", { type: machine.type });
                continue;
            }

            // Score each recipe by output urgency
            const scored = this.scoreRecipes(recipes, localInventory);
            if (scored.length === 0) continue;

            // Sort by urgency descending (tiebreaker by output name for stability)
            scored.sort((a, b) => {
                if (b.urgency !== a.urgency) return b.urgency - a.urgency;
                return a.recipe.output < b.recipe.output ? -1 : 1;
            });

            // Try recipes in urgency order until we find one with available input
            let assigned = false;
            for (const { recipe, urgency } of scored) {
                if (urgency <= 0) continue;

                const inputInfo = localInventory.get(recipe.input);
                if (!inputInfo) continue;

                // Check per-material minReserve (0 if not set, e.g. for Cobblestone)
                const inputTarget = this.config.stockTargets.find(
                    (t) => t.itemId === recipe.input,
                );
                const reserve = inputTarget?.minReserve ?? 0;
                const required = reserve + this.config.transferAmount;
                if (inputInfo.totalCount < required) continue;

                // Find a slot with enough items, fallback to first slot
                const slotInfo = inputInfo.slots.find(
                    (s: SlotInfo) => s.count >= this.config.transferAmount,
                ) ?? inputInfo.slots[0];
                if (!slotInfo) continue;

                assignments.push({
                    machineId: machine.id,
                    targetChest: machine.inputChest,
                    itemId: recipe.input,
                    sourceSlot: slotInfo.slot,
                    amount: this.config.transferAmount,
                });

                // Update local inventory: reduce slot count, remove empty slots
                slotInfo.count -= this.config.transferAmount;
                inputInfo.totalCount -= this.config.transferAmount;
                if (slotInfo.count <= 0) {
                    inputInfo.slots = inputInfo.slots.filter((s: SlotInfo) => s !== slotInfo);
                }
                if (inputInfo.totalCount <= 0) {
                    localInventory.delete(recipe.input);
                }

                this.log.debug("Assigned recipe to machine", {
                    machine: machine.id,
                    input: recipe.input,
                    output: recipe.output,
                    urgency,
                });

                assigned = true;
                break;
            }

            if (!assigned) {
                this.log.debug("No viable recipe for machine", { id: machine.id });
            }
        }

        return assignments;
    }

    /**
     * Score recipes by the urgency of their output material.
     */
    private scoreRecipes(
        recipes: RecipeDefinition[],
        inventory: Map<string, InventoryItemInfo>,
    ): ScoredRecipe[] {
        const scored: ScoredRecipe[] = [];

        for (const recipe of recipes) {
            // Find stock target for this recipe's output
            const target = this.config.stockTargets.find((t) => t.itemId === recipe.output);
            if (!target) {
                this.log.warn("Recipe output has no stock target", { output: recipe.output });
                scored.push({ recipe, urgency: 0 });
                continue;
            }

            const currentCount = inventory.get(recipe.output)?.totalCount ?? 0;
            const urgency = math.max(0, (target.targetCount - currentCount) / target.targetCount) * target.weight;

            scored.push({ recipe, urgency });
        }

        return scored;
    }
}
