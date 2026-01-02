export type Side = "left" | "right" | "front" | "back" | "top" | "bottom";

export interface DockConfig {
  netSide: Side;                 // side where the WIRED modem must be adjacent at the dock
  requiredRemote?: string[];     // remote peripherals that must be visible (ensures correct network)
  autoRotateToMatch: boolean;    // turtle rotates up to 4 times to match netSide
  markerSide?: Side;             // optional extra dock marker side
  markerType?: string;           // optional expected peripheral type on marker side
}

export interface RefuelConfig {
  enabled: boolean;
  minFuelLevel: number;          // if fuel < minFuelLevel, attempt refuel at dock
  fuelChestDirection: "front" | "back" | "left" | "right" | "up" | "down"; // where turtle sucks fuel from
  maxSuckTries: number;
}

export interface StationConfig {
  id: number;                    // 1..N
  feedChest: string;             // remote peripheral name (config-first)
  distanceSteps: number;         // station index in steps (distanceSteps * stepDistance blocks)
}

export interface BaseConfig {
  controllers: string[];         // drawer controller(s) peripheral names (remote inventories)
  refuel?: RefuelConfig;
}

export interface WorldConfig {
  stepDistance: number;          // blocks between stations
  allowDig: boolean;             // whether nav can dig blocks to proceed
  allowAttack: boolean;          // whether nav can attack entities to proceed
  moveRetries: number;           // retries per step
}

export interface RuntimeConfig {
  scanIntervalSeconds: number;
  printRemoteOnBoot: boolean;
  persistStatePath: string;      // file path on turtle
  persistStateEveryJobs: number; // save every N jobs (0 disables)
  persistStateEverySeconds: number; // save if interval elapsed (0 disables)
}

export interface AppConfig {
  dock: DockConfig;
  base: BaseConfig;
  world: WorldConfig;
  stations: StationConfig[];
  runtime: RuntimeConfig;
}

export type JobKind = "SERVE_STATION";

export interface Job {
  kind: JobKind;
  stationId: number;
  createdAtUtc: number;
  reason: "FEED_EMPTY";
}
