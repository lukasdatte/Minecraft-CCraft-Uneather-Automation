import { Result, ok, err } from "../core/result";

export interface InventoryLike {
  list(): any;
}

export function isEmpty(inv: InventoryLike): Result<boolean> {
  const [success, items] = pcall(() => inv.list()) as unknown as [boolean, any];
  if (!success) return err("ERR_IO", { where: "inv.list()", items });

  for (const _ of pairs(items as any) as any) {
    return ok(false);
  }
  return ok(true);
}

export function wrapLocal(side: "left"|"right"|"front"|"back"|"top"|"bottom"): Result<InventoryLike> {
  const t = peripheral.getType(side as any);
  if (!t) return err("ERR_PERIPHERAL_OFFLINE", { side });

  const p = peripheral.wrap(side as any) as any;
  if (!p || typeof p.list !== "function") return err("ERR_PERIPHERAL_NOT_INVENTORY", { side, type: t });

  return ok(p as InventoryLike);
}
