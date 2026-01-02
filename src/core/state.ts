import { AppConfig, Job } from "../types";
import { Result } from "./result";

export interface JobRecord {
  job: Job;
  ok: boolean;
  code: string;
  atUtc: number;
}

export class State {
  public lastScanAtUtc?: number;

  public stationEmpty: Record<number, boolean> = {};
  public stationLastServedUtc: Record<number, number> = {};

  public jobsExecuted: number = 0;
  public jobHistory: JobRecord[] = [];

  // For persistence throttling
  public lastPersistAtUtc?: number;

  constructor(public readonly config: AppConfig) {}

  setStationEmpty(stationId: number, empty: boolean) {
    this.stationEmpty[stationId] = empty;
  }

  recordJobResult(job: Job, res: Result<any>) {
    this.jobsExecuted += 1;
    if (res.ok) this.stationLastServedUtc[job.stationId] = os.epoch("utc");

    this.jobHistory.push({
      job,
      ok: res.ok,
      code: res.code,
      atUtc: os.epoch("utc"),
    });

    // keep history bounded
    const max = 100;
    if (this.jobHistory.length > max) {
      this.jobHistory = this.jobHistory.slice(this.jobHistory.length - max);
    }
  }
}
