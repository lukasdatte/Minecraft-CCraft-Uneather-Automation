import { SafePeripheral } from "@core/safe-peripheral";

// Type InventoryPeripheral from @jackmacwindows/craftos-types is globally declared

/**
 * Request for a race-condition-safe item transfer.
 */
export interface TransferRequest {
    /** Source inventory peripheral */
    source: SafePeripheral<InventoryPeripheral>;
    /** Target peripheral name (for pushItems) */
    targetName: string;
    /** Source slot number */
    sourceSlot: number;
    /** Expected item ID in the source slot */
    expectedItemId: string;
    /** Number of items to transfer */
    amount: number;
}

/**
 * Result of a successful transfer.
 */
export interface TransferSuccess {
    /** Number of items actually transferred */
    transferred: number;
    /** Source slot used */
    sourceSlot: number;
}
