import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlaytimeTracker } from './PlaytimeTracker';
import type { PlaytimeSaveAdapter } from './PlaytimeTracker';
import { FLOORS } from '../config/gameConfig';
import type { SaveData } from './SaveManager';

/** Minimal SaveData for test stubs. */
function makeSaveData(overrides: Partial<SaveData> = {}): SaveData {
  return {
    version: 2,
    totalAU: 0,
    floorAU: {},
    unlockedFloors: [0],
    currentFloor: 0,
    collectedTokens: {},
    playtimeMs: 0,
    floorPlaytimeMs: {},
    ...overrides,
  };
}

function makeAdapter(initial: SaveData | null = null): PlaytimeSaveAdapter & { saved: SaveData | null } {
  let stored = initial;
  return {
    get saved() { return stored; },
    load: () => stored,
    save: (data: SaveData) => { stored = data; },
  };
}

describe('PlaytimeTracker — basic accumulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at 0 when no save is loaded', () => {
    const adapter = makeAdapter();
    const tracker = new PlaytimeTracker(adapter);
    expect(tracker.getTotalMs()).toBe(0);
  });

  it('loads persisted totals from save', () => {
    const adapter = makeAdapter(makeSaveData({ playtimeMs: 5000, floorPlaytimeMs: { [FLOORS.LOBBY]: 3000 } }));
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    expect(tracker.getTotalMs()).toBe(5000);
    expect(tracker.getFloorMs(FLOORS.LOBBY)).toBe(3000);
  });

  it('accumulates time while running', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.setFloor(FLOORS.LOBBY);
    tracker.resume();

    vi.advanceTimersByTime(2000);
    expect(tracker.getTotalMs()).toBeGreaterThanOrEqual(2000);
    expect(tracker.getFloorMs(FLOORS.LOBBY)).toBeGreaterThanOrEqual(2000);
  });

  it('does not accumulate time while paused', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.setFloor(FLOORS.LOBBY);

    // Never called resume() — should stay at 0.
    vi.advanceTimersByTime(5000);
    expect(tracker.getTotalMs()).toBe(0);
  });

  it('stops accumulating on pause() and resumes on resume()', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.setFloor(FLOORS.LOBBY);
    tracker.resume();

    vi.advanceTimersByTime(1000); // 1s active
    tracker.pause();

    vi.advanceTimersByTime(3000); // 3s paused — not counted
    const afterPause = tracker.getTotalMs();

    tracker.resume();
    vi.advanceTimersByTime(1000); // 1s active again
    expect(tracker.getTotalMs()).toBeGreaterThanOrEqual(afterPause + 1000);
    // Should not have counted the 3s pause window.
    expect(tracker.getTotalMs()).toBeLessThan(afterPause + 1500);
  });
});

describe('PlaytimeTracker — tab hidden pauses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pause() while active prevents further accumulation (simulates tab-hidden)', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.setFloor(FLOORS.LOBBY);
    tracker.resume();

    vi.advanceTimersByTime(500);
    // Simulate visibilitychange → hidden: caller calls pause()
    tracker.pause();

    vi.advanceTimersByTime(10_000); // tab is hidden for 10s
    const hiddenTotal = tracker.getTotalMs();

    // Should reflect ~500ms, not 10500ms
    expect(hiddenTotal).toBeLessThan(1000);
  });
});

describe('PlaytimeTracker — modal open pauses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pause/resume around a modal open period excludes modal time', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.setFloor(FLOORS.LOBBY);
    tracker.resume();

    vi.advanceTimersByTime(500);
    const beforeModal = tracker.getTotalMs();

    tracker.pause(); // modal opens
    vi.advanceTimersByTime(5000); // modal is open 5s
    tracker.resume(); // modal closes

    vi.advanceTimersByTime(200);
    const afterModal = tracker.getTotalMs();

    // Elapsed while modal was open must not count.
    expect(afterModal).toBeGreaterThanOrEqual(beforeModal + 200);
    expect(afterModal).toBeLessThan(beforeModal + 500);
  });
});

