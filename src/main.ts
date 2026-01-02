import { CONFIG } from "./config";
import { log } from "./core/logger";
import { State } from "./core/state";
import { ensureDockReady, ensureFuelOk } from "./core/checks";
import { buildDirectory, printRemoteIfEnabled } from "./net/registry";
import { Scanner } from "./engine/scanner";
import { Queue } from "./engine/queue";
import { Executor } from "./engine/executor";
import { NavLine } from "./world/nav_line";
import { Storage } from "./core/storage";

function main() {
  const state = new State(CONFIG);
  const storage = new Storage(CONFIG);

  log.info("Boot", { version: "0.2-infra-complete" });

  // 0) Optional: rehydrate runtime state
  storage.tryLoad(state);

  // 1) Dock orientieren & prüfen
  const dockRes = ensureDockReady(CONFIG);
  if (!dockRes.ok) {
    log.error("Dock not ready", dockRes);
    return;
  }

  // 2) Config-first Registry/Directory bauen & validieren
  const dirRes = buildDirectory(CONFIG);
  if (!dirRes.ok) {
    log.error("Registry invalid", dirRes);
    return;
  }
  const dir = dirRes.value;

  printRemoteIfEnabled(CONFIG, dir);

  log.info("Registry OK", {
    stations: dir.stations.length,
    controllers: dir.baseControllers.length,
  });

  const nav = new NavLine(CONFIG);
  const scanner = new Scanner(CONFIG, dir, state);
  const queue = new Queue();
  const executor = new Executor(CONFIG, dir, nav, state);

  // Main loop
  while (true) {
    // Ensure dock still OK before scanning
    const dockOk = ensureDockReady(CONFIG);
    if (!dockOk.ok) {
      log.error("Dock lost", dockOk);
      sleep(2);
      continue;
    }

    // Optional fuel check at dock
    const fuelRes = ensureFuelOk(CONFIG);
    if (!fuelRes.ok) {
      log.warn("Fuel check failed", fuelRes);
      // we keep running; executor will also check before moving
    }

    // Scan -> Jobs
    const scanRes = scanner.scan();
    if (!scanRes.ok) {
      log.warn("Scan failed", scanRes);
    } else {
      for (const job of scanRes.value.jobs) queue.push(job);
      log.info("Scan", { jobsQueued: scanRes.value.jobs.length, queueSize: queue.size() });
    }

    // Execute queue
    while (!queue.isEmpty()) {
      const job = queue.pop();
      if (!job) break;

      const res = executor.run(job);
      state.recordJobResult(job, res);

      if (!res.ok) log.warn("Job failed", { job, res });
      else log.info("Job ok", { job, res });

      // Persist runtime state occasionally
      if (CONFIG.runtime.persistStateEveryJobs > 0 && state.jobsExecuted % CONFIG.runtime.persistStateEveryJobs === 0) {
        storage.trySave(state);
      }
    }

    state.lastScanAtUtc = os.epoch("utc");
    storage.trySaveIfInterval(state);
    sleep(CONFIG.runtime.scanIntervalSeconds);
  }
}

main();
