import { AppConfig } from "../types";

/**
 * Print a separator line.
 */
function printSeparator(char = "-", length = 50): void {
    print(string.rep(char, length));
}

/**
 * Print a section header.
 */
function printSection(title: string): void {
    print("");
    printSeparator("=");
    print(`  ${title}`);
    printSeparator("=");
}

/**
 * Get all configured peripheral names from config.
 */
function getConfiguredPeripheralNames(config: AppConfig): Map<string, string[]> {
    const configured = new Map<string, string[]>();

    // Modem (side-based, not network)
    configured.set(config.peripherals.modem.name, ["Modem (local)"]);

    // Material source
    configured.set(config.peripherals.materialSource.name, ["Material Source"]);

    // Monitor (optional)
    if (config.peripherals.monitor) {
        configured.set(config.peripherals.monitor.name, ["Monitor"]);
    }

    // Processing chest (from hammering task)
    if (config.tasks.hammering.enabled && config.tasks.hammering.processingChest) {
        configured.set(config.tasks.hammering.processingChest.name, ["Processing Chest"]);
    }

    // Unearther input chests (from unearthing task)
    if (config.tasks.unearthing.enabled) {
        for (const [id, unearther] of Object.entries(config.tasks.unearthing.unearthers)) {
            const existing = configured.get(unearther.inputChest);
            if (existing) {
                existing.push(`Unearther: ${id}`);
            } else {
                configured.set(unearther.inputChest, [`Unearther: ${id}`]);
            }
        }
    }

    return configured;
}

/**
 * Print startup diagnostics: network peripherals and system settings.
 * Task-specific diagnostics are printed by the tasks themselves.
 */
export function printStartupDiagnostics(config: AppConfig): void {
    printSection("STARTUP DIAGNOSTICS");

    // 1. Try to get modem and list network peripherals
    print("");
    print(">> Network Peripherals");
    printSeparator();

    const modemSide = config.peripherals.modem.name;
    const modem = peripheral.wrap(modemSide);

    if (!modem) {
        print(`  [!] No modem found on side: ${modemSide}`);
        print("      Check that a wired modem is attached.");
    } else {
        // Check if it's a wired modem
        const isWireless = (modem as { isWireless?: () => boolean }).isWireless?.();
        if (isWireless) {
            print(`  [!] Modem on '${modemSide}' is wireless!`);
            print("      This system requires a WIRED modem.");
        } else {
            const getNamesRemote = (modem as { getNamesRemote?: () => string[] }).getNamesRemote;
            if (getNamesRemote) {
                const remoteNames = getNamesRemote();
                const configuredNames = getConfiguredPeripheralNames(config);

                print(`  Modem side: ${modemSide}`);
                print(`  Remote peripherals found: ${remoteNames.length}`);
                print("");

                if (remoteNames.length === 0) {
                    print("  [!] No peripherals connected to network!");
                    print("      - Right-click each wired modem to activate (turns red)");
                    print("      - Ensure cables connect all modems");
                } else {
                    // Sort names for consistent display
                    const sortedNames = [...remoteNames].sort();

                    for (const name of sortedNames) {
                        const roles = configuredNames.get(name);
                        if (roles) {
                            print(`  [OK] ${name}`);
                            for (const role of roles) {
                                print(`       -> ${role}`);
                            }
                        } else {
                            print(`  [ ] ${name}`);
                            print("       -> (not configured)");
                        }
                    }
                }

                // Check for configured peripherals that are NOT in the network
                print("");
                print(">> Configuration Validation");
                printSeparator();

                let missingCount = 0;
                for (const [name, roles] of configuredNames) {
                    // Skip modem (it's local, not remote)
                    if (name === modemSide) continue;

                    if (!remoteNames.includes(name)) {
                        if (missingCount === 0) {
                            print("  Missing peripherals (configured but not found):");
                        }
                        print(`  [X] ${name}`);
                        for (const role of roles) {
                            print(`       -> ${role}`);
                        }
                        missingCount++;
                    }
                }

                if (missingCount === 0) {
                    print("  All configured peripherals found in network!");
                } else {
                    print("");
                    print(`  [!] ${missingCount} peripheral(s) missing from network`);
                }
            }
        }
    }

    // 2. System Settings
    printSection("SYSTEM SETTINGS");
    print(`  Scan Interval: ${config.system.scanIntervalSeconds}s`);
    print(`  Log Level:     ${config.system.logLevel}`);

    // 3. Task Status
    print("");
    print(">> Task Status");
    printSeparator();
    print(`  Hammering:  ${config.tasks.hammering.enabled ? "ENABLED" : "DISABLED"}`);
    print(`  Unearthing: ${config.tasks.unearthing.enabled ? "ENABLED" : "DISABLED"}`);

    // End diagnostics
    print("");
    printSeparator("=");
    print("  END DIAGNOSTICS");
    printSeparator("=");
    print("");
}
