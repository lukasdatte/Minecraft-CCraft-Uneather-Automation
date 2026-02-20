/** Inventory slot information with per-slot count */
export interface SlotInfo {
    slot: number;
    count: number;
}

/**
 * Information about a single item type in an inventory.
 * Used by scanner, orchestrator, and scheduler modules.
 */
export interface InventoryItemInfo {
    /** Total count of this item across all slots */
    totalCount: number;
    /** Slots containing this item, with per-slot count */
    slots: SlotInfo[];
}
