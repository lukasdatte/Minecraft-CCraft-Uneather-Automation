import { AppConfig, StationConfig } from "../types";
import { Result, ok, err } from "../core/result";
import { WiredModem, getWiredModemOnSide } from "./wired";
import { log } from "../core/logger";

export interface Directory {
  modem: WiredModem;
  baseControllers: string[];
  stations: StationConfig[];
}

export function buildDirectory(config: AppConfig): Result<Directory> {
  const mRes = getWiredModemOnSide(config.dock.netSide);
  if (!mRes.ok) return mRes;

  const modem = mRes.value;

  // Config-first validation: all configured peripherals must be visible
  for (const c of config.base.controllers) {
    if (!modem.isPresentRemote(c)) return err("ERR_PERIPHERAL_OFFLINE", { missing: c, kind: "baseController" });
  }
  for (const s of config.stations) {
    if (!modem.isPresentRemote(s.feedChest)) return err("ERR_PERIPHERAL_OFFLINE", { missing: s.feedChest, stationId: s.id, kind: "feedChest" });
  }

  // Validate station IDs uniqueness
  const seen: Record<number, boolean> = {};
  for (const s of config.stations) {
    if (seen[s.id]) return err("ERR_CONFIG_INVALID", { duplicateStationId: s.id });
    seen[s.id] = true;
  }

  return ok({
    modem,
    baseControllers: config.base.controllers,
    stations: config.stations,
  });
}

export function printRemoteIfEnabled(config: AppConfig, dir: Directory) {
  if (!config.runtime.printRemoteOnBoot) return;
  const names = dir.modem.getNamesRemote();
  log.info("Remote peripherals", { count: names.length });
  for (const n of names) print(" - " + n);
}
