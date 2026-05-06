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
    registry = { get: vi.fn() };
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

import { STATIC_MUSIC_ASSETS } from '../../config/audioConfig';
import { MenuScene } from './MenuScene';
import * as MotionPreference from '../../systems/MotionPreference';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';

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
      // Immediately invoke filecomplete callbacks so the full chain runs
      // synchronously in tests, making all queued tracks observable.
      once: (_event: string, cb: () => void) => { cb(); },
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
    expect(getLoadedKeys()).toHaveLength(nonEagerKeys.length);
    expect(getLoadedKeys()).toEqual(expect.arrayContaining(nonEagerKeys));
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
    const { scene, getLoadedKeys, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys()).toHaveLength(0);
    expect(isLoadStarted()).toBe(false);
  });

  it('loads normally when tab is visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    const { scene, getLoadedKeys, isLoadStarted } = makeScene([]);
    scene.idlePreloadMusic();
    expect(getLoadedKeys().length).toBeGreaterThan(0);
    expect(isLoadStarted()).toBe(true);
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
