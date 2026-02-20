import { CONFIG } from "./config";
import { Logger } from "@core/logger";
import { validatePeripherals, retryMissingChests } from "@lib/peripheral/registry";
import { getInventoryContents } from "@lib/inventory/scanner";
import { TaskRegistry } from "@lib/task/registry";
import { TaskContext } from "@lib/task/types";
import { DashboardRenderer } from "@lib/dashboard/renderer";
import { HeaderWidget } from "@lib/dashboard/widgets/header";
import { StockTableWidget, StockEntry } from "@lib/dashboard/widgets/stock-table";
import { MachineStatusWidget } from "@lib/dashboard/widgets/machine-status";
import { ProductionTask } from "@apps/production/task";
import { DistributionTask } from "@apps/distribution/task";
import { ProductionState } from "@apps/production/types";
import { DistributionState } from "@apps/distribution/types";

/**
 * Main application entry point.
 */
function main(): void {
    print("==============================================");
    print("  Unearther Distribution System v4.0");
    print("  (Modular Orchestrator Architecture)");
    print("==============================================");
    print("");

    // 1. Create Logger
    const log = new Logger({
        level: CONFIG.system.logLevel,
        logFile: CONFIG.system.logFile,
        maxLogLines: CONFIG.system.maxLogLines,
    });

    log.info("Boot sequence starting...");

    // 2. Collect all chest names from task configs
    const chestNames: string[] = [];

    if (CONFIG.production.enabled) {
        for (const machine of CONFIG.production.machines) {
            chestNames.push(machine.inputChest);
        }
    }
    if (CONFIG.distribution.enabled) {
        for (const machine of CONFIG.distribution.machines) {
            chestNames.push(machine.inputChest);
        }
    }

    // 3. Validate peripherals
    const peripheralsRes = validatePeripherals(
        {
            modemSide: CONFIG.peripherals.modem.name,
            materialSourceName: CONFIG.peripherals.materialSource.name,
            monitorName: CONFIG.peripherals.monitor?.name,
            chestNames,
        },
        log,
    );

    if (!peripheralsRes.ok) {
        log.error("Failed to validate peripherals", { code: peripheralsRes.code });
        return;
    }
    const peripherals = peripheralsRes.value;

    // 4. Create Dashboard if monitor available
    let dashboard: DashboardRenderer | undefined;
    let headerWidget: HeaderWidget | undefined;
    let stockWidget: StockTableWidget | undefined;
    let productionMachineWidget: MachineStatusWidget | undefined;
    let distributionMachineWidget: MachineStatusWidget | undefined;

    if (peripherals.monitor) {
        dashboard = new DashboardRenderer(peripherals.monitor);

        // Header widget
        headerWidget = new HeaderWidget("Unearther Distribution System");
        dashboard.addWidget(headerWidget);

        // Stock widget - build entries from production targets and distribution materials
        stockWidget = new StockTableWidget();
        const stockEntries: StockEntry[] = [];
        const seenItemIds = new Set<string>();

        if (CONFIG.production.enabled) {
            for (const target of CONFIG.production.stockTargets) {
                stockEntries.push({
                    name: target.itemId.split(":")[1] ?? target.itemId,
                    itemId: target.itemId,
                    minStock: target.targetCount,
                });
                seenItemIds.add(target.itemId);
            }
        }
        if (CONFIG.distribution.enabled) {
            for (const [matId, matDef] of Object.entries(CONFIG.distribution.materials)) {
                if (seenItemIds.has(matDef.itemId)) continue; // Deduplizierung
                stockEntries.push({
                    name: matId,
                    itemId: matDef.itemId,
                    minStock: matDef.minStock,
                });
                seenItemIds.add(matDef.itemId);
            }
        }
        stockWidget.setEntries(stockEntries);
        dashboard.addWidget(stockWidget);

        // Production machine status
        if (CONFIG.production.enabled) {
            productionMachineWidget = new MachineStatusWidget(
                "production-machines",
                "Production",
                20,
            );
            dashboard.addWidget(productionMachineWidget);
        }

        // Distribution machine status
        if (CONFIG.distribution.enabled) {
            distributionMachineWidget = new MachineStatusWidget(
                "distribution-machines",
                "Distribution",
                30,
            );
            dashboard.addWidget(distributionMachineWidget);
        }

        log.info("Dashboard attached to monitor");
    }

    // 5. Create TaskContext
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

    // Production before Distribution (ensure materials are processed first)
    if (CONFIG.production.enabled) {
        taskRegistry.register(new ProductionTask(), CONFIG.production);
    }
    if (CONFIG.distribution.enabled) {
        taskRegistry.register(new DistributionTask(), CONFIG.distribution);
    }

    // 7. Print diagnostics and initialize
    taskRegistry.printDiagnostics();
    taskRegistry.init(taskContext);

    log.info("Configuration summary", {
        tasksRegistered: taskRegistry.getTaskCount(),
        tasksEnabled: taskRegistry.getEnabledTaskCount(),
        scanInterval: CONFIG.system.scanIntervalSeconds,
    });

    print("");
    log.info("=== Starting main loop ===");
    print("");

    // 8. Main loop
    const startTime = os.epoch("utc");
    let cycleCount = 0;

    while (true) {
        const loopStart = os.epoch("utc");

        // Get current inventory (fresh scan each cycle)
        const inventoryRes = getInventoryContents(peripherals.materialSource);

        if (!inventoryRes.ok) {
            log.error("Failed to scan inventory", { code: inventoryRes.code });
            sleep(CONFIG.system.scanIntervalSeconds);
            continue;
        }

        // Run all tasks
        taskRegistry.runCycle(inventoryRes.value);
        cycleCount++;

        // Periodically retry missing chests (every 12 cycles ~= 1 minute at 5s interval)
        if (cycleCount % 12 === 0) {
            retryMissingChests(peripherals.modem, chestNames, peripherals.machineChests, log);
        }

        // Update dashboard (uses inventoryRes from cycle start, no rescan needed)
        if (dashboard) {
            headerWidget!.update(cycleCount, startTime);
            stockWidget!.updateInventory(inventoryRes.value);

            // Update production machine status from task state
            const taskStates = taskRegistry.getTaskStates();

            if (productionMachineWidget && CONFIG.production.enabled) {
                const prodState = taskStates.get("production") as ProductionState | undefined;
                productionMachineWidget.update(
                    CONFIG.production.machines.map((m) => {
                        const status = prodState?.machineStatus[m.id];
                        return {
                            id: m.id,
                            isEmpty: status?.isEmpty ?? true,
                            lastMaterial: status?.lastMaterial,
                        };
                    }),
                );
            }

            if (distributionMachineWidget && CONFIG.distribution.enabled) {
                const distState = taskStates.get("distribution") as DistributionState | undefined;
                distributionMachineWidget.update(
                    CONFIG.distribution.machines.map((m) => {
                        const status = distState?.machineStatus[m.id];
                        return {
                            id: m.id,
                            isEmpty: status?.isEmpty ?? true,
                            lastMaterial: status?.lastMaterial,
                        };
                    }),
                );
            }

            dashboard.render();
        }

        // Sleep until next cycle
        const elapsed = (os.epoch("utc") - loopStart) / 1000;
        const sleepTime = math.max(0.1, CONFIG.system.scanIntervalSeconds - elapsed);
        sleep(sleepTime);
    }
}

// Run main
main();
