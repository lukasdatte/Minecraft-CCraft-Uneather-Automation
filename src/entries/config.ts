import { AppConfig } from "./types";

const STACK_SIZE = 64;

/**
 * Configuration for the main Unearther/Production computer.
 *
 * Hardware setup:
 * - 1x Functional Storage Controller (central material source)
 * - 1x Processing Chest (shared hammer input, pipes distribute to hammers)
 * - 2x Unearther input chests (archaeologist, geologist)
 * - 1x Monitor for status display
 */
export const CONFIG: AppConfig = {
    // ============================================================
    // GLOBAL PERIPHERALS
    // ============================================================
    peripherals: {
        modem: { name: "back", type: "modem" },
        materialSource: {
            name: "functionalstorage:storage_controller_0",
            type: "inventory",
        },
        monitor: {
            name: "monitor_0",
            type: "monitor",
        },
    },

    // ============================================================
    // SYSTEM
    // ============================================================
    system: {
        scanIntervalSeconds: 5,
        logLevel: "debug",
        logFile: "main.log",
    },

    // ============================================================
    // PRODUCTION - Hammer chain (Cobblestone → Gravel → Dirt → Sand → Dust)
    // ============================================================
    production: {
        enabled: true,

        // Single machine representing the shared processing chest
        // (pipes behind it distribute to multiple physical hammers)
        machines: [
            { id: "hammer_chain", type: "hammer", inputChest: "minecraft:chest_4" },
        ],

        // Recipes: what each hammer type can process
        recipes: {
            hammer: [
                { input: "minecraft:cobblestone", output: "minecraft:gravel" },
                { input: "minecraft:gravel", output: "minecraft:dirt" },
                { input: "minecraft:dirt", output: "minecraft:sand" },
                { input: "minecraft:sand", output: "ftbstuff:dust" },
            ],
        },

        // What we want to produce and how urgently
        stockTargets: [
            { itemId: "minecraft:gravel", targetCount: 128 * STACK_SIZE, weight: 1 },
            { itemId: "minecraft:dirt", targetCount: 128 * STACK_SIZE, weight: 1 },
            { itemId: "minecraft:sand", targetCount: 128 * STACK_SIZE, weight: 1 },
            { itemId: "ftbstuff:dust", targetCount: 128 * STACK_SIZE, weight: 1 },
        ],

        // Keep at least 2 stacks of input material in reserve
        minInputReserve: 2 * STACK_SIZE,

        // Transfer 1 stack at a time
        transferAmount: STACK_SIZE,
    },

    // ============================================================
    // DISTRIBUTION - Material distribution to unearthers
    // ============================================================
    distribution: {
        enabled: true,

        // Machines (unearthers)
        machines: [
            { id: "archaeologist_1", type: "archaeologist", inputChest: "minecraft:chest_0" },
            { id: "geologist_1", type: "geologist", inputChest: "minecraft:chest_1" },
        ],

        // Material definitions
        materials: {
            // weight 0: Wird primaer fuer Sand-Produktion benoetigt, nur als Fallback verteilt
            dirt: {
                id: "dirt",
                itemId: "minecraft:dirt",
                minStock: 64,
                weight: 0,
            },
            sand: {
                id: "sand",
                itemId: "minecraft:sand",
                minStock: 64,
                weight: 1,
            },
            dust: {
                id: "dust",
                itemId: "ftbstuff:dust",
                minStock: 64,
                weight: 1,
            },
            soul_sand: {
                id: "soul_sand",
                itemId: "minecraft:soul_sand",
                minStock: 64,
                weight: 1,
            },
            gravel: {
                id: "gravel",
                itemId: "minecraft:gravel",
                minStock: 64,
                weight: 2,
            },
            cobblestone: {
                id: "cobblestone",
                itemId: "minecraft:cobblestone",
                minStock: 64,
                weight: 1,
            },
            crushed_kivi: {
                id: "crushed_kivi",
                itemId: "ftb:crushed_kivi",
                minStock: 64,
                weight: 1,
            },
            otherrock: {
                id: "otherrock",
                itemId: "occultism:otherrock",
                minStock: 64,
                weight: 1,
            },
            netherrack: {
                id: "netherrack",
                itemId: "minecraft:netherrack",
                minStock: 64,
                weight: 1,
            },
            end_stone: {
                id: "end_stone",
                itemId: "minecraft:end_stone",
                minStock: 64,
                weight: 1,
            },
        },

        // Machine type definitions
        machineTypes: {
            archaeologist: {
                id: "archaeologist",
                supportedMaterials: ["dirt", "sand", "dust"],
            },
            geologist: {
                id: "geologist",
                supportedMaterials: ["soul_sand", "gravel", "cobblestone", "crushed_kivi"],
            },
            // Vorbereitung fuer zukuenftige Hardware
            dimensionalist: {
                id: "dimensionalist",
                supportedMaterials: ["otherrock", "netherrack", "end_stone"],
            },
        },

        // Items per transfer
        transferAmount: 64,
    },
};