describe('PlaytimeTracker — scene change floor attribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('attributes time to the correct floor after setFloor()', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.setFloor(FLOORS.LOBBY);
    tracker.resume();

    vi.advanceTimersByTime(2000);
    tracker.setFloor(FLOORS.PLATFORM_TEAM); // switch floors
    vi.advanceTimersByTime(1000);

    expect(tracker.getFloorMs(FLOORS.LOBBY)).toBeGreaterThanOrEqual(2000);
    expect(tracker.getFloorMs(FLOORS.LOBBY)).toBeLessThan(3100);
    expect(tracker.getFloorMs(FLOORS.PLATFORM_TEAM)).toBeGreaterThanOrEqual(1000);
    expect(tracker.getFloorMs(FLOORS.PLATFORM_TEAM)).toBeLessThan(1500);
  });
});

describe('PlaytimeTracker — persist throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('60 calls to update() do not produce 60 persists', () => {
    const adapter = makeAdapter(makeSaveData());
    const saveSpy = vi.spyOn(adapter, 'save');
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.resume();

    // 60 ticks at 16ms each = ~960ms total, well under FLUSH_INTERVAL_MS (10s)
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersByTime(16);
      tracker.update();
    }

    // Should not have persisted once during the 960ms window.
    expect(saveSpy).toHaveBeenCalledTimes(0);
  });

  it('flush() writes once immediately', () => {
    const adapter = makeAdapter(makeSaveData());
    const saveSpy = vi.spyOn(adapter, 'save');
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.resume();

    vi.advanceTimersByTime(500);
    tracker.flush();
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('update() persists after FLUSH_INTERVAL_MS elapses', () => {
    const adapter = makeAdapter(makeSaveData());
    const saveSpy = vi.spyOn(adapter, 'save');
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.resume();

    // First update initialises lastFlushAt.
    vi.advanceTimersByTime(1);
    tracker.update();

    // Advance past threshold.
    vi.advanceTimersByTime(PlaytimeTracker.FLUSH_INTERVAL_MS + 100);
    tracker.update();

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});

describe('PlaytimeTracker — run timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startRun() sets runStartedAt; subsequent calls are no-ops', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();

    tracker.startRun();
    vi.advanceTimersByTime(1000);
    const elapsed1 = tracker.getRunElapsedMs();
    expect(elapsed1).toBeGreaterThanOrEqual(1000);

    tracker.startRun(); // no-op
    expect(tracker.getRunElapsedMs()).toBeGreaterThanOrEqual(elapsed1);
  });

  it('recordClear() sets firstClearMs on first defeat and updates bestClearMs', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();

    tracker.startRun();
    vi.advanceTimersByTime(5000);
    const isNewBest = tracker.recordClear();

    expect(isNewBest).toBe(true);
    expect(tracker.getFirstClearMs()).toBeCloseTo(5000, -2);
    expect(tracker.getBestClearMs()).toBeCloseTo(5000, -2);
  });

  it('recordClear() updates bestClearMs when new time is strictly faster', () => {
    const adapter = makeAdapter(makeSaveData({ bestClearMs: 10_000, firstClearMs: 10_000 }));
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();

    tracker.startRun();
    vi.advanceTimersByTime(7000);
    const isNewBest = tracker.recordClear();

    expect(isNewBest).toBe(true);
    expect(tracker.getBestClearMs()).toBeCloseTo(7000, -2);
  });

  it('recordClear() does NOT update bestClearMs when new time is slower', () => {
    const adapter = makeAdapter(makeSaveData({ bestClearMs: 3_000, firstClearMs: 3_000 }));
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();

    tracker.startRun();
    vi.advanceTimersByTime(8000);
    const isNewBest = tracker.recordClear();

    expect(isNewBest).toBe(false);
    expect(tracker.getBestClearMs()).toBeCloseTo(3000, -2);
  });

  it('getRunElapsedMs() returns 0 when no run is active', () => {
    const adapter = makeAdapter(makeSaveData());
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    expect(tracker.getRunElapsedMs()).toBe(0);
  });
});

describe('PlaytimeTracker — reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reset() clears all state', () => {
    const adapter = makeAdapter(makeSaveData({ playtimeMs: 9000 }));
    const tracker = new PlaytimeTracker(adapter);
    tracker.loadFromSave();
    tracker.resume();
    vi.advanceTimersByTime(1000);

    tracker.reset();
    expect(tracker.getTotalMs()).toBe(0);
    expect(tracker.getFloorMs(FLOORS.LOBBY)).toBe(0);
    expect(tracker.getBestClearMs()).toBeUndefined();
    expect(tracker.getRunElapsedMs()).toBe(0);
    expect(tracker.isRunning).toBe(false);
  });
});
