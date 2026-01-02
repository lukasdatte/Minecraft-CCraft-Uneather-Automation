import { AppConfig } from "./types";

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
      name: "left",  // Side where the wired modem is attached
      type: "modem",
    },
    // Central material source (drawer controller or chest)
    materialSource: {
      name: "storagedrawers:controller_0",  // Adjust to your peripheral name
      type: "drawer_controller",
    },
    // Optional: Status monitor for display
    // monitor: {
    //   name: "monitor_0",
    //   type: "monitor",
    // },
  },

  // ============================================================
  // MATERIALS - What can be distributed
  // ============================================================
  materials: {
    sand: {
      itemId: "minecraft:sand",
      minStock: 128,   // Keep at least 128 in storage
      weight: 3,       // 3x more likely to be selected
    },
    soul_sand: {
      itemId: "minecraft:soul_sand",
      minStock: 64,
      weight: 1,
    },
    gravel: {
      itemId: "minecraft:gravel",
      minStock: 64,
      weight: 1,
    },
    // Add more materials as needed:
    // dust: {
    //   itemId: "thermal:copper_dust",
    //   minStock: 256,
    //   weight: 2,
    // },
  },

  // ============================================================
  // UNEARTHER TYPES - What each type can process
  // ============================================================
  uneartherTypes: {
    brusher: {
      // Brushers can process sand and gravel
      supportedMaterials: ["sand", "gravel"],
    },
    soul_processor: {
      // Soul processors only handle soul sand
      supportedMaterials: ["soul_sand"],
    },
    // universal: {
    //   supportedMaterials: ["sand", "soul_sand", "gravel", "dust"],
    // },
  },

  // ============================================================
  // UNEARTHERS - Actual instances on the network
  // ============================================================
  unearthers: {
    unearther_1: {
      id: "unearther_1",
      type: "brusher",
      inputChest: "minecraft:chest_0",  // Adjust to your peripheral name
    },
    unearther_2: {
      id: "unearther_2",
      type: "soul_processor",
      inputChest: "minecraft:chest_1",  // Adjust to your peripheral name
    },
    unearther_3: {
      id: "unearther_3",
      type: "brusher",
      inputChest: "minecraft:chest_2",  // Adjust to your peripheral name
    },
  },

  // ============================================================
  // SYSTEM - General settings
  // ============================================================
  system: {
    scanIntervalSeconds: 2,    // How often to check unearthers
    transferStackSize: 64,     // Items per transfer (full stack)
    logLevel: "info",          // "debug" | "info" | "warn" | "error"
  },
};
