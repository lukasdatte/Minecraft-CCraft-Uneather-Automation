/** Log level for the application */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Logger configuration options */
export interface LoggerOptions {
    level: LogLevel;
    logFile?: string;
    maxLogLines?: number;
}

/** Log level priorities (lower = more verbose) */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const DEFAULT_MAX_LOG_LINES = 500;

/**
 * Logger class with support for console and file output.
 * Includes line-based log rotation to prevent unbounded file growth.
 * Instantiate in main.ts and pass to other classes.
 */
export class Logger {
    private level: LogLevel;
    private logFile?: WriteFileHandle;
    private logFilePath?: string;
    private linesWritten = 0;
    private maxLogLines: number;

    constructor(options: LoggerOptions) {
        this.level = options.level;
        this.maxLogLines = options.maxLogLines ?? DEFAULT_MAX_LOG_LINES;

        if (options.logFile) {
            this.logFilePath = options.logFile;
            this.openLogFile(options.logFile);
        }
    }

    debug(msg: string, data?: unknown): void {
        if (!this.shouldLog("debug")) return;
        const line = `[DBG ] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToFile(line);
    }

    info(msg: string, data?: unknown): void {
        if (!this.shouldLog("info")) return;
        const line = `[INFO] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToFile(line);
    }

    warn(msg: string, data?: unknown): void {
        if (!this.shouldLog("warn")) return;
        const line = `[WARN] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToFile(line);
    }

    error(msg: string, data?: unknown): void {
        if (!this.shouldLog("error")) return;
        const line = `[ERR ] ${this.timestamp()} ${msg}${this.fmt(data)}`;
        print(line);
        this.writeToFile(line);
    }

    // ========================================
    // Private methods
    // ========================================

    private openLogFile(path: string): void {
        const [handle] = fs.open(path, "a");
        if (!handle) {
            print("[WARN] Could not open log file: " + path);
            return;
        }
        this.logFile = handle as unknown as WriteFileHandle;
        // Write restart marker
        this.logFile.writeLine("");
        this.logFile.writeLine("========================================");
        this.logFile.writeLine(`=== NEUSTART ${this.timestamp()} ===`);
        this.logFile.writeLine("========================================");
        this.logFile.flush();
        this.linesWritten += 4;
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
        this.linesWritten++;

        if (this.linesWritten >= this.maxLogLines) {
            this.rotateLogFile();
        }
    }

    private rotateLogFile(): void {
        if (!this.logFilePath) return;

        // 1. Close current handle
        this.logFile!.close();
        this.logFile = undefined;

        // 2. Read all lines
        const [readHandle] = fs.open(this.logFilePath, "r");
        if (!readHandle) {
            // Can't read - reset counter and reopen in append mode
            this.linesWritten = 0;
            this.openLogFile(this.logFilePath);
            return;
        }

        const content = (readHandle as unknown as ReadFileHandle).readAll();
        (readHandle as unknown as ReadFileHandle).close();

        // 3. Keep last half of maxLogLines
        const keepLines = math.floor(this.maxLogLines / 2);
        const contentStr = content ?? "";
        const lineArray: string[] = [];
        let pos = 1;
        while (pos <= contentStr.length) {
            const [nlPos] = string.find(contentStr, "\n", pos, true);
            if (nlPos) {
                lineArray.push(string.sub(contentStr, pos, nlPos - 1));
                pos = nlPos + 1;
            } else {
                lineArray.push(string.sub(contentStr, pos));
                break;
            }
        }

        const startIndex = math.max(0, lineArray.length - keepLines);
        const keptLines = lineArray.slice(startIndex);

        // 4. Write truncated content
        const [writeHandle] = fs.open(this.logFilePath, "w");
        if (writeHandle) {
            const wh = writeHandle as unknown as WriteFileHandle;
            for (const l of keptLines) {
                wh.writeLine(l);
            }
            wh.flush();
            wh.close();
        }

        // 5. Reopen in append mode
        const [appendHandle] = fs.open(this.logFilePath, "a");
        if (!appendHandle) {
            print("[WARN] Could not reopen log file: " + this.logFilePath);
            this.linesWritten = 0;
            return;
        }
        this.logFile = appendHandle as unknown as WriteFileHandle;
        this.linesWritten = keptLines.length;
    }
}
