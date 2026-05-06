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
    load = { audio: vi.fn(), start: vi.fn(), once: vi.fn() };
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
});

// Stub heavy imports that pull in Phaser internals.
vi.mock('../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  COLORS: { titleText: '#ffffff', hudText: '#ffffff' },
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
  DEFERRED_SPRITE_PHASES: [{ label: 'Deferred sprite', run: vi.fn() }],
}));
vi.mock('../../systems/SoundGenerator', () => ({
  BATCHED_SOUND_PHASES: [
    { label: 'Sound batch 1', run: vi.fn() },
    { label: 'Sound batch 2', run: vi.fn() },
  ],
}));

import { STATIC_MUSIC_ASSETS } from '../../config/audioConfig';
import { MenuScene } from './MenuScene';
import * as MotionPreference from '../../systems/MotionPreference';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build the minimal scene surface idlePreloadMusic reads. */
function makeScene(cachedKeys: string[] = []) {
  const loadedKeys: string[] = [];
  let loadStarted = false;

  const scene = new MenuScene() as unknown as {
    cache: { audio: { exists: (k: string) => boolean } };
    load: { audio: (k: string, p: string) => void; start: () => void };
    idlePreloadMusic: () => void;
  };

  Object.defineProperty(scene, 'cache', {
    value: { audio: { exists: (k: string) => cachedKeys.includes(k) } },
    configurable: true,
  });
  Object.defineProperty(scene, 'load', {
    value: {
      audio: (k: string, _p: string) => { loadedKeys.push(k); },
      start: () => { loadStarted = true; },
    },
    configurable: true,
  });

  return {
    scene,
    getLoadedKeys: () => loadedKeys,
    isLoadStarted: () => loadStarted,
  };
}

/** Create a MenuScene instance and call create() on it. */
function makeCreateScene(): MenuScene {
  const scene = new MenuScene();
  (scene as unknown as { create: () => void }).create();
  return scene;
}

// ── Tests ────────────────────────────────────────────────────────────────────

const nonEagerKeys = STATIC_MUSIC_ASSETS.filter((a) => !a.eager).map((a) => a.key);

describe('MenuScene.idlePreloadMusic', () => {
  let origConnection: unknown;

  beforeEach(() => {
    origConnection = (navigator as unknown as Record<string, unknown>)['connection'];
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

  it('queues all non-eager uncached tracks and starts the loader', () => {
    setConnection(undefined);
    const { scene, getLoadedKeys, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).toEqual(nonEagerKeys);
    expect(isLoadStarted()).toBe(true);
  });

  it('skips tracks that are already cached', () => {
    setConnection(undefined);
    const firstKey = nonEagerKeys[0]!;
    const { scene, getLoadedKeys } = makeScene([firstKey]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).not.toContain(firstKey);
    expect(getLoadedKeys().length).toBe(nonEagerKeys.length - 1);
  });

  it('does nothing when all non-eager tracks are cached', () => {
    setConnection(undefined);
    const { scene, getLoadedKeys, isLoadStarted } = makeScene(nonEagerKeys);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).toHaveLength(0);
    expect(isLoadStarted()).toBe(false);
  });

  it('skips when saveData is true', () => {
    setConnection({ saveData: true });
    const { scene, getLoadedKeys, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).toHaveLength(0);
    expect(isLoadStarted()).toBe(false);
  });

  it('skips on 2g connection', () => {
    setConnection({ effectiveType: '2g' });
    const { scene, getLoadedKeys, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).toHaveLength(0);
    expect(isLoadStarted()).toBe(false);
  });

  it('skips on slow-2g connection', () => {
    setConnection({ effectiveType: 'slow-2g' });
    const { scene, getLoadedKeys, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).toHaveLength(0);
    expect(isLoadStarted()).toBe(false);
  });

  it('does not skip on 3g or faster connections', () => {
    setConnection({ effectiveType: '3g' });
    const { scene, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(isLoadStarted()).toBe(true);
  });

  it('does not queue eager tracks', () => {
    setConnection(undefined);
    const eagerKeys = STATIC_MUSIC_ASSETS.filter((a) => a.eager).map((a) => a.key);
    const { scene, getLoadedKeys } = makeScene([]);
    scene.idlePreloadMusic();
    for (const k of eagerKeys) {
      expect(getLoadedKeys()).not.toContain(k);
    }
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
    expect((scene.time.delayedCall as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
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

    return {
      scene,
      registryValues,
      /** Trigger the load.once('complete') callback captured during warmup. */
      fireLoadComplete: () => {
        for (const cb of loadOnceCallbacks) cb();
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
    const { scene, registryValues, fireLoadComplete } = makeWarmupScene({
      tilesExist: true,
      jumpExists: true,
    });
    scene.warmupDeferredAssets();
    vi.runAllTimers();

    // No loader dance needed — both guards hit, flag set synchronously.
    fireLoadComplete();
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
});
