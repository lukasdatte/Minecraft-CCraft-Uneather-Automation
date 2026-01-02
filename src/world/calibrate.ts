import { AppConfig } from "../types";
import { Result, ok, err } from "../core/result";
import { getWiredModemOnSide } from "../net/wired";

function rotateOnce(): void {
  turtle.turnLeft();
}

function markerOk(config: AppConfig): boolean {
  if (!config.dock.markerSide) return true;
  const t = peripheral.getType(config.dock.markerSide as any);
  if (!t) return false;
  if (config.dock.markerType && t !== config.dock.markerType) return false;
  return true;
}

export function alignToDock(config: AppConfig): Result<void> {
  const tries = config.dock.autoRotateToMatch ? 4 : 1;

  for (let i = 0; i < tries; i++) {
    const mRes = getWiredModemOnSide(config.dock.netSide);
    if (mRes.ok) {
      // optional: ensure we see the expected remote network
      const req = config.dock.requiredRemote ?? [];
      for (const name of req) {
        if (!mRes.value.isPresentRemote(name)) {
          return err("ERR_DOCK_REMOTE_MISSING", { missing: name, side: config.dock.netSide });
        }
      }

      if (!markerOk(config)) {
        return err("ERR_DOCK_MARKER_MISSING", { markerSide: config.dock.markerSide, markerType: config.dock.markerType });
      }

      return ok(undefined);
    }

    if (i < tries - 1) rotateOnce();
  }

  return err("ERR_DOCK_MODEM_MISSING", { side: config.dock.netSide, note: "Could not match dock orientation" });
}
