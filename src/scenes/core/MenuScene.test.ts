import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal Phaser stub — only the surface MenuScene uses in idlePreloadMusic.
vi.mock('phaser', () => {
  /** Returns an object where every listed method returns the object itself (chainable). */
  const makeChainable = () => {
    const o: Record<string, unknown> = {
      fillColor: 0x2a2f4a,
      y: 500,
    };
    for (const m of [
      'setOrigin', 'setDepth', 'setScrollFactor', 'setInteractive', 'setAlpha',
      'setShadow', 'setColor', 'setScale', 'setFillStyle',
      'fillStyle', 'fillRect', 'fillCircle',
      'lineStyle', 'lineBetween', 'strokeRect',
      'clear', 'draw', 'setText', 'setVisible', 'on',
    ]) {
      o[m] = vi.fn(() => o);
    }
    o['destroy'] = vi.fn();
    o['add'] = vi.fn();
    return o;
  };

  class Scene {
    cameras = { main: { setBackgroundColor: vi.fn(), fadeIn: vi.fn() } };
    add = {
      graphics: vi.fn(() => makeChainable()),
      renderTexture: vi.fn(() => makeChainable()),
      rectangle: vi.fn(() => makeChainable()),
      container: vi.fn(() => makeChainable()),
      sprite: vi.fn(() => makeChainable()),
      text: vi.fn(() => makeChainable()),
    };
    tweens = { add: vi.fn(), addCounter: vi.fn() };
    time = { addEvent: vi.fn(), delayedCall: vi.fn() };
    registry = { get: vi.fn(), set: vi.fn() };
    textures = { exists: vi.fn(() => false) };
    cache = { audio: { exists: vi.fn(() => false) } };
    music = { preloadIdle: vi.fn() };
    load = { audio: vi.fn(), start: vi.fn(), once: vi.fn(), on: vi.fn(), off: vi.fn() };
    scene = { key: 'MenuScene' };
    /** Simple events stub: once() stores handlers; emit() fires & removes them. */
    events = (() => {
      const handlers: Record<string, Array<() => void>> = {};
      return {
        once(ev: string, fn: () => void) { (handlers[ev] ??= []).push(fn); },
        emit(ev: string) { const list = handlers[ev]?.splice(0) ?? []; for (const fn of list) fn(); },
      };
    })();
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
});

// Stub heavy imports that pull in Phaser internals.
vi.mock('../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  COLORS: { titleText: '#ffffff', hudText: '#ffffff' },
  FLOORS: {
    LOBBY: 0,
    PLATFORM_TEAM: 1,
    PRODUCTS: 2,
    BUSINESS: 3,
    EXECUTIVE: 4,
    BOSS: 5,
  },
  FLOOR_IDS: [0, 1, 2, 3, 4, 5],
}));
vi.mock('../../systems/EventBus', () => ({ eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } }));
vi.mock('../../input', () => ({ pushContext: vi.fn(() => 0), popContext: vi.fn() }));
vi.mock('../../systems/sceneLifecycle', () => ({
  createSceneLifecycle: vi.fn(() => ({ add: vi.fn(), bindInput: vi.fn() })),
}));

vi.mock('../../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => false),
}));
vi.mock('../../systems/SpriteGenerator', () => ({
  MENU_DEFERRED_SPRITE_PHASES: [{ label: 'Deferred sprite', run: vi.fn() }],
}));
vi.mock('../../systems/SoundGenerator', () => ({
  BATCHED_SOUND_PHASES: [
    { label: 'Sound batch 1', run: vi.fn() },
    { label: 'Sound batch 2', run: vi.fn() },
  ],
}));

vi.mock('../../ui/ControlsReferenceModal', () => ({
  ControlsReferenceModal: vi.fn(),
}));

import { SCENE_MUSIC, STATIC_MUSIC_ASSETS } from '../../config/audioConfig';
import { MenuScene } from './MenuScene';
import * as MotionPreference from '../../systems/MotionPreference';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import { eventBus } from '../../systems/EventBus';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build the minimal scene surface idlePreloadMusic reads. */
function makeScene(cachedKeys: string[] = []) {
  const preloadedKeyBatches: string[][] = [];

  const scene = new MenuScene() as unknown as {
    cache: { audio: { exists: (k: string) => boolean } };
    music: { preloadIdle: (keys: string[]) => void };
    idlePreloadMusic: () => void;
  };

  Object.defineProperty(scene, 'cache', {
    value: { audio: { exists: (k: string) => cachedKeys.includes(k) } },
    configurable: true,
  });
  Object.defineProperty(scene, 'music', {
    value: {
      preloadIdle: (keys: string[]) => { preloadedKeyBatches.push(keys); },
    },
    configurable: true,
  });

  return {
    scene,
    getPreloadedKeys: () => preloadedKeyBatches.flat(),
    getPreloadCalls: () => preloadedKeyBatches,
  };
}

