import { Result, ok, err } from "@core/result";
import { TransferRequest, TransferSuccess } from "./types";

/**
 * Execute a race-condition-safe item transfer.
 *
 * Uses a batch call to:
 * 1. Verify the source slot still contains the expected item
 * 2. Push items to the target in a single peripheral.call()
 *
 * Calls ensureConnected() on source before transfer.
 */
export function executeTransfer(req: TransferRequest): Result<TransferSuccess> {
    req.source.ensureConnected();

    type CallResult =
        | { error: "slot_changed"; actual: string | undefined }
        | { error: "transfer_failed" }
        | { error: "disconnected" }
        | { transferred: number };

    const result: CallResult = req.source.call(
        (p): CallResult => {
            // Verify slot still contains expected item (race condition protection)
            const currentItem = p.getItemDetail(req.sourceSlot);

            if (!currentItem || currentItem.name !== req.expectedItemId) {
                return { error: "slot_changed", actual: currentItem?.name };
            }

            // Perform the transfer
            const transferred = p.pushItems(req.targetName, req.sourceSlot, req.amount);

            if (transferred === 0) {
                return { error: "transfer_failed" };
            }

            return { transferred };
        },
        { error: "disconnected" },
    );

    if ("error" in result) {
        if (result.error === "slot_changed") {
            return err("ERR_SLOT_CHANGED", {
                slot: req.sourceSlot,
                expected: req.expectedItemId,
                actual: result.actual ?? "empty",
            });
        }
        if (result.error === "transfer_failed") {
            return err("ERR_TRANSFER_FAILED", {
                sourceSlot: req.sourceSlot,
                reason: "no_items_transferred",
            });
        }
        // disconnected
        return err("ERR_PERIPHERAL_DISCONNECTED");
    }

    return ok({
        transferred: result.transferred,
        sourceSlot: req.sourceSlot,
    });
}
