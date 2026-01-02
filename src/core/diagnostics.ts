import { AppConfig, STACK_SIZE } from "../types";

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

    // Processing chest (optional)
    if (config.peripherals.processingChest) {
        configured.set(config.peripherals.processingChest.name, ["Processing Chest"]);
    }

    // Unearther input chests
    for (const [id, unearther] of Object.entries(config.unearthers)) {
        const existing = configured.get(unearther.inputChest);
        if (existing) {
            existing.push(`Unearther: ${id}`);
        } else {
            configured.set(unearther.inputChest, [`Unearther: ${id}`]);
        }
    }

    return configured;
}

/**
 * Print startup diagnostics: network peripherals and configuration.
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

    // 2. Materials configuration
    printSection("MATERIALS");
    const materialEntries = Object.entries(config.materials);
    print(`  Total: ${materialEntries.length}`);
    print("");
    for (const [id, mat] of materialEntries) {
        print(`  ${id}:`);
        print(`    Item ID:   ${mat.itemId}`);
        print(`    Min Stock: ${mat.minStock}`);
        print(`    Weight:    ${mat.weight}`);
    }

    // 3. Unearther Types
    printSection("UNEARTHER TYPES");
    const typeEntries = Object.entries(config.uneartherTypes);
    print(`  Total: ${typeEntries.length}`);
    print("");
    for (const [id, typeDef] of typeEntries) {
        print(`  ${id}:`);
        print(`    Supported: ${typeDef.supportedMaterials.join(", ")}`);
    }

    // 4. Unearther Instances
    printSection("UNEARTHERS");
    const uneartherEntries = Object.entries(config.unearthers);
    print(`  Total: ${uneartherEntries.length}`);
    print("");
    for (const [id, unearther] of uneartherEntries) {
        print(`  ${id}:`);
        print(`    Type:        ${unearther.type}`);
        print(`    Input Chest: ${unearther.inputChest}`);
    }

    // 5. Processing Configuration
    printSection("PROCESSING");
    if (config.processing?.enabled) {
        print("  Status: ENABLED");
        print("");
        print(`  Min Input Reserve: ${config.processing.minInputReserve} (${config.processing.minInputReserve / STACK_SIZE} stacks)`);
        print(`  Max Output Stock:  ${config.processing.maxOutputStock} (${config.processing.maxOutputStock / STACK_SIZE} stacks)`);
        print("");
        print("  Processing Chain:");
        for (const [input, output] of Object.entries(config.processing.chain)) {
            print(`    ${input} -> ${output}`);
        }
    } else {
        print("  Status: DISABLED");
    }

    // 6. System Settings
    printSection("SYSTEM SETTINGS");
    print(`  Scan Interval:  ${config.system.scanIntervalSeconds}s`);
    print(`  Stack Size:     ${config.system.transferStackSize}`);
    print(`  Log Level:      ${config.system.logLevel}`);

    // End diagnostics
    print("");
    printSeparator("=");
    print("  END DIAGNOSTICS");
    printSeparator("=");
    print("");
}
