import { AppConfig } from "../types";
import { Result, ok, err } from "../core/result";

export class NavLine {
  private cfg: AppConfig;

  constructor(cfg: AppConfig) {
    this.cfg = cfg;
  }

  private tryForwardOnce(): boolean {
    if (turtle.forward()) return true;

    if (this.cfg.world.allowAttack) turtle.attack();
    if (this.cfg.world.allowDig) turtle.dig();

    return turtle.forward();
  }

  private forwardSafe(): Result<void> {
    for (let i = 0; i < this.cfg.world.moveRetries; i++) {
      if (this.tryForwardOnce()) return ok(undefined);
      sleep(0.1);
    }
    return err("ERR_NAV_BLOCKED", { dir: "forward" });
  }

  private retreatSafe(): Result<void> {
    // back() can't dig; do a 180 + forwardSafe + 180 to simulate a safe retreat
    turtle.turnLeft(); turtle.turnLeft();
    const res = this.forwardSafe();
    turtle.turnLeft(); turtle.turnLeft();
    return res.ok ? ok(undefined) : err("ERR_NAV_BLOCKED", { dir: "back" });
  }

  goToDistance(distanceSteps: number): Result<void> {
    const steps = distanceSteps * this.cfg.world.stepDistance;
    for (let i = 0; i < steps; i++) {
      const r = this.forwardSafe();
      if (!r.ok) return r;
    }
    return ok(undefined);
  }

  returnHome(distanceSteps: number): Result<void> {
    const steps = distanceSteps * this.cfg.world.stepDistance;
    for (let i = 0; i < steps; i++) {
      const r = this.retreatSafe();
      if (!r.ok) return r;
    }
    return ok(undefined);
  }
}
