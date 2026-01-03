import { LogLevel } from "../types";

// Types MonitorPeripheral, WriteFileHandle from @jackmacwindows/craftos-types are globally declared

/** Format data for logging */
function fmt(obj: unknown): string {
    if (obj === undefined || obj === null) return "";
    const serialized = textutils.serialize(obj) as string;
    return " " + serialized;
}

/** Get ISO 8601 UTC timestamp string */
function timestamp(): string {
    return os.date("!%Y-%m-%dT%H:%M:%SZ") as string;
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
    logFile?: WriteFileHandle;
}

/** Global logger state (configured via initLogger) */
const loggerState: LoggerConfig = {
    level: "info",
    monitor: undefined,
    monitorLines: [],
    maxMonitorLines: 20,
    logFile: undefined,
};

/** Track if restart marker was already written */
let restartMarkerWritten = false;

/**
 * Initialize the logger with configuration.
 */
export function initLogger(
    level: LogLevel,
    monitor?: MonitorPeripheral,
    logFilePath?: string,
): void {
    // Close existing log file if open
    if (loggerState.logFile) {
        loggerState.logFile.close();
        loggerState.logFile = undefined;
    }

    loggerState.level = level;
    loggerState.monitor = monitor;
    loggerState.monitorLines = [];

    // Open log file if path provided
    if (logFilePath) {
        const [handle] = fs.open(logFilePath, "a");
        if (handle) {
            loggerState.logFile = handle as unknown as WriteFileHandle;
            // Write restart marker (only once per program start)
            if (!restartMarkerWritten) {
                loggerState.logFile.writeLine("");
                loggerState.logFile.writeLine("========================================");
                loggerState.logFile.writeLine(`=== NEUSTART ${timestamp()} ===`);
                loggerState.logFile.writeLine("========================================");
                loggerState.logFile.flush();
                restartMarkerWritten = true;
            }
        }
    }

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
 * Write to log file if available.
 */
function writeToFile(line: string): void {
    if (!loggerState.logFile) return;
    loggerState.logFile.writeLine(line);
    loggerState.logFile.flush();
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
        const line = `[DBG ] ${timestamp()} ${msg}${fmt(data)}`;
        print(line);
        writeToMonitor("[DBG]", msg);
        writeToFile(line);
    },

    info: (msg: string, data?: unknown): void => {
        if (!shouldLog("info")) return;
        const line = `[INFO] ${timestamp()} ${msg}${fmt(data)}`;
        print(line);
        writeToMonitor("[INF]", msg);
        writeToFile(line);
    },

    warn: (msg: string, data?: unknown): void => {
        if (!shouldLog("warn")) return;
        const line = `[WARN] ${timestamp()} ${msg}${fmt(data)}`;
        print(line);
        writeToMonitor("[WRN]", msg);
        writeToFile(line);
    },

    error: (msg: string, data?: unknown): void => {
        if (!shouldLog("error")) return;
        const line = `[ERR ] ${timestamp()} ${msg}${fmt(data)}`;
        print(line);
        writeToMonitor("[ERR]", msg);
        writeToFile(line);
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