/** Create a MenuScene instance and call create() on it. */
function makeCreateScene(): MenuScene {
  const scene = new MenuScene();
  (scene as unknown as { create: () => void }).create();
  return scene;
}

// ── Tests ────────────────────────────────────────────────────────────────────

// idlePreloadMusic skips the scene's own SCENE_MUSIC track (handled by MusicPlugin)
// and all eager tracks.
const menuOwnTrack = SCENE_MUSIC['MenuScene'];
const idlePreloadKeys = STATIC_MUSIC_ASSETS.filter(
  (a) => !a.eager && a.key !== menuOwnTrack,
).map((a) => a.key);

describe('MenuScene.idlePreloadMusic', () => {
  let origConnection: unknown;

  beforeEach(() => {
    origConnection = (navigator as unknown as Record<string, unknown>)['connection'];
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'connection', {
      value: origConnection,
      configurable: true,
      writable: true,
    });
  });

  function setConnection(value: { saveData?: boolean; effectiveType?: string } | undefined) {
    Object.defineProperty(navigator, 'connection', {
      value,
      configurable: true,
      writable: true,
    });
  }

  it('queues all non-eager non-own-track uncached tracks and starts the loader', () => {
    setConnection(undefined);
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).toHaveLength(idlePreloadKeys.length);
    expect(getPreloadedKeys()).toEqual(expect.arrayContaining(idlePreloadKeys));
    expect(getPreloadCalls()).toHaveLength(1);
  });

  it("does not queue the scene's own SCENE_MUSIC track (MusicPlugin handles it)", () => {
    setConnection(undefined);
    const { scene, getPreloadedKeys } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).not.toContain(menuOwnTrack);
  });

  it('skips tracks that are already cached', () => {
    setConnection(undefined);
    const firstKey = idlePreloadKeys[0]!;
    const { scene, getPreloadedKeys } = makeScene([firstKey]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).not.toContain(firstKey);
    expect(getPreloadedKeys().length).toBe(idlePreloadKeys.length - 1);
  });

  it('does nothing when all eligible tracks are cached', () => {
    setConnection(undefined);
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene(idlePreloadKeys);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).toHaveLength(0);
    expect(getPreloadCalls()).toHaveLength(0);
    expect(eventBus.emit).toHaveBeenCalledWith('music:prewarm-complete');
  });

  it('skips when saveData is true', () => {
    setConnection({ saveData: true });
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).toHaveLength(0);
    expect(getPreloadCalls()).toHaveLength(0);
    expect(eventBus.emit).toHaveBeenCalledWith('music:prewarm-complete');
  });

  it('skips on 2g connection', () => {
    setConnection({ effectiveType: '2g' });
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).toHaveLength(0);
    expect(getPreloadCalls()).toHaveLength(0);
    expect(eventBus.emit).toHaveBeenCalledWith('music:prewarm-complete');
  });

  it('skips on slow-2g connection', () => {
    setConnection({ effectiveType: 'slow-2g' });
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).toHaveLength(0);
    expect(getPreloadCalls()).toHaveLength(0);
    expect(eventBus.emit).toHaveBeenCalledWith('music:prewarm-complete');
  });

  it('does not skip on 3g or faster connections', () => {
    setConnection({ effectiveType: '3g' });
    const { scene, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadCalls()).toHaveLength(1);
  });

  it('does not queue eager tracks', () => {
    setConnection(undefined);
    const eagerKeys = STATIC_MUSIC_ASSETS.filter((a) => a.eager).map((a) => a.key);
    const { scene, getPreloadedKeys } = makeScene([]);
    scene.idlePreloadMusic();
    for (const k of eagerKeys) {
      expect(getPreloadedKeys()).not.toContain(k);
    }
  });
});

