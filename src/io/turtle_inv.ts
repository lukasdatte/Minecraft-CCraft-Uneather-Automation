import { Result, ok, err } from "../core/result";

export function countFreeSlots(): number {
  let free = 0;
  for (let i = 1; i <= 16; i++) {
    const d = turtle.getItemDetail(i);
    if (!d) free += 1;
  }
  return free;
}

export function ensureFreeSlots(minFree: number): Result<void> {
  const free = countFreeSlots();
  if (free >= minFree) return ok(undefined);
  return err("ERR_TURTLE_INV_FULL", { free, minFree });
}

function dumpOneSlot(dir: "front" | "back" | "left" | "right" | "up" | "down"): boolean {
  if (dir === "up") return turtle.dropUp();
  if (dir === "down") return turtle.dropDown();
  // default front-like
  if (dir === "back") { turtle.turnLeft(); turtle.turnLeft(); const r = turtle.drop(); turtle.turnLeft(); turtle.turnLeft(); return r; }
  if (dir === "left") { turtle.turnLeft(); const r = turtle.drop(); turtle.turnRight(); return r; }
  if (dir === "right") { turtle.turnRight(); const r = turtle.drop(); turtle.turnLeft(); return r; }
  return turtle.drop();
}

// Optional helper: dump everything to an adjacent chest (pure mechanics)
export function dumpAll(dir: "front" | "back" | "left" | "right" | "up" | "down"): Result<number> {
  let dumped = 0;
  for (let i = 1; i <= 16; i++) {
    turtle.select(i);
    const detail = turtle.getItemDetail(i);
    if (!detail) continue;
    const okDrop = dumpOneSlot(dir);
    if (okDrop) dumped += 1;
  }
  turtle.select(1);
  return ok(dumped);
}
