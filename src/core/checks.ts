import { AppConfig } from "../types";
import { Result, ok } from "./result";
import { alignToDock } from "../world/calibrate";
import { ensureFuel } from "../io/refuel";

export function ensureDockReady(config: AppConfig): Result<void> {
  // 1) orientation / modem presence (wired) + optional marker
  const a = alignToDock(config);
  if (!a.ok) return a;

  return ok(undefined);
}

// Convenience: separate fuel check for main loop (executor will also check)
export function ensureFuelOk(config: AppConfig): Result<void> {
  return ensureFuel(config);
}
