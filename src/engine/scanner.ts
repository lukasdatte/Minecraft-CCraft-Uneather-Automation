import { AppConfig, Job } from "../types";
import { Directory } from "../net/registry";
import { State } from "../core/state";
import { Result, ok, err } from "../core/result";
import { log } from "../core/logger";
import { isEmpty } from "../io/inventory";

interface InventoryLike { list(): any; }

function wrapRemoteInventory(name: string): Result<InventoryLike> {
  const [success, p] = pcall(() => peripheral.wrap(name as any)) as unknown as [boolean, any];
  if (!success || !p) return err("ERR_PERIPHERAL_OFFLINE", { name });

  if (typeof (p as any).list !== "function") {
    return err("ERR_PERIPHERAL_NOT_INVENTORY", { name, type: peripheral.getType(name as any) });
  }

  return ok(p as InventoryLike);
}

export class Scanner {
  constructor(private cfg: AppConfig, private dir: Directory, private state: State) {}

  scan(): Result<{ jobs: Job[] }> {
    const jobs: Job[] = [];

    for (const st of this.dir.stations) {
      const invRes = wrapRemoteInventory(st.feedChest);
      if (!invRes.ok) return invRes;

      const eRes = isEmpty(invRes.value);
      if (!eRes.ok) return eRes;

      this.state.setStationEmpty(st.id, eRes.value);

      if (eRes.value) {
        jobs.push({
          kind: "SERVE_STATION",
          stationId: st.id,
          createdAtUtc: os.epoch("utc"),
          reason: "FEED_EMPTY",
        });
      }
    }

    return ok({ jobs });
  }
}
