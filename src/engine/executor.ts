import { AppConfig, Job } from "../types";
import { Directory } from "../net/registry";
import { NavLine } from "../world/nav_line";
import { State } from "../core/state";
import { Result, ok, okNoop, err } from "../core/result";
import { log } from "../core/logger";
import { ensureDockReady } from "../core/checks";
import { ensureFuel } from "../io/refuel";
import { wrapLocal, isEmpty } from "../io/inventory";

export class Executor {
  constructor(
    private cfg: AppConfig,
    private dir: Directory,
    private nav: NavLine,
    private state: State
  ) {}

  private findStationConfig(stationId: number) {
    for (const s of this.dir.stations) if (s.id === stationId) return s;
    return undefined;
  }

  run(job: Job): Result<{ stationId: number }> {
    if (job.kind !== "SERVE_STATION") return err("ERR_CONFIG_INVALID", { job });

    // Must start at dock (we rely on wired modem for sanity, and on linear routing)
    const dockRes = ensureDockReady(this.cfg);
    if (!dockRes.ok) return dockRes;

    // Fuel check/attempt (mechanics only)
    const fuelRes = ensureFuel(this.cfg);
    if (!fuelRes.ok && fuelRes.code !== "OK_NOOP") return fuelRes;

    const st = this.findStationConfig(job.stationId);
    if (!st) return err("ERR_CONFIG_INVALID", { stationId: job.stationId });

    // Navigate to station
    const goRes = this.nav.goToDistance(st.distanceSteps);
    if (!goRes.ok) {
      // Try to return home best-effort? We are likely mid-line; attempt to retreat same distance traveled is unknown.
      // In linear nav, safest is to stop and report.
      return goRes;
    }

    // Optional on-arrival sanity check: feed chest is below, and should still be empty (no-op if not empty)
    const localInvRes = wrapLocal("bottom");
    if (localInvRes.ok) {
      const emptyRes = isEmpty(localInvRes.value);
      if (emptyRes.ok && !emptyRes.value) {
        // Someone filled it already; no work needed
        const backRes = this.nav.returnHome(st.distanceSteps);
        if (!backRes.ok) return backRes;
        return okNoop({ stationId: st.id });
      }
    }

    // No item logic implemented: we just record a visit
    log.info("Visited station (no item logic)", { stationId: st.id });

    // Return home
    const backRes = this.nav.returnHome(st.distanceSteps);
    if (!backRes.ok) return backRes;

    // Re-ensure dock orientation after return
    const dock2 = ensureDockReady(this.cfg);
    if (!dock2.ok) return dock2;

    return okNoop({ stationId: st.id });
  }
}
