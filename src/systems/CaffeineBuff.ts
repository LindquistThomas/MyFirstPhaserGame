/** Pure timer for the caffeine buff — no ambient time source; callers pass `now`. */
export class CaffeineBuff {
  private activeUntil = 0;
  private currentDurationMs = 0;

  /** No stacking — re-activating resets the end-time. */
  activate(now: number, durationMs: number): void {
    this.activeUntil = now + durationMs;
    this.currentDurationMs = durationMs;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  remaining(now: number): number {
    return Math.max(0, this.activeUntil - now);
  }

  /** 0..1 of the current window still remaining. */
  ratio(now: number): number {
    if (this.currentDurationMs <= 0) return 0;
    return Math.max(0, Math.min(1, this.remaining(now) / this.currentDurationMs));
  }

  clear(): void {
    this.activeUntil = 0;
    this.currentDurationMs = 0;
  }
}
