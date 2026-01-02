import { AppConfig } from "../types";
import { log } from "./logger";
import { State } from "./state";

export class Storage {
  private cfg: AppConfig;

  constructor(cfg: AppConfig) {
    this.cfg = cfg;
  }

  trySave(state: State) {
    const path = this.cfg.runtime.persistStatePath;
    if (!path || this.cfg.runtime.persistStateEveryJobs === 0 && this.cfg.runtime.persistStateEverySeconds === 0) return;

    const data = {
      lastScanAtUtc: state.lastScanAtUtc,
      stationEmpty: state.stationEmpty,
      stationLastServedUtc: state.stationLastServedUtc,
      jobsExecuted: state.jobsExecuted,
      jobHistory: state.jobHistory,
      savedAtUtc: os.epoch("utc"),
    };

    const [okOpen, h] = pcall(() => fs.open(path, "w")) as unknown as [boolean, any];
    if (!okOpen || !h) {
      log.warn("Persist open failed", { path });
      return;
    }
    h.write(textutils.serializeJSON(data));
    h.close();
    state.lastPersistAtUtc = os.epoch("utc");
  }

  trySaveIfInterval(state: State) {
    const interval = this.cfg.runtime.persistStateEverySeconds;
    if (!interval || interval <= 0) return;
    const now = os.epoch("utc");
    const last = state.lastPersistAtUtc ?? 0;
    if (now - last >= interval * 1000) this.trySave(state);
  }

  tryLoad(state: State) {
    const path = this.cfg.runtime.persistStatePath;
    if (!path || !fs.exists(path)) return;

    const [okOpen, h] = pcall(() => fs.open(path, "r")) as unknown as [boolean, any];
    if (!okOpen || !h) return;

    const content = h.readAll();
    h.close();

    const [okJson, obj] = pcall(() => textutils.unserializeJSON(content)) as unknown as [boolean, any];
    if (!okJson || !obj) return;

    // restore what we care about
    state.lastScanAtUtc = obj.lastScanAtUtc;
    state.stationEmpty = obj.stationEmpty ?? {};
    state.stationLastServedUtc = obj.stationLastServedUtc ?? {};
    state.jobsExecuted = obj.jobsExecuted ?? 0;
    state.jobHistory = obj.jobHistory ?? [];
    state.lastPersistAtUtc = obj.savedAtUtc ?? os.epoch("utc");
    log.info("State loaded", { path, jobsExecuted: state.jobsExecuted });
  }
}
