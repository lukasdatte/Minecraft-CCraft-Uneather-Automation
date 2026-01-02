import { CONFIG } from "./config";
import { log, initLogger } from "./core/logger";
import { validatePeripherals, ValidatedPeripherals } from "./registry/peripheral";
import { scanAllUnearthers, getInventoryContents } from "./engine/scanner";
import { createScheduler, WeightedScheduler } from "./engine/scheduler";
import { processEmptyUnearthers, TransferResult } from "./engine/transfer";
import { AppState } from "./types";

/**
 * Initialize application state.
 */
function createInitialState(): AppState {
  const uneartherStatus: AppState["uneartherStatus"] = {};

  for (const [id] of Object.entries(CONFIG.unearthers)) {
    uneartherStatus[id] = {
      id,
      isEmpty: false,
    };
  }

  return {
    uneartherStatus,
    totalTransfers: 0,
    lastScanTime: 0,
    warnings: [],
  };
}

/**
 * Update state after transfers.
 */
function updateState(
  state: AppState,
  transfers: TransferResult[]
): void {
  for (const transfer of transfers) {
    const status = state.uneartherStatus[transfer.unearther.id];
    if (status) {
      status.isEmpty = false;
      status.lastMaterial = transfer.materialId;
      status.lastTransferTime = os.epoch("utc");
    }
    state.totalTransfers++;
  }
  state.lastScanTime = os.epoch("utc");
}

/**
 * Main application entry point.
 */
function main(): void {
  print("==============================================");
  print("  Unearther Distribution System v2.0");
  print("==============================================");
  print("");

  // Validate critical config values
  if (CONFIG.system.scanIntervalSeconds <= 0) {
    print("ERROR: scanIntervalSeconds must be > 0");
    return;
  }

  // Initialize logger (without monitor for now)
  initLogger(CONFIG.system.logLevel);

  log.info("Boot sequence starting...");

  // 1. Validate all peripherals
  log.info("Phase 1: Validating peripherals...");
  const peripheralsRes = validatePeripherals(CONFIG);
  if (!peripheralsRes.ok) {
    log.error("Failed to validate peripherals", {
      code: peripheralsRes.code,
    });
    log.error("Please check your configuration and wired network.");
    return;
  }
  const peripherals: ValidatedPeripherals = peripheralsRes.value;
  log.info("Peripherals validated successfully");

  // 2. Initialize logger with monitor if available
  if (peripherals.monitor) {
    initLogger(CONFIG.system.logLevel, peripherals.monitor);
    log.info("Monitor connected");
  }

  // 3. Create scheduler
  const scheduler: WeightedScheduler = createScheduler(CONFIG);
  log.info("Scheduler initialized");

  // 4. Create initial state
  const state = createInitialState();
  log.info("State initialized");

  // 5. Log configuration summary
  log.info("Configuration summary", {
    unearthers: Object.keys(CONFIG.unearthers).length,
    materials: Object.keys(CONFIG.materials).length,
    uneartherTypes: Object.keys(CONFIG.uneartherTypes).length,
    scanInterval: CONFIG.system.scanIntervalSeconds,
    stackSize: CONFIG.system.transferStackSize,
  });

  print("");
  log.info("=== Starting main loop ===");
  print("");

  // Main loop
  while (true) {
    const loopStart = os.epoch("utc");

    // Phase 1: Scan all unearthers
    log.debug("Scanning unearthers...");
    const scanRes = scanAllUnearthers(CONFIG, peripherals.modem);

    if (!scanRes.ok) {
      log.error("Scan failed", { code: scanRes.code });
      sleep(CONFIG.system.scanIntervalSeconds);
      continue;
    }

    const { emptyUnearthers } = scanRes.value;

    // Update state with scan results
    for (const result of scanRes.value.results) {
      const status = state.uneartherStatus[result.id];
      if (status) {
        status.isEmpty = result.isEmpty;
      }
    }

    if (emptyUnearthers.length === 0) {
      log.debug("No empty unearthers, waiting...");
      sleep(CONFIG.system.scanIntervalSeconds);
      continue;
    }

    log.info("Found empty unearthers", { count: emptyUnearthers.length });

    // Phase 2: Get inventory contents
    log.debug("Scanning material source...");
    const contentsRes = getInventoryContents(peripherals.materialSource);

    if (!contentsRes.ok) {
      log.error("Failed to scan material source", { code: contentsRes.code });
      sleep(CONFIG.system.scanIntervalSeconds);
      continue;
    }

    const inventoryContents = contentsRes.value;
    log.debug("Material source scanned", {
      uniqueItems: inventoryContents.size,
    });

    // Phase 3: Process empty unearthers
    const transfers = processEmptyUnearthers(
      CONFIG,
      peripherals.materialSource,
      emptyUnearthers,
      (unearther, contents, stackSize) =>
        scheduler.selectMaterial(unearther, contents, stackSize),
      inventoryContents
    );

    // Phase 4: Update state
    if (transfers.length > 0) {
      updateState(state, transfers);
      log.info("Transfers complete", {
        successful: transfers.length,
        total: state.totalTransfers,
      });
    } else {
      log.debug("No transfers performed (materials unavailable or insufficient)");
    }

    // Phase 5: Sleep until next scan
    const elapsed = (os.epoch("utc") - loopStart) / 1000;
    const sleepTime = math.max(0.1, CONFIG.system.scanIntervalSeconds - elapsed);
    log.debug("Loop complete", { elapsed: string.format("%.2f", elapsed), sleepTime });

    sleep(sleepTime);
  }
}

// Run main
main();
