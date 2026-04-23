/**
 * Pure timer for the caffeine (coffee) buff. Kept framework-agnostic so it
 * can be driven by Phaser's scene clock in the game and by a plain number
 * in tests. Callers pass `now` (ms) to every query — the helper itself
 * has no ambient time source.
 */
export class CaffeineBuff {
  private activeUntil = 0;
  /** Total duration of the current buff window — used by UI to render a ratio. */
  private currentDurationMs = 0;

  /**
   * Activate or refresh the buff. Re-activating while already active simply
   * resets the end-time to `now + durationMs` (no stacking).
   */
  activate(now: number, durationMs: number): void {
    this.activeUntil = now + durationMs;
    this.currentDurationMs = durationMs;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  /** Remaining ms (0 when expired). */
  remaining(now: number): number {
    return Math.max(0, this.activeUntil - now);
  }

  /** 0..1 fraction of the current buff window still remaining. */
  ratio(now: number): number {
    if (this.currentDurationMs <= 0) return 0;
    return Math.max(0, Math.min(1, this.remaining(now) / this.currentDurationMs));
  }

  /** Force-clear — used when the buff is cancelled externally. */
  clear(): void {
    this.activeUntil = 0;
    this.currentDurationMs = 0;
  }
}