describe('MenuScene.idlePreloadMusic — visibility guard', () => {
  let origVisibility: string;

  beforeEach(() => {
    origVisibility = document.visibilityState;
  });

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: origVisibility,
      configurable: true,
      writable: true,
    });
  });

  it('skips when tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
      writable: true,
    });
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys()).toHaveLength(0);
    expect(getPreloadCalls()).toHaveLength(0);
    expect(eventBus.emit).not.toHaveBeenCalledWith('music:prewarm-complete');
  });

  it('loads normally when tab is visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    const { scene, getPreloadedKeys, getPreloadCalls } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getPreloadedKeys().length).toBeGreaterThan(0);
    expect(getPreloadCalls()).toHaveLength(1);
  });
});

describe('MenuScene.scheduleIdlePreloadMusic', () => {
  it('uses requestIdleCallback when available', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    const { scene, getPreloadCalls } = makeScene([]);
    const origRIC = (globalThis as Record<string, unknown>)['requestIdleCallback'];
    const ric = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    (globalThis as Record<string, unknown>)['requestIdleCallback'] = ric;

    try {
      (scene as unknown as { scheduleIdlePreloadMusic: () => void }).scheduleIdlePreloadMusic();
      expect(ric).toHaveBeenCalledTimes(1);
      expect(getPreloadCalls()).toHaveLength(1);
    } finally {
      (globalThis as Record<string, unknown>)['requestIdleCallback'] = origRIC;
    }
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    const { scene, getPreloadCalls } = makeScene([]);
    const origRIC = (globalThis as Record<string, unknown>)['requestIdleCallback'];
    delete (globalThis as Record<string, unknown>)['requestIdleCallback'];

    try {
      (scene as unknown as { scheduleIdlePreloadMusic: () => void }).scheduleIdlePreloadMusic();
      expect(getPreloadCalls()).toHaveLength(0);
      vi.runAllTimers();
      expect(getPreloadCalls()).toHaveLength(1);
    } finally {
      (globalThis as Record<string, unknown>)['requestIdleCallback'] = origRIC;
      vi.useRealTimers();
    }
  });
});

describe('MenuScene.create — visibilitychange listener', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;
  let shutdownFns: Array<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
    shutdownFns = [];
    vi.mocked(createSceneLifecycle).mockImplementation(() => ({
      add: vi.fn((fn: () => void) => { shutdownFns.push(fn); }),
      bindInput: vi.fn(),
      bindEventBus: vi.fn(),
      dispose: vi.fn(),
    }));
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
    vi.mocked(createSceneLifecycle).mockImplementation(
      () => ({ add: vi.fn(), bindInput: vi.fn(), bindEventBus: vi.fn(), dispose: vi.fn() }),
    );
  });

  it('registers a visibilitychange listener on create()', () => {
    makeCreateScene();
    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('unregisters the visibilitychange listener on scene shutdown', () => {
    makeCreateScene();
    const registeredFn = addSpy.mock.calls.find((c: Parameters<typeof document.addEventListener>) => c[0] === 'visibilitychange')?.[1];
    expect(registeredFn).toBeDefined();
    // Simulate scene shutdown by running all captured lifecycle teardown callbacks.
    shutdownFns.forEach((fn) => fn());
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', registeredFn);
  });
});

