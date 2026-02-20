import { CONFIG } from "./config";
import { Logger } from "./core/logger";
import { Dashboard, DashboardData } from "./core/dashboard";
import { printStartupDiagnostics } from "./core/diagnostics";
import { PeripheralRegistry } from "./registry/peripheral";
import { Scanner } from "./engine/scanner";
import { TaskRegistry } from "./tasks/registry";
import { TaskContext } from "./tasks/types";
import { HammeringTask } from "./tasks/hammering";
import { UnearthingTask } from "./tasks/unearthing";
import { HammeringState, UnearthingState } from "./types";

/**
 * Main application entry point.
 */
function main(): void {
    print("==============================================");
    print("  Unearther Distribution System v3.0");
    print("==============================================");
    print("");

    // 1. Create Logger
    const log = new Logger({
        level: CONFIG.system.logLevel,
        logFile: CONFIG.system.logFile,
        maxLogLines: CONFIG.system.maxLogLines,
    });

    log.info("Boot sequence starting...");

    // 2. Validate peripherals
    const peripheralRegistry = new PeripheralRegistry(log);
    const peripheralsRes = peripheralRegistry.validate(CONFIG);

    if (!peripheralsRes.ok) {
        log.error("Failed to validate peripherals", { code: peripheralsRes.code });
        return;
    }
    const peripherals = peripheralsRes.value;

    // 3. Create Dashboard if monitor available
    let dashboard: Dashboard | undefined;
    if (peripherals.monitor) {
        dashboard = new Dashboard(peripherals.monitor);
        log.info("Dashboard attached to monitor");
    }

    // 4. Print global diagnostics (network + system only)
    printStartupDiagnostics(CONFIG);

    // 5. Create TaskContext (shared resources)
    const taskContext: TaskContext = {
        peripherals,
        logger: log,
        systemConfig: {
            scanIntervalSeconds: CONFIG.system.scanIntervalSeconds,
            logLevel: CONFIG.system.logLevel,
        },
    };

    // 6. Create TaskRegistry and register tasks
    const taskRegistry = new TaskRegistry(log);

    // Order matters: Hammering before Unearthing!
    // This ensures materials are processed before distribution
    if (CONFIG.tasks.hammering.enabled) {
        taskRegistry.register(new HammeringTask(), CONFIG.tasks.hammering);
    }
    if (CONFIG.tasks.unearthing.enabled) {
        taskRegistry.register(new UnearthingTask(), CONFIG.tasks.unearthing);
    }

    // 7. Print task diagnostics
    taskRegistry.printDiagnostics();

    // 8. Initialize all tasks
    taskRegistry.init(taskContext);

    log.info("Configuration summary", {
        tasksRegistered: taskRegistry.getTaskCount(),
        tasksEnabled: taskRegistry.getEnabledTaskCount(),
        scanInterval: CONFIG.system.scanIntervalSeconds,
    });

    // 9. Create Scanner for inventory reads
    const scanner = new Scanner(log);

    print("");
    log.info("=== Starting main loop ===");
    print("");

    // 10. Main loop
    const startTime = os.epoch("utc");
    let cycleCount = 0;

    while (true) {
        const loopStart = os.epoch("utc");

        // Get current inventory (fresh scan each cycle)
        const inventoryRes = scanner.getInventoryContents(peripherals.materialSource);

        if (!inventoryRes.ok) {
            log.error("Failed to scan inventory", { code: inventoryRes.code });
            sleep(CONFIG.system.scanIntervalSeconds);
            continue;
        }

        // Run all tasks
        taskRegistry.runCycle(inventoryRes.value);
        cycleCount++;

        // Update dashboard
        if (dashboard) {
            const taskStates = taskRegistry.getTaskStates();
            const dashboardData: DashboardData = {
                inventory: inventoryRes.value,
                materials: CONFIG.tasks.unearthing.materials,
                hammeringState: (taskStates.get("hammering") as HammeringState) ?? null,
                unearthingState: (taskStates.get("unearthing") as UnearthingState) ?? null,
                unearthers: CONFIG.tasks.unearthing.unearthers,
                cycleCount,
                startTime,
            };
            dashboard.update(dashboardData);
        }

        // Sleep until next cycle
        const elapsed = (os.epoch("utc") - loopStart) / 1000;
        const sleepTime = math.max(0.1, CONFIG.system.scanIntervalSeconds - elapsed);
        sleep(sleepTime);
    }
}

// Run main
main();
