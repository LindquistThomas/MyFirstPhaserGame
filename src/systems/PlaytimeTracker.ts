import type { FloorId } from '../config/gameConfig';
import type { SaveData } from './SaveManager';

/**
 * Minimal save adapter used by PlaytimeTracker — exposes only the subset of
 * SaveManager needed for time persistence.
 */
export interface PlaytimeSaveAdapter {
  load(): SaveData | null;
  save(data: SaveData): void;
}

/**
 * Tracks active playtime (total and per-floor) and run timer, persisting
 * them to the save slot via a thin adapter.
 *
 * ### Accumulation rules
 * - Time accumulates only while `isRunning` is `true`.
 * - Calling `pause()` stops accumulation; `resume()` restarts it.
 * - `setFloor(id)` flushes the running floor session to the floor's bucket and
 *   starts a new session for `id`.
 * - `update()` must be called every game-loop tick to keep in-session
 *   accumulators in sync; it does **not** call `persist()` every frame.
 * - Persist is throttled: at most once every `FLUSH_INTERVAL_MS` (default 10 s)
 *   plus an immediate flush on `flush()` / `dispose()`.
 *
 * ### Run timer
 * A "run" starts when `startRun()` is called (new game or first-time-leaving-lobby).
 * `recordClear()` compares the active elapsed run time (pauses excluded) against
 * `bestClearMs` and updates it when the new time is strictly faster.
 *
 * ### Persistence safety
 * `_persist()` always reads the current save from the adapter before writing so
 * it never rolls back progression changes made by `ProgressionSystem.persist()`.
 */
export class PlaytimeTracker {
  /** Throttle interval for automatic persists (ms). */
  static readonly FLUSH_INTERVAL_MS = 10_000;

  // ── persisted totals (mirrored from save on load) ─────────────────────
  private totalMs = 0;
  private floorMs: Partial<Record<FloorId, number>> = {};
  private firstClearMs: number | undefined;
  private bestClearMs: number | undefined;
  private runStartedAt: number | undefined;

  private readonly saveAdapter: PlaytimeSaveAdapter;

  // ── session accumulators ───────────────────────────────────────────────
  /** Floor being timed this session. */
  private currentFloor: FloorId | null = null;
  /** Date.now() when the current active period started; null when paused. */
  private activeStartMs: number | null = null;
  /** Unwritten milliseconds accumulated for the total counter this active period. */
  private sessionTotalMs = 0;
  /** Unwritten milliseconds accumulated for the current floor this active period. */
  private sessionFloorMs = 0;
  /** Date.now() when persisted() was last called. */
  private lastFlushAt = 0;

  // ── run-timer pause tracking ──────────────────────────────────────────
  /**
   * Total milliseconds the game was paused after `startRun()` was called.
   * Excluded from `recordClear()` so the run timer reflects active playtime only.
   */
  private runPausedMs = 0;
  /**
   * `Date.now()` when the most recent pause started (while a run is active);
   * `null` when not currently in a pause during a run.
   */
  private runPauseStartAt: number | null = null;

