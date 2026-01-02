import { Job } from "../types";

export class Queue {
  private q: Job[] = [];
  private dedupe: Record<string, boolean> = {};

  push(job: Job) {
    const key = `${job.kind}:${job.stationId}`;
    if (this.dedupe[key]) return;
    this.dedupe[key] = true;
    this.q.push(job);
  }

  pop(): Job | undefined {
    const job = this.q.shift();
    if (!job) return undefined;
    const key = `${job.kind}:${job.stationId}`;
    this.dedupe[key] = false;
    return job;
  }

  isEmpty(): boolean {
    return this.q.length === 0;
  }

  size(): number {
    return this.q.length;
  }
}
