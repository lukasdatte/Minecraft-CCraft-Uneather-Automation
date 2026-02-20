import { AppConfig, STACK_SIZE } from "./types";

/**
 * Main application configuration.
 *
 * This is where you define:
 * - Global peripherals (modem, material source, monitor)
 * - System settings (scan interval, log level)
 * - Task-specific configurations:
 *   - Hammering: Material processing chain (Cobblestone → Gravel → Dirt → Sand → Dust)
 *   - Unearthing: Material distribution to unearthers
 */
export const CONFIG: AppConfig = {
    // ============================================================
    // GLOBAL PERIPHERALS - Shared by all tasks
    // ============================================================
    peripherals: {
        // Wired modem attached to the computer
        modem: {
            name: "back",
            type: "modem",
        },
        // Central material source (Functional Storage controller)
        materialSource: {
            name: "functionalstorage:storage_controller_0",
            type: "inventory",
        },
        // Optional: Status monitor for display
        monitor: {
            name: "monitor_0",
            type: "monitor",
        },
    },

    // ============================================================
    // SYSTEM - General settings
    // ============================================================
    system: {
        scanIntervalSeconds: 5, // How often to check unearthers
        logLevel: "debug", // "debug" | "info" | "warn" | "error"
        logFile: "main.log", // Log file path (optional)
    },

    // ============================================================
    // TASKS - Task-specific configurations
    // ============================================================
    tasks: {
        // --------------------------------------------------------
        // HAMMERING TASK - Material processing chain
        // --------------------------------------------------------
        // See docs/material-processing.md for detailed documentation
        hammering: {
            enabled: true,

            // Processing chest for hammer chain input
            processingChest: {
                name: "minecraft:chest_4",
                type: "chest",
            },

            // Minimum items to keep in reserve (e.g., 2 * STACK_SIZE = 128 items)
            minInputReserve: 2 * STACK_SIZE,

            // Maximum items of output before stopping production
            maxOutputStock: 128 * STACK_SIZE,

            // Processing chain: input item ID → output item ID
            // Cobblestone → Gravel → Dirt → Sand → Dust
            chain: {
                "minecraft:cobblestone": "minecraft:gravel",
                "minecraft:gravel": "minecraft:dirt",
                "minecraft:dirt": "minecraft:sand",
                "minecraft:sand": "ftbstuff:dust",
            },
        },

        // --------------------------------------------------------
        // UNEARTHING TASK - Material distribution
        // --------------------------------------------------------
        unearthing: {
            enabled: true,

            // Items per transfer (full stack)
            transferStackSize: 64,

            // Material definitions
            materials: {
                // Archaeologist materials
                dirt: {
                    itemId: "minecraft:dirt",
                    minStock: 64,
                    weight: 0,
                },
                sand: {
                    itemId: "minecraft:sand",
                    minStock: 64,
                    weight: 1,
                },
                dust: {
                    itemId: "ftbstuff:dust",
                    minStock: 64,
                    weight: 1,
                },
                // Geologist materials
                soul_sand: {
                    itemId: "minecraft:soul_sand",
                    minStock: 64,
                    weight: 1,
                },
                gravel: {
                    itemId: "minecraft:gravel",
                    minStock: 64,
                    weight: 2,
                },
                cobblestone: {
                    itemId: "minecraft:cobblestone",
                    minStock: 64,
                    weight: 1,
                },
                crushed_kivi: {
                    itemId: "ftb:crushed_kivi",
                    minStock: 64,
                    weight: 1,
                },
                // Dimensionalist materials
                otherrock: {
                    itemId: "occultism:otherrock",
                    minStock: 64,
                    weight: 1,
                },
                netherrack: {
                    itemId: "minecraft:netherrack",
                    minStock: 64,
                    weight: 1,
                },
                end_stone: {
                    itemId: "minecraft:end_stone",
                    minStock: 64,
                    weight: 1,
                },
            },

            // Unearther types and their supported materials
            uneartherTypes: {
                archaeologist: {
                    // Archaeologist: Dirt, Sand, Dust
                    supportedMaterials: ["dirt", "sand", "dust"],
                },
                geologist: {
                    // Geologist: Soul Sand, Gravel, Cobblestone, Crushed Kivi
                    supportedMaterials: ["soul_sand", "gravel", "cobblestone", "crushed_kivi"],
                },
                dimensionalist: {
                    // Dimensionalist: Otherrock, Netherrack, Endstone
                    supportedMaterials: ["otherrock", "netherrack", "end_stone"],
                },
            },

            // Unearther instances on the network
            unearthers: {
                archaeologist_1: {
                    id: "archaeologist_1",
                    type: "archaeologist",
                    inputChest: "minecraft:chest_0",
                },
                geologist_1: {
                    id: "geologist_1",
                    type: "geologist",
                    inputChest: "minecraft:chest_1",
                },
                /*dimensionalist_1: {
                    id: "dimensionalist_1",
                    type: "dimensionalist",
                    inputChest: "minecraft:chest_2",  // Placeholder - add later
                },*/
            },
        },
    },
};