  constructor(adapter: PlaytimeSaveAdapter) {
    this.saveAdapter = adapter;
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  /** Load persisted time data from the save. Call after the save slot is loaded. */
  loadFromSave(): void {
    const data = this.saveAdapter.load();
    if (!data) return;
    this.totalMs = data.playtimeMs ?? 0;
    this.floorMs = { ...(data.floorPlaytimeMs ?? {}) };
    this.firstClearMs = data.firstClearMs;
    this.bestClearMs = data.bestClearMs;
    this.runStartedAt = data.runStartedAt;
    // runPausedMs is not persisted — reset on every load so stale pauses don't inflate the timer.
    this.runPausedMs = 0;
    this.runPauseStartAt = null;
  }

  /** Reset all accumulated time (called on new game). */
  reset(): void {
    this.totalMs = 0;
    this.floorMs = {};
    this.firstClearMs = undefined;
    this.bestClearMs = undefined;
    this.runStartedAt = undefined;
    this.sessionTotalMs = 0;
    this.sessionFloorMs = 0;
    this.activeStartMs = null;
    this.currentFloor = null;
    this.runPausedMs = 0;
    this.runPauseStartAt = null;
    this.lastFlushAt = 0;
  }

  // ── active/pause control ───────────────────────────────────────────────

  /** Begin accumulating time (called when gameplay becomes active). */
  resume(): void {
    if (this.activeStartMs !== null) return; // already running
    this.activeStartMs = Date.now();
    // If a run is active and was paused, stop accumulating pause time.
    if (this.runStartedAt !== undefined && this.runPauseStartAt !== null) {
      this.runPausedMs += Date.now() - this.runPauseStartAt;
      this.runPauseStartAt = null;
    }
  }

  /**
   * Pause accumulation (called when game is paused, tab is hidden, or a
   * modal is open). Flushes partial delta into in-session accumulators.
   */
  pause(): void {
    if (this.activeStartMs === null) return; // already paused
    const delta = Date.now() - this.activeStartMs;
    this.activeStartMs = null;
    this.sessionTotalMs += delta;
    this.sessionFloorMs += delta;
    // Begin accumulating run pause time (excluded from clear-time calculation).
    if (this.runStartedAt !== undefined && this.runPauseStartAt === null) {
      this.runPauseStartAt = Date.now();
    }
  }

  /** Returns true when time is actively accumulating. */
  get isRunning(): boolean {
    return this.activeStartMs !== null;
  }

  // ── floor tracking ─────────────────────────────────────────────────────

  /**
   * Switch to tracking a new floor. Flushes the previous floor's session time
   * into `floorMs` and resets `sessionFloorMs`.
   */
  setFloor(floorId: FloorId): void {
    // Capture the active delta before switching so time doesn't get double-counted.
    this._captureActiveDelta();
    this._flushFloorSession();
    this.currentFloor = floorId;
    this.sessionFloorMs = 0;
  }

  // ── run timer ──────────────────────────────────────────────────────────

  /**
   * Mark the start of a new run (new game or first-time-leaving-lobby).
   * No-op if a run is already in progress.
   */
  startRun(): void {
    if (this.runStartedAt !== undefined) return;
    this.runStartedAt = Date.now();
    this.runPausedMs = 0;
    this.runPauseStartAt = null;
  }

  /**
   * Record a boss-defeat clear time. Computes the active elapsed run time
   * (pauses excluded), sets `firstClearMs` (once only), and updates
   * `bestClearMs` when the new time is strictly faster.
   * Returns `true` when `bestClearMs` was updated (new personal best).
   * Returns `false` when there is no active run.
   */
  recordClear(): boolean {
    if (this.runStartedAt === undefined) return false;
    // Include any currently-running pause period in the pause total.
    const currentPauseMs = this.runPauseStartAt !== null ? Date.now() - this.runPauseStartAt : 0;
    const elapsed = Date.now() - this.runStartedAt - this.runPausedMs - currentPauseMs;
    if (this.firstClearMs === undefined) {
      this.firstClearMs = elapsed;
    }
    const isNewBest = this.bestClearMs === undefined || elapsed < this.bestClearMs;
    if (isNewBest) {
      this.bestClearMs = elapsed;
    }
    // Clear the run-in-progress marker so the next run starts fresh.
    this.runStartedAt = undefined;
    this.runPausedMs = 0;
    this.runPauseStartAt = null;
    return isNewBest;
  }

  // ── queries ────────────────────────────────────────────────────────────

  /** Total active playtime (persisted + current session). */
  getTotalMs(): number {
    return this.totalMs + this.sessionTotalMs + this._activeDelta();
  }

  /** Per-floor active playtime (persisted + current session). */
  getFloorMs(floorId: FloorId): number {
    const base = this.floorMs[floorId] ?? 0;
    if (floorId !== this.currentFloor) return base;
    return base + this.sessionFloorMs + this._activeDelta();
  }

  /** All known per-floor totals, including the current floor's live value. */
  getAllFloorMs(): Partial<Record<FloorId, number>> {
    const result: Partial<Record<FloorId, number>> = { ...this.floorMs };
    if (this.currentFloor !== null) {
      result[this.currentFloor] = this.getFloorMs(this.currentFloor);
    }
    return result;
  }

  /** Best clear time in ms, or undefined when no run has been completed. */
  getBestClearMs(): number | undefined { return this.bestClearMs; }

  /** First clear time in ms, or undefined when the boss has never been defeated. */
  getFirstClearMs(): number | undefined { return this.firstClearMs; }

  /**
   * Active elapsed run time in ms (pauses excluded), or 0 when no run is active.
   * Capture this BEFORE calling `recordClear()` to get the time of the
   * run that just finished.
   */
  getRunElapsedMs(): number {
    if (this.runStartedAt === undefined) return 0;
    const currentPauseMs = this.runPauseStartAt !== null ? Date.now() - this.runPauseStartAt : 0;
    return Date.now() - this.runStartedAt - this.runPausedMs - currentPauseMs;
  }

  // ── update / persist ───────────────────────────────────────────────────

  /**
   * Called every game-loop frame. Only flushes to storage every
   * `FLUSH_INTERVAL_MS` milliseconds to avoid excess I/O.
   */
  update(): void {
    if (this.lastFlushAt === 0) {
      this.lastFlushAt = Date.now();
      return;
    }
    if (Date.now() - this.lastFlushAt >= PlaytimeTracker.FLUSH_INTERVAL_MS) {
      this.flush();
    }
  }

  /**
   * Immediately commit all accumulated time to the persisted save totals and
   * write to storage. Call on scene-change boundaries and `beforeunload`.
   */
  flush(): void {
    this._commitSession();
    this._persist();
    this.lastFlushAt = Date.now();
  }

  /** Flush and clean up. Call when the tracker is no longer needed. */
  dispose(): void {
    this.pause();
    this.flush();
  }

  // ── private helpers ────────────────────────────────────────────────────

  /** Delta for the current active period (0 when paused). */
  private _activeDelta(): number {
    return this.activeStartMs !== null ? Date.now() - this.activeStartMs : 0;
  }

  /**
   * Accumulate the current active-period delta into session counters and
   * restart the active period so time does not get double-counted.
   * No-op when the tracker is paused.
   */
  private _captureActiveDelta(): void {
    if (this.activeStartMs === null) return;
    const delta = Date.now() - this.activeStartMs;
    this.sessionTotalMs += delta;
    this.sessionFloorMs += delta;
    this.activeStartMs = Date.now(); // restart the active period
  }

  /**
   * Push the current active-period delta into session accumulators, then
   * restart the active period (so the clock doesn't skip a beat).
   */
  private _commitSession(): void {
    this._captureActiveDelta();
    // Merge session totals into persisted counters.
    this.totalMs += this.sessionTotalMs;
    this.sessionTotalMs = 0;
    this._flushFloorSession();
  }

  /** Flush `sessionFloorMs` into the floor bucket and reset the session. */
  private _flushFloorSession(): void {
    if (this.currentFloor !== null && this.sessionFloorMs > 0) {
      this.floorMs[this.currentFloor] = (this.floorMs[this.currentFloor] ?? 0) + this.sessionFloorMs;
    }
    this.sessionFloorMs = 0;
  }

  /**
   * Write playtime fields into the current save. Always loads fresh data from
   * the adapter so we never roll back progression changes made by
   * `ProgressionSystem.persist()` between tracker flushes.
   * No-op when no save exists yet (e.g. new game before first AU collection).
   */
  private _persist(): void {
    const current = this.saveAdapter.load();
    if (!current) return; // No save yet — will write on next flush once progression creates one.
    this.saveAdapter.save({
      ...current,
      playtimeMs: this.totalMs,
      floorPlaytimeMs: { ...this.floorMs },
      firstClearMs: this.firstClearMs,
      bestClearMs: this.bestClearMs,
      runStartedAt: this.runStartedAt,
    });
  }
}
