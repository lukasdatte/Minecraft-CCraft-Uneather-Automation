import { LogLevel, MonitorPeripheral } from "../types";

/** Format data for logging */
function fmt(obj: unknown): string {
  if (obj === undefined || obj === null) return "";
  return " " + textutils.serialize(obj);
}

/** Get timestamp string */
function timestamp(): string {
  const time = os.time("local") as number;
  const hours = math.floor(time);
  const minutes = math.floor((time - hours) * 60);
  return string.format("%02d:%02d", hours, minutes);
}

/** Log level priorities (lower = more verbose) */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Logger configuration */
interface LoggerConfig {
  level: LogLevel;
  monitor?: MonitorPeripheral;
  monitorLines: string[];
  maxMonitorLines: number;
}

/** Global logger state */
const loggerState: LoggerConfig = {
  level: "info",
  monitor: undefined,
  monitorLines: [],
  maxMonitorLines: 20,
};

/**
 * Initialize the logger with configuration.
 */
export function initLogger(level: LogLevel, monitor?: MonitorPeripheral): void {
  loggerState.level = level;
  loggerState.monitor = monitor;
  loggerState.monitorLines = [];

  if (monitor) {
    const [, height] = monitor.getSize();
    loggerState.maxMonitorLines = height - 2; // Leave room for header
    monitor.setTextScale(0.5);
    monitor.clear();
  }
}

/**
 * Check if a log level should be displayed.
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[loggerState.level];
}

/**
 * Write to monitor if available.
 */
function writeToMonitor(prefix: string, msg: string): void {
  if (!loggerState.monitor) return;

  const line = `${timestamp()} ${prefix} ${msg}`;
  loggerState.monitorLines.push(line);

  // Keep only the last N lines
  while (loggerState.monitorLines.length > loggerState.maxMonitorLines) {
    loggerState.monitorLines.shift();
  }

  // Redraw monitor
  const monitor = loggerState.monitor;
  monitor.clear();

  // Header
  monitor.setCursorPos(1, 1);
  monitor.setTextColor(colors.yellow);
  monitor.write("=== Unearther Distribution System ===");

  // Log lines
  monitor.setTextColor(colors.white);
  for (let i = 0; i < loggerState.monitorLines.length; i++) {
    monitor.setCursorPos(1, i + 2);
    monitor.write(loggerState.monitorLines[i]);
  }
}

/**
 * Main logger object.
 */
export const log = {
  debug: (msg: string, data?: unknown): void => {
    if (!shouldLog("debug")) return;
    print(`[DBG ] ${timestamp()} ${msg}${fmt(data)}`);
    writeToMonitor("[DBG]", msg);
  },

  info: (msg: string, data?: unknown): void => {
    if (!shouldLog("info")) return;
    print(`[INFO] ${timestamp()} ${msg}${fmt(data)}`);
    writeToMonitor("[INF]", msg);
  },

  warn: (msg: string, data?: unknown): void => {
    if (!shouldLog("warn")) return;
    print(`[WARN] ${timestamp()} ${msg}${fmt(data)}`);
    writeToMonitor("[WRN]", msg);
  },

  error: (msg: string, data?: unknown): void => {
    if (!shouldLog("error")) return;
    print(`[ERR ] ${timestamp()} ${msg}${fmt(data)}`);
    writeToMonitor("[ERR]", msg);
  },
};

/**
 * Set a status line on the monitor (separate from log).
 */
export function setMonitorStatus(line: number, text: string, color?: number): void {
  if (!loggerState.monitor) return;

  const monitor = loggerState.monitor;
  const [width] = monitor.getSize();

  monitor.setCursorPos(1, line);
  monitor.setTextColor(color ?? colors.white);

  // Clear the line first
  monitor.write(string.rep(" ", width));
  monitor.setCursorPos(1, line);
  monitor.write(text);
}
