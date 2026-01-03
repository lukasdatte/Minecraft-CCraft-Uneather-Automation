import { ResultCode } from "./errors";

/** Error codes only (excludes success codes) */
export type ErrorCode = Exclude<ResultCode, "OK" | "OK_NOOP">;

export type Result<T> =
  | { ok: true; code: "OK" | "OK_NOOP"; value: T }
  | { ok: false; code: ErrorCode; detail?: unknown };

export function ok<T>(value: T): Result<T> {
    return { ok: true, code: "OK", value };
}

export function okNoop<T>(value: T): Result<T> {
    return { ok: true, code: "OK_NOOP", value };
}

export function err<T = never>(code: ErrorCode, detail?: unknown): Result<T> {
    return { ok: false, code, detail };
}
