import { AppConfig } from "../types";
import { Result, ok, err, okNoop } from "../core/result";
import { log } from "../core/logger";

function suckFrom(dir: "front" | "back" | "left" | "right" | "up" | "down"): boolean {
  if (dir === "up") return turtle.suckUp();
  if (dir === "down") return turtle.suckDown();
  if (dir === "back") { turtle.turnLeft(); turtle.turnLeft(); const r = turtle.suck(); turtle.turnLeft(); turtle.turnLeft(); return r; }
  if (dir === "left") { turtle.turnLeft(); const r = turtle.suck(); turtle.turnRight(); return r; }
  if (dir === "right") { turtle.turnRight(); const r = turtle.suck(); turtle.turnLeft(); return r; }
  return turtle.suck();
}

export function ensureFuel(config: AppConfig): Result<void> {
  const rf = config.base.refuel;
  if (!rf || !rf.enabled) return okNoop(undefined);

  const lvl = turtle.getFuelLevel();
  if (lvl === "unlimited") return okNoop(undefined);

  if (lvl >= rf.minFuelLevel) return okNoop(undefined);

  log.warn("Fuel low, attempting refuel", { level: lvl, min: rf.minFuelLevel });

  // Try to suck fuel items into inventory and refuel from them.
  for (let i = 0; i < rf.maxSuckTries; i++) {
    const sucked = suckFrom(rf.fuelChestDirection);
    if (!sucked) break;

    // Try refuel from current selected slot(s)
    // We'll just iterate slots and refuel whatever is there
    for (let s = 1; s <= 16; s++) {
      turtle.select(s);
      const d = turtle.getItemDetail(s);
      if (!d) continue;
      // refuel 64 (max) if possible; returns boolean
      turtle.refuel();
      const now = turtle.getFuelLevel();
      if (now === "unlimited") { turtle.select(1); return ok(undefined); }
      if (typeof now === "number" && now >= rf.minFuelLevel) { turtle.select(1); return ok(undefined); }
    }
  }

  turtle.select(1);
  const now = turtle.getFuelLevel();
  return err("ERR_NO_FUEL", { after: now, min: rf.minFuelLevel, note: "Refuel failed. Ensure fuel chest has valid fuel items." });
}
