import { AppConfig, STACK_SIZE } from "./types";

/**
 * Main application configuration.
 *
 * This is where you define:
 * - Peripherals (modem, material source, monitor)
 * - Materials (what items can be distributed, their weights and min stock)
 * - Unearther types (what materials each type can process)
 * - Unearther instances (actual unearthers on the network)
 */
export const CONFIG: AppConfig = {
    // ============================================================
    // PERIPHERALS - Network devices
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
        // monitor: {
        //   name: "monitor_0",
        //   type: "monitor",
        // },
        // Processing chest for material transformation chain (Hammer system)
        processingChest: {
            name: "minecraft:chest_4",
            type: "chest",
        },
    },

    // ============================================================
    // MATERIALS - What can be distributed
    // ============================================================
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

    // ============================================================
    // UNEARTHER TYPES - Worker Token types and their materials
    // ============================================================
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

    // ============================================================
    // UNEARTHERS - Actual instances on the network
    // ============================================================
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
            inputChest: "minecraft:chest_2",  // Platzhalter - später hinzufügen
        },*/
    },

    // ============================================================
    // SYSTEM - General settings
    // ============================================================
    system: {
        scanIntervalSeconds: 5,    // How often to check unearthers
        transferStackSize: 64,     // Items per transfer (full stack)
        logLevel: "debug",          // "debug" | "info" | "warn" | "error"
        logFile: "main.log",       // Log file path (optional)
    },

    // ============================================================
    // PROCESSING - Material transformation chain
    // ============================================================
    // See docs/material-processing.md for detailed documentation
    processing: {
        enabled: true,
        // Minimum items to keep in reserve (e.g., 2 * STACK_SIZE = 128 items)
        minInputReserve: 2 * STACK_SIZE,
        // Maximum items of output before stopping production (e.g., 4 * STACK_SIZE = 256 items)
        maxOutputStock: 4 * STACK_SIZE,
        // Processing chain: input item ID → output item ID
        chain: {
            "minecraft:cobblestone": "minecraft:dirt",
            "minecraft:dirt": "minecraft:gravel",
            "minecraft:gravel": "minecraft:sand",
            "minecraft:sand": "ftbstuff:dust",
        },
    },
};
