import { ResultCode } from "./errors";

export type Result<T> =
  | { ok: true; code: "OK" | "OK_NOOP"; value: T }
  | { ok: false; code: ResultCode; detail?: any };

export function ok<T>(value: T): Result<T> {
  return { ok: true, code: "OK", value };
}

export function okNoop<T>(value: T): Result<T> {
  return { ok: true, code: "OK_NOOP", value };
}

export function err<T = never>(code: Exclude<ResultCode, "OK" | "OK_NOOP">, detail?: any): Result<T> {
  return { ok: false, code, detail };
}
