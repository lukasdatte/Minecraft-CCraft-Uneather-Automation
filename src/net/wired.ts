import { Side } from "../types";
import { Result, ok, err } from "../core/result";

export interface WiredModem {
  isWireless(): boolean;
  getNamesRemote(): string[];
  isPresentRemote(name: string): boolean;
}

export function getWiredModemOnSide(side: Side): Result<WiredModem> {
  const t = peripheral.getType(side as any);
  if (t !== "modem") return err("ERR_DOCK_MODEM_MISSING", { side, type: t });

  const m = peripheral.wrap(side as any) as unknown as WiredModem;
  if (!m || typeof m.isWireless !== "function") return err("ERR_DOCK_MODEM_MISSING", { side });

  if (m.isWireless()) return err("ERR_DOCK_MODEM_WIRELESS", { side });

  return ok(m);
}
