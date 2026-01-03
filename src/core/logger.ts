import { LogLevel } from "../types";

// Types MonitorPeripheral, WriteFileHandle from @jackmacwindows/craftos-types are globally declared

/** Logger configuration options */
export interface LoggerOptions {
    level: LogLevel;
    logFile?: string;
}

/** Log level priorities (lower = more verbose) */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Logger class with support for console, file, and monitor output.
 * Instantiate in main.ts and pass to other classes.
 */
export class Logger {
    private level: LogLevel;
    private logFile?: WriteFileHandle;
    private monitor?: MonitorPeripheral;
    private monitorLines: string[] = [];
    private maxMonitorLines = 20;

    constructor(options: LoggerOptions) {
        this.level = options.level;

        if (options.logFile) {
            this.openLogFile(options.logFile);
        }
    }

    /**
     * Set monitor for log output.
     * Call after peripherals are validated.
     */
    setMonitor(monitor: MonitorPeripheral): void {
        this.monitor = monitor;
        const [, height] = monitor.getSize();
        this.maxMonitorLines = height - 2;
        monitor.setTextScale(0.5);
        monitor.clear();
    }

    debug(msg: string, data?: unknown): void {
        if (!this.shouldLog("debug")) return;
        const line = `[DBG ] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToMonitor("[DBG]", msg);
        this.writeToFile(line);
    }

    info(msg: string, data?: unknown): void {
        if (!this.shouldLog("info")) return;
        const line = `[INFO] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToMonitor("[INF]", msg);
        this.writeToFile(line);
    }

    warn(msg: string, data?: unknown): void {
        if (!this.shouldLog("warn")) return;
        const line = `[WARN] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToMonitor("[WRN]", msg);
        this.writeToFile(line);
    }

    error(msg: string, data?: unknown): void {
        if (!this.shouldLog("error")) return;
        const line = `[ERR ] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToMonitor("[ERR]", msg);
        this.writeToFile(line);
    }

    // ========================================
    // Private methods
    // ========================================

    private openLogFile(path: string): void {
        const [handle] = fs.open(path, "a");
        if (handle) {
            this.logFile = handle as unknown as WriteFileHandle;
            // Write restart marker
            this.logFile.writeLine("");
            this.logFile.writeLine("========================================");
            this.logFile.writeLine(`=== NEUSTART ${this.timestamp()} ===`);
            this.logFile.writeLine("========================================");
            this.logFile.flush();
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
    }

    private timestamp(): string {
        return os.date("!%Y-%m-%dT%H:%M:%SZ") as string;
    }

    private fmt(obj: unknown): string {
        if (obj === undefined || obj === null) return "";
        const serialized = textutils.serialize(obj) as string;
        return " " + serialized;
    }

    private writeToFile(line: string): void {
        if (!this.logFile) return;
        this.logFile.writeLine(line);
        this.logFile.flush();
    }

    private writeToMonitor(prefix: string, msg: string): void {
        if (!this.monitor) return;

        const line = `${this.timestamp()} ${prefix} ${msg}`;
        this.monitorLines.push(line);

        // Keep only the last N lines
        while (this.monitorLines.length > this.maxMonitorLines) {
            this.monitorLines.shift();
        }

        // Redraw monitor
        const monitor = this.monitor;
        monitor.clear();

        // Header
        monitor.setCursorPos(1, 1);
        monitor.setTextColor(colors.yellow);
        monitor.write("=== Unearther Distribution System ===");

        // Log lines
        monitor.setTextColor(colors.white);
        for (let i = 0; i < this.monitorLines.length; i++) {
            monitor.setCursorPos(1, i + 2);
            monitor.write(this.monitorLines[i]);
        }
    }
}
