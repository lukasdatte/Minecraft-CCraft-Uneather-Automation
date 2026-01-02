function fmt(obj: any): string {
  if (obj === undefined) return "";
  return " " + textutils.serialize(obj);
}

export const log = {
  info: (msg: string, data?: any) => print(`[INFO] ${msg}${fmt(data)}`),
  warn: (msg: string, data?: any) => print(`[WARN] ${msg}${fmt(data)}`),
  error: (msg: string, data?: any) => print(`[ERR ] ${msg}${fmt(data)}`),
};
