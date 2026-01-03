import { CONFIG } from "./config";
import { Logger } from "./core/logger";
import { printStartupDiagnostics } from "./core/diagnostics";
import { PeripheralRegistry, ValidatedPeripherals } from "./registry/peripheral";
import { Scanner } from "./engine/scanner";
import { Scheduler } from "./engine/scheduler";
import { TransferEngine, TransferResult } from "./engine/transfer";
import { ProcessingEngine } from "./engine/processing";
import { AppState, ProcessingResult } from "./types";

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
        totalProcessingOps: 0,
        lastScanTime: 0,
        warnings: [],
    };
}

/**
 * Update state after transfers.
 */
function updateState(
    state: AppState,
    transfers: TransferResult[],
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
 * Update state after processing operations.
 */
function updateProcessingState(
    state: AppState,
    results: ProcessingResult[],
): void {
    state.totalProcessingOps += results.length;
}

/**
 * Main application entry point.
 */
function main(): void {
    print("==============================================");
    print("  Unearther Distribution System v2.0");
    print("==============================================");
    print("");

    // Show startup diagnostics
    printStartupDiagnostics(CONFIG);

    // Validate critical config values
    if (CONFIG.system.scanIntervalSeconds <= 0) {
        print("ERROR: scanIntervalSeconds must be > 0");
        return;
    }

    // 1. Create Logger (no dependencies)
    const log = new Logger({
        level: CONFIG.system.logLevel,
        logFile: CONFIG.system.logFile,
    });

    log.info("Boot sequence starting...");

    // 2. Create PeripheralRegistry (needs: Logger)
    const peripheralRegistry = new PeripheralRegistry(log);

    // 3. Validate all peripherals
    log.info("Phase 1: Validating peripherals...");
    const peripheralsRes = peripheralRegistry.validate(CONFIG);
    if (!peripheralsRes.ok) {
        log.error("Failed to validate peripherals", {
            code: peripheralsRes.code,
        });
        log.error("Please check your configuration and wired network.");
        return;
    }
    const peripherals: ValidatedPeripherals = peripheralsRes.value;
    log.info("Peripherals validated successfully");

    // 4. Set monitor on logger if available
    if (peripherals.monitor) {
        log.setMonitor(peripherals.monitor);
        log.info("Monitor connected");
    }

    // 5. Create Scanner (needs: PeripheralRegistry, Logger)
    const scanner = new Scanner(peripheralRegistry, log);

    // 6. Create Scheduler (needs: Config, Logger)
    const scheduler = new Scheduler(CONFIG, log);
    log.info("Scheduler initialized");

    // 7. Create TransferEngine (needs: Logger)
    const transferEngine = new TransferEngine(log);

    // 8. Create ProcessingEngine (needs: Scanner, Logger)
    const processingEngine = new ProcessingEngine(scanner, log);

    // 9. Create initial state
    const state = createInitialState();
    log.info("State initialized");

    // 10. Log configuration summary
    log.info("Configuration summary", {
        unearthers: Object.keys(CONFIG.unearthers).length,
        materials: Object.keys(CONFIG.materials).length,
        uneartherTypes: Object.keys(CONFIG.uneartherTypes).length,
        scanInterval: CONFIG.system.scanIntervalSeconds,
        stackSize: CONFIG.system.transferStackSize,
        processingEnabled: CONFIG.processing?.enabled ?? false,
        processingChain: CONFIG.processing?.chain
            ? Object.keys(CONFIG.processing.chain).length
            : 0,
    });

    print("");
    log.info("=== Starting main loop ===");
    print("");

    // Main loop
    while (true) {
        const loopStart = os.epoch("utc");

        // Phase 1: Scan all unearthers
        log.debug("Scanning unearthers...");
        const scanRes = scanner.scanAllUnearthers(CONFIG, peripherals.modem);

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

        // Phase 2: Get inventory contents (needed for both processing and distribution)
        log.debug("Scanning material source...");
        const contentsRes = scanner.getInventoryContents(peripherals.materialSource);

        if (!contentsRes.ok) {
            log.error("Failed to scan material source", { code: contentsRes.code });
            sleep(CONFIG.system.scanIntervalSeconds);
            continue;
        }

        let inventoryContents = contentsRes.value;
        log.debug("Material source scanned", {
            uniqueItems: inventoryContents.size,
        });

        // Phase 2.5: Process materials (runs independently of unearthers)
        const processingRes = processingEngine.runPhase(
            CONFIG,
            peripherals.materialSource,
            peripherals.processingChest,
            peripherals.processingChestName,
        );

        if (processingRes.ok && processingRes.value.length > 0) {
            updateProcessingState(state, processingRes.value);
            log.info("Processing complete", {
                operations: processingRes.value.length,
                totalProcessingOps: state.totalProcessingOps,
            });

            // Re-scan inventory after processing (contents may have changed)
            const updatedContentsRes = scanner.getInventoryContents(peripherals.materialSource);
            if (updatedContentsRes.ok) {
                inventoryContents = updatedContentsRes.value;
            }
        } else if (!processingRes.ok) {
            // Log actual errors (not OK_NOOP which is a success code)
            log.warn("Processing phase error", { code: processingRes.code });
        }

        // Phase 3: Check for empty unearthers
        if (emptyUnearthers.length === 0) {
            log.debug("No empty unearthers, waiting...");
            sleep(CONFIG.system.scanIntervalSeconds);
            continue;
        }

        log.info("Found empty unearthers", { count: emptyUnearthers.length });

        // Phase 4: Process empty unearthers
        const transfers = transferEngine.processEmptyUnearthers(
            CONFIG,
            peripherals.materialSource,
            emptyUnearthers,
            (unearther, contents, stackSize) =>
                scheduler.selectMaterial(unearther, contents, stackSize),
            inventoryContents,
        );

        // Phase 5: Update state
        if (transfers.length > 0) {
            updateState(state, transfers);
            log.info("Transfers complete", {
                successful: transfers.length,
                total: state.totalTransfers,
            });
        } else {
            log.debug("No transfers performed (materials unavailable or insufficient)");
        }

        // Phase 6: Sleep until next scan
        const elapsed = (os.epoch("utc") - loopStart) / 1000;
        const sleepTime = math.max(0.1, CONFIG.system.scanIntervalSeconds - elapsed);
        log.debug("Loop complete", { elapsed: string.format("%.2f", elapsed), sleepTime });

        sleep(sleepTime);
    }
}

// Run main
main();
