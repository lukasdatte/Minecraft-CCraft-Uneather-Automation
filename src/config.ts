import { AppConfig } from "./types";

export const CONFIG: AppConfig = {
  dock: {
    netSide: "left",
    autoRotateToMatch: true,
    // Optional: ensure we see a known peripheral in the wired network
    requiredRemote: [
      // "drawer_controller_1",
    ],
    // Optional second marker to make the dock unambiguous
    // markerSide: "back",
    // markerType: "chest",
  },

  base: {
    controllers: [
      // "drawer_controller_1",
      // "drawer_controller_2",
    ],
    // Optional refuel mechanics (pure infrastructure; no delivery logic)
    refuel: {
      enabled: false,
      minFuelLevel: 200,
      fuelChestDirection: "front",
      maxSuckTries: 8,
    },
  },

  world: {
    stepDistance: 3,
    allowDig: false,
    allowAttack: false,
    moveRetries: 10,
  },

  stations: [
    // Config-first: Station ↔ feedChest is fixed
    // { id: 1, feedChest: "minecraft:chest_12", distanceSteps: 1 },
    // { id: 2, feedChest: "minecraft:chest_13", distanceSteps: 2 },
  ],

  runtime: {
    scanIntervalSeconds: 5,
    printRemoteOnBoot: false,
    persistStatePath: "unearther_state.json",
    persistStateEveryJobs: 20,
    persistStateEverySeconds: 60,
  },
};