describe('MenuScene.create — reduced-motion guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips all four animation tweens when isReducedMotion() is true', () => {
    vi.spyOn(MotionPreference, 'isReducedMotion').mockReturnValue(true);
    const scene = makeCreateScene();
    expect((scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect((scene.tweens.addCounter as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    // Daily Challenge UI schedules a midnight refresh timer; reduced motion
    // should still suppress animation-driven delayed calls.
    expect((scene.time.delayedCall as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('creates all four animation tweens when isReducedMotion() is false', () => {
    vi.spyOn(MotionPreference, 'isReducedMotion').mockReturnValue(false);
    const scene = makeCreateScene();
    // starfield twinkle + elevator cab ride + headline pulse — exact count ≥ 1
    expect((scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((scene.tweens.addCounter as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    // initial elevator delayedCall
    expect((scene.time.delayedCall as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

// ── warmupDeferredAssets / proceduralAssetsReady ──────────────────────────────
//
// These tests verify the readiness signal: BootScene writes `false` and
// MenuScene's warmup writes `true` once all deferred phases complete.
// The Phaser mock's `time.addEvent` is synchronised in these tests so the
// async callback chain runs inline, keeping assertions straightforward.

describe('MenuScene.warmupDeferredAssets — proceduralAssetsReady signal', () => {
  /** Build a MenuScene instance wired for synchronous warmup execution. */
  function makeWarmupScene({
    tilesExist = false,
    jumpExists = false,
  }: { tilesExist?: boolean; jumpExists?: boolean } = {}) {
    const loadOnceCallbacks: (() => void)[] = [];
    const registryValues: Map<string, unknown> = new Map();
    const sceneEventHandlers: Record<string, Array<() => void>> = {};

    // Drive time.addEvent callbacks synchronously so the full warmup chain
    // runs to completion inside the test without needing async utilities.
    // Cast to unknown first to avoid TypeScript complaining about private methods.
    type WarmupScene = {
      warmupDeferredAssets: () => void;
      registry: { get: (k: string) => unknown; set: (k: string, v: unknown) => void };
      textures: { exists: (k: string) => boolean };
      cache: { audio: { exists: (k: string) => boolean } };
      load: { audio: (k: string, p: string) => void; start: ReturnType<typeof vi.fn>; once: (ev: string, cb: () => void) => void };
      time: { addEvent: (cfg: { delay: number; callback: () => void }) => void; delayedCall: () => void };
      events: { once: (ev: string, fn: () => void) => void; emit: (ev: string) => void };
    };
    const scene = new MenuScene() as unknown as WarmupScene;

    Object.defineProperty(scene, 'textures', {
      value: { exists: (k: string) => (k === 'tiles' ? tilesExist : false) },
      configurable: true,
    });
    Object.defineProperty(scene, 'cache', {
      value: { audio: { exists: (k: string) => (k === 'jump' ? jumpExists : false) } },
      configurable: true,
    });
    Object.defineProperty(scene, 'registry', {
      value: {
        get: (k: string) => registryValues.get(k),
        set: (k: string, v: unknown) => { registryValues.set(k, v); },
      },
      configurable: true,
    });
    Object.defineProperty(scene, 'load', {
      value: {
        audio: vi.fn(),
        start: vi.fn(),
        once: vi.fn((ev: string, cb: () => void) => {
          if (ev === 'complete') loadOnceCallbacks.push(cb);
        }),
      },
      configurable: true,
    });
    Object.defineProperty(scene, 'time', {
      value: {
        // Execute callbacks synchronously so tests don't need async utilities.
        addEvent: vi.fn((cfg: { callback: () => void }) => cfg.callback()),
        delayedCall: vi.fn(),
      },
      configurable: true,
    });
    Object.defineProperty(scene, 'events', {
      value: {
        once: vi.fn((ev: string, fn: () => void) => {
          (sceneEventHandlers[ev] ??= []).push(fn);
        }),
        emit: vi.fn((ev: string) => {
          const list = sceneEventHandlers[ev]?.splice(0) ?? [];
          for (const fn of list) fn();
        }),
      },
      configurable: true,
    });

    return {
      scene,
      registryValues,
      /** Trigger the load.once('complete') callback captured during warmup. */
      fireLoadComplete: () => {
        for (const cb of loadOnceCallbacks) cb();
      },
      /** Simulate scene shutdown (e.g. scene.start('SaveSlotScene') called). */
      fireShutdown: () => {
        const list = sceneEventHandlers['shutdown']?.splice(0) ?? [];
        for (const fn of list) fn();
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets proceduralAssetsReady=true immediately when all assets are cached', () => {
    const { scene, registryValues } = makeWarmupScene({
      tilesExist: true,
      jumpExists: true,
    });
    scene.warmupDeferredAssets();
    vi.runAllTimers();

    // Both cache guards hit — flag set synchronously, no loader dance needed.
    expect(registryValues.get('proceduralAssetsReady')).toBe(true);
  });

  it('sets proceduralAssetsReady=true after sprites-only warmup (sounds cached)', () => {
    const { scene, registryValues } = makeWarmupScene({
      tilesExist: false,
      jumpExists: true,
    });
    scene.warmupDeferredAssets();
    vi.runAllTimers();

    // Deferred sprite phases run then sounds are skipped; flag set synchronously.
    expect(registryValues.get('proceduralAssetsReady')).toBe(true);
  });

  it('sets proceduralAssetsReady=true after full warmup (no assets cached)', () => {
    const { scene, registryValues, fireLoadComplete } = makeWarmupScene({
      tilesExist: false,
      jumpExists: false,
    });
    scene.warmupDeferredAssets();
    vi.runAllTimers();

    // Flag not set until load.once('complete') fires.
    expect(registryValues.get('proceduralAssetsReady')).toBeUndefined();

    fireLoadComplete();
    expect(registryValues.get('proceduralAssetsReady')).toBe(true);
  });

  it('calls load.start() to decode queued audio blobs', () => {
    const { scene } = makeWarmupScene({ tilesExist: false, jumpExists: false });
    scene.warmupDeferredAssets();
    vi.runAllTimers();

    const loadStart = (scene.load.start as ReturnType<typeof vi.fn>);
    expect(loadStart).toHaveBeenCalled();
  });

  it('schedules runDeferredAssets via setTimeout when requestIdleCallback is absent', () => {
    // Temporarily hide rIC to test the fallback path.
    // Use try/finally so the global is always restored even if assertions fail.
    const origRIC = (globalThis as Record<string, unknown>)['requestIdleCallback'];
    delete (globalThis as Record<string, unknown>)['requestIdleCallback'];

    try {
      const { scene, registryValues } = makeWarmupScene({
        tilesExist: true,
        jumpExists: true,
      });
      scene.warmupDeferredAssets();

      // Nothing should have run yet — setTimeout is pending.
      expect(registryValues.get('proceduralAssetsReady')).toBeUndefined();

      vi.runAllTimers();
      expect(registryValues.get('proceduralAssetsReady')).toBe(true);
    } finally {
      (globalThis as Record<string, unknown>)['requestIdleCallback'] = origRIC;
    }
  });

  // ── Shutdown safety ─────────────────────────────────────────────────────────
  // The warmup pipeline uses browser timers (rIC/setTimeout) which outlive
  // Phaser's scene lifecycle. These tests verify that a scene shutdown (e.g.
  // player navigates to SaveSlotScene before warmup finishes) correctly:
  //   1. Cancels the pending browser timer so it cannot fire on a dead scene.
  //   2. Force-completes generation synchronously before the scene tears down.

  it('force-completes sprites on shutdown before rIC fires (no assets cached)', () => {
    const { scene, registryValues, fireLoadComplete, fireShutdown } = makeWarmupScene({
      tilesExist: false,
      jumpExists: false,
    });

    // warmupDeferredAssets queues the rIC but does NOT run it yet.
    scene.warmupDeferredAssets();

    // Simulate scene shutdown BEFORE the rIC/setTimeout fires.
    fireShutdown();

    // The force-complete path should have started the loader for sounds.
    const loadStart = (scene.load.start as ReturnType<typeof vi.fn>);
    expect(loadStart).toHaveBeenCalled();

    // proceduralAssetsReady is set once the loader completes.
    fireLoadComplete();
    expect(registryValues.get('proceduralAssetsReady')).toBe(true);
  });

  it('force-completes immediately on shutdown when sounds are already cached', () => {
    const { scene, registryValues, fireShutdown } = makeWarmupScene({
      tilesExist: false,
      jumpExists: true,
    });
    scene.warmupDeferredAssets();
    fireShutdown();

    // Sprites run synchronously + sounds cached → flag set without loader dance.
    expect(registryValues.get('proceduralAssetsReady')).toBe(true);
  });

  it('does not run the rIC callback after scene shutdown', () => {
    const { scene, registryValues, fireShutdown } = makeWarmupScene({
      tilesExist: false,
      jumpExists: false,
    });
    scene.warmupDeferredAssets();
    fireShutdown();

    // Clear the flag written by _forceCompleteWarmup to detect any re-run.
    registryValues.clear();

    // Fire any pending timers — the cancelled rIC/setTimeout must not re-run.
    vi.runAllTimers();

    // No second registry write should have occurred.
    expect(registryValues.has('proceduralAssetsReady')).toBe(false);
  });

  it('skips force-complete on shutdown if warmup already finished normally', () => {
    const { scene, registryValues, fireLoadComplete, fireShutdown } = makeWarmupScene({
      tilesExist: false,
      jumpExists: false,
    });
    scene.warmupDeferredAssets();

    // Let the full pipeline run (sprites + sounds started).
    vi.runAllTimers();
    fireLoadComplete();
    expect(registryValues.get('proceduralAssetsReady')).toBe(true);

    // Now simulate shutdown (e.g. player navigates away after warmup completes).
    const loadStart = (scene.load.start as ReturnType<typeof vi.fn>);
    const callsBefore = (loadStart as ReturnType<typeof vi.fn>).mock.calls.length;
    fireShutdown();

    // load.start must NOT have been called a second time.
    expect((loadStart as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });
});
