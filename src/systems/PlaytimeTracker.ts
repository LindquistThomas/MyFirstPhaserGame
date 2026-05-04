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
 * A "run" starts when `startRun()` is called (first-time lobby exit or after a
 * full reset). `recordClear()` compares the elapsed run time against
 * `bestClearMs` and updates it when the new time is strictly faster.
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

  // ── save data snapshot (needed for full persist call) ─────────────────
  private lastSaveData: SaveData | null = null;
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

  constructor(adapter: PlaytimeSaveAdapter) {
    this.saveAdapter = adapter;
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  /** Load persisted time data from the save. Call after the save slot is loaded. */
  loadFromSave(): void {
    const data = this.saveAdapter.load();
    this.lastSaveData = data;
    if (!data) return;
    this.totalMs = data.playtimeMs ?? 0;
    this.floorMs = { ...(data.floorPlaytimeMs ?? {}) };
    this.firstClearMs = data.firstClearMs;
    this.bestClearMs = data.bestClearMs;
    this.runStartedAt = data.runStartedAt;
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
    this.lastSaveData = null;
  }

  // ── active/pause control ───────────────────────────────────────────────

  /** Begin accumulating time (called when gameplay becomes active). */
  resume(): void {
    if (this.activeStartMs !== null) return; // already running
    this.activeStartMs = Date.now();
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
    // If the tracker is currently running, capture the active delta into the
    // session accumulator before flushing the floor session.  Then restart
    // the active-period clock so time doesn't get double-counted.
    if (this.activeStartMs !== null) {
      const delta = Date.now() - this.activeStartMs;
      this.sessionTotalMs += delta;
      this.sessionFloorMs += delta;
      this.activeStartMs = Date.now();
    }
    this._flushFloorSession();
    this.currentFloor = floorId;
    this.sessionFloorMs = 0;
  }

  // ── run timer ──────────────────────────────────────────────────────────

  /**
   * Mark the start of a new run (first-time lobby exit or full save reset).
   * No-op if a run is already in progress.
   */
  startRun(): void {
    if (this.runStartedAt !== undefined) return;
    this.runStartedAt = Date.now();
  }

  /**
   * Record a boss-defeat clear time. Computes elapsed from `runStartedAt`,
   * sets `firstClearMs` (once only), and updates `bestClearMs` when the new
   * time is strictly faster. Returns `true` when `bestClearMs` was updated.
   */
  recordClear(): boolean {
    if (this.runStartedAt === undefined) return false;
    const elapsed = Date.now() - this.runStartedAt;
    if (this.firstClearMs === undefined) {
      this.firstClearMs = elapsed;
    }
    const isNewBest = this.bestClearMs === undefined || elapsed < this.bestClearMs;
    if (isNewBest) {
      this.bestClearMs = elapsed;
    }
    // Clear the run-in-progress marker so the next run starts fresh.
    this.runStartedAt = undefined;
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

  /** Run elapsed time in ms (from `runStartedAt` to now), or 0 if no run active. */
  getRunElapsedMs(): number {
    if (this.runStartedAt === undefined) return 0;
    return Date.now() - this.runStartedAt;
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
   * Push the current active-period delta into session accumulators, then
   * restart the active period (so the clock doesn't skip a beat).
   */
  private _commitSession(): void {
    if (this.activeStartMs !== null) {
      const delta = Date.now() - this.activeStartMs;
      this.sessionTotalMs += delta;
      this.sessionFloorMs += delta;
      this.activeStartMs = Date.now(); // restart the active period
    }
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

  private _persist(): void {
    if (!this.lastSaveData) return;
    this.saveAdapter.save({
      ...this.lastSaveData,
      playtimeMs: this.totalMs,
      floorPlaytimeMs: { ...this.floorMs },
      firstClearMs: this.firstClearMs,
      bestClearMs: this.bestClearMs,
      runStartedAt: this.runStartedAt,
    });
    // Refresh snapshot so subsequent persists include any side-effects.
    this.lastSaveData = this.saveAdapter.load() ?? this.lastSaveData;
  }

  /**
   * Sync `lastSaveData` with external changes (e.g. when ProgressionSystem
   * calls persist() and updates the save). Call after any external save write.
   */
  syncSaveSnapshot(): void {
    const data = this.saveAdapter.load();
    if (data) this.lastSaveData = data;
  }
}
