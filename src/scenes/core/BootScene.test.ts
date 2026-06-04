import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub Phaser so the module loads without the full runtime.
vi.mock('phaser', () => {
  class Scene {
    events = (() => {
      const handlers: Record<string, Array<() => void>> = {};
      return {
        handlers,
        once(ev: string, fn: () => void) {
          (handlers[ev] ??= []).push(fn);
        },
        emit(ev: string) {
          const list = handlers[ev]?.slice() ?? [];
          for (const fn of list) fn();
        },
      };
    })();
    registry = { set: vi.fn(), get: vi.fn(() => undefined), remove: vi.fn() };
    scene = { start: vi.fn() };
    cameras = { main: { width: 800, height: 600 } };
    add = {
      graphics: () => ({ fillStyle: vi.fn(), fillRect: vi.fn(), clear: vi.fn(), destroy: vi.fn() }),
      text: () => ({ setOrigin: vi.fn().mockReturnThis(), setText: vi.fn(), destroy: vi.fn() }),
    };
    load = (() => {
      const loadHandlers: Record<string, Array<(file: unknown) => void>> = {};
      return {
        _handlers: loadHandlers,
        on: vi.fn((event: string, fn: (file: unknown) => void) => {
          (loadHandlers[event] ??= []).push(fn);
        }),
        once: vi.fn(),
        off: vi.fn((event: string, fn: (file: unknown) => void) => {
          const list = loadHandlers[event];
          if (!list) return;
          const idx = list.indexOf(fn);
          if (idx >= 0) list.splice(idx, 1);
        }),
        start: vi.fn(),
        audio: vi.fn(),
        svg: vi.fn(),
        /** Test helper: fire all registered handlers for a loader event. */
        emit(event: string, arg: unknown) {
          for (const fn of loadHandlers[event] ?? []) fn(arg);
        },
      };
    })();
    sound = {};
    game = {};
    cache = { audio: { exists: vi.fn().mockReturnValue(false) } };
    textures = { exists: vi.fn().mockReturnValue(false) };
    // Drive addEvent callbacks synchronously so create() fully resolves in tests.
    time = {
      addEvent: vi.fn((config: { delay: number; callback: () => void }) => {
        config.callback();
      }),
    };
    constructor(_config: unknown) {}
  }
  const phaser = { Scene };
  return { ...phaser, default: phaser };
});

// Stub heavy systems so only the window listener logic is exercised.
vi.mock('../../systems/SpriteGenerator', () => ({
  generateSprites: vi.fn(),
  SPRITE_PHASES: [],
  BOOT_SPRITE_PHASES: [],
}));
vi.mock('../../systems/SoundGenerator', () => ({
  generateSounds: vi.fn(),
  SOUND_PHASES: [],
  BATCHED_SOUND_PHASES: [],
}));
vi.mock('../../systems/AudioManager', () => ({
  AudioManager: class {
    registerEventListeners = vi.fn();
  },
}));
vi.mock('../../systems/GameStateManager', () => ({
  GameStateManager: class {},
}));
vi.mock('../../systems/SaveManager', () => ({
  migrateDefaultSlot: vi.fn(),
  setPlayerSlot: vi.fn(),
}));
vi.mock('../../config/audioConfig', () => ({ STATIC_MUSIC_ASSETS: [] }));
vi.mock('../../config/gameConfig', () => ({
  COLORS: { hudText: '#fff', titleText: '#fff' },
  FLOOR_IDS: [0, 1, 3, 4, 5, 6],
}));
vi.mock('../../style/theme', () => ({ theme: { color: { ui: { accent: 0xffffff } } } }));
vi.mock('../../config/info', () => ({ preloadInfoFor: vi.fn(() => Promise.resolve()) }));
vi.mock('../../config/quiz', () => ({ preloadQuizFor: vi.fn(() => Promise.resolve()) }));
vi.mock('../../systems/WorldModifiers', () => ({ getWorldModifiers: vi.fn(() => ({})) }));
vi.mock('../../systems/PerfReporter', () => ({
  createGamePerfReporter: vi.fn(() => ({ destroy: vi.fn() })),
}));

// isPersistenceAvailable is the module under test — NOT mocked by default.
// Individual tests that need to control the return value use vi.spyOn.

import { eventBus } from '../../systems/EventBus';
import { BootScene, deriveBootBudget } from './BootScene';
import * as PersistedStore from '../../systems/PersistedStore';
import * as InfoModule from '../../config/info';
import * as QuizModule from '../../config/quiz';
import * as AnalyticsModule from '../../systems/Analytics';
import * as PerfReporterModule from '../../systems/PerfReporter';

describe('BootScene — persistenceAvailable registry flag', () => {
  let scene: BootScene;

  beforeEach(() => {
    scene = new BootScene();
  });

  afterEach(() => {
    // Trigger destroy so the window keydown listener is removed (same as M-key suite).
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');
    vi.restoreAllMocks();
  });

  it('writes true to registry when storage is available', () => {
    vi.spyOn(PersistedStore, 'isPersistenceAvailable').mockReturnValue(true);
    scene.create();
    expect(scene.registry.set).toHaveBeenCalledWith('persistenceAvailable', true);
  });

  it('writes false to registry when storage is unavailable', () => {
    vi.spyOn(PersistedStore, 'isPersistenceAvailable').mockReturnValue(false);
    scene.create();
    expect(scene.registry.set).toHaveBeenCalledWith('persistenceAvailable', false);
  });
});

describe('BootScene — perf telemetry wiring', () => {
  let scene: BootScene | undefined;

  afterEach(() => {
    if (scene) {
      (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');
    }
    scene = undefined;
    vi.restoreAllMocks();
  });

  it('creates and stores perfReporter when analytics service exists', () => {
    const analytics = { unbind: vi.fn(), capturePerfSample: vi.fn() } as unknown as AnalyticsModule.AnalyticsService;
    vi.spyOn(AnalyticsModule, 'createAnalyticsService').mockReturnValue(analytics);
    scene = new BootScene();

    scene.create();

    expect(PerfReporterModule.createGamePerfReporter).toHaveBeenCalledWith(scene.game, analytics);
    expect(scene.registry.set).toHaveBeenCalledWith('perfReporter', expect.objectContaining({ destroy: expect.any(Function) }));
  });

  it('does not create perfReporter when analytics is structurally disabled', () => {
    vi.spyOn(AnalyticsModule, 'createAnalyticsService').mockReturnValue(null);
    vi.mocked(PerfReporterModule.createGamePerfReporter).mockClear();
    scene = new BootScene();

    scene.create();

    expect(PerfReporterModule.createGamePerfReporter).not.toHaveBeenCalled();
    expect(scene.registry.set).not.toHaveBeenCalledWith('perfReporter', expect.anything());
  });

  it('destroys perfReporter and unbinds analytics on destroy', () => {
    const analytics = { unbind: vi.fn(), capturePerfSample: vi.fn() } as unknown as AnalyticsModule.AnalyticsService;
    const perfHandle = { destroy: vi.fn() };
    vi.spyOn(AnalyticsModule, 'createAnalyticsService').mockReturnValue(analytics);
    vi.mocked(PerfReporterModule.createGamePerfReporter).mockReturnValue(perfHandle);
    scene = new BootScene();

    scene.create();
    scene.registry.get = vi.fn((key: string) => {
      if (key === 'perfReporter') return perfHandle;
      if (key === 'analytics') return analytics;
      return undefined;
    });
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');

    expect(perfHandle.destroy).toHaveBeenCalledTimes(1);
    expect(analytics.unbind).toHaveBeenCalledTimes(1);
  });
});

describe('BootScene M-key mute hotkey', () => {
  let scene: BootScene;
  let spy: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    spy = vi.fn<() => void>();
    eventBus.on('audio:toggle-mute', spy);
    scene = new BootScene();
    scene.create();
  });

  afterEach(() => {
    // Trigger destroy so the window listener registered by this test's scene is removed.
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');
    eventBus.off('audio:toggle-mute', spy);
  });

  it('emits audio:toggle-mute when M is pressed after create()', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('still emits audio:toggle-mute after shutdown (listener survives Boot→Menu transition)', () => {
    // In real Phaser, this.scene.start('MenuScene') fires BootScene shutdown immediately.
    // The hotkey must remain active after that transition.
    (scene.events as unknown as { emit: (ev: string) => void }).emit('shutdown');

    spy.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does NOT emit audio:toggle-mute after destroy', () => {
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');

    spy.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not double-register if create() is called a second time', () => {
    // Re-enter BootScene (simulate hot-reload or explicit re-entry).
    scene.create();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    // Should still fire exactly once, not twice.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated keydown events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', repeat: true, bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores M pressed inside an INPUT element', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});

// Helper: access the fake loader's emit method added in the Phaser mock above.
type LoadEmitter = { emit: (event: string, arg: unknown) => void };

describe('BootScene loaderror handler', () => {
  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('emits boot:asset-error and calls console.error when a file fails to load', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = new BootScene();

    scene.preload();

    const errorSpy = vi.fn();
    eventBus.on('boot:asset-error', errorSpy);

    const fakeFile = { key: 'music_menu', type: 'audio', src: 'music/bgm_menu.mp3' };
    (scene.load as unknown as LoadEmitter).emit('loaderror', fakeFile);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[BootScene] Asset failed to load:',
      'music_menu',
      'music/bgm_menu.mp3',
    );
    expect(errorSpy).toHaveBeenCalledWith({
      key: 'music_menu',
      type: 'audio',
      url: 'music/bgm_menu.mp3',
    });

    consoleSpy.mockRestore();
  });

  it('emits boot:asset-error for SVG assets too', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = new BootScene();

    scene.preload();

    const errorSpy = vi.fn();
    eventBus.on('boot:asset-error', errorSpy);

    const fakeFile = { key: 'lobby_logo', type: 'svg', src: 'brand/logo.svg' };
    (scene.load as unknown as LoadEmitter).emit('loaderror', fakeFile);

    expect(errorSpy).toHaveBeenCalledWith({
      key: 'lobby_logo',
      type: 'svg',
      url: 'brand/logo.svg',
    });

    consoleSpy.mockRestore();
  });

  it('emits boot:asset-error for each failing file independently', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = new BootScene();

    scene.preload();

    const receivedPayloads: Array<{ key: string; type: string; url: string }> = [];
    eventBus.on('boot:asset-error', (info) => receivedPayloads.push(info));

    (scene.load as unknown as LoadEmitter).emit('loaderror', { key: 'music_menu', type: 'audio', src: 'music/bgm_menu.mp3' });
    (scene.load as unknown as LoadEmitter).emit('loaderror', { key: 'lobby_logo', type: 'svg', src: 'brand/logo.svg' });

    expect(receivedPayloads).toHaveLength(2);
    expect(receivedPayloads[0]).toMatchObject({ key: 'music_menu', type: 'audio' });
    expect(receivedPayloads[1]).toMatchObject({ key: 'lobby_logo', type: 'svg' });

    consoleSpy.mockRestore();
  });

  it('stores error count in the Phaser registry after create()', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = new BootScene();

    scene.preload();

    // Trigger two load failures before create()
    (scene.load as unknown as LoadEmitter).emit('loaderror', { key: 'music_menu', type: 'audio', src: 'music/a.mp3' });
    (scene.load as unknown as LoadEmitter).emit('loaderror', { key: 'lobby_logo', type: 'svg', src: 'brand/b.svg' });

    scene.create();

    expect(scene.registry.set).toHaveBeenCalledWith('bootAssetErrors', expect.any(Number));
    // Extract the stored value to verify it reflects exactly the two errors.
    const calls = (scene.registry.set as ReturnType<typeof vi.fn>).mock.calls;
    const errorEntry = calls.find((c: unknown[]) => c[0] === 'bootAssetErrors');
    expect(errorEntry?.[1]).toBe(2);

    consoleSpy.mockRestore();
  });

  it('does not accumulate loaderror handlers when preload() is called twice', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = new BootScene();

    // First boot pass
    scene.preload();
    // Second boot pass — must replace the handler, not add another
    scene.preload();

    const errorSpy = vi.fn();
    eventBus.on('boot:asset-error', errorSpy);

    const fakeFile = { key: 'music_menu', type: 'audio', src: 'music/a.mp3' };
    (scene.load as unknown as LoadEmitter).emit('loaderror', fakeFile);

    // If the handler were accumulated, errorSpy would fire twice (once per handler).
    expect(errorSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});

describe('BootScene — proceduralAssetsReady registry flag', () => {
  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('sets proceduralAssetsReady to false in create() before starting MenuScene', () => {
    const scene = new BootScene();
    scene.create();
    // Verify false was written before true (if any). The flag starts false so
    // MenuScene's warmup knows to run the deferred generation pass.
    const calls = (scene.registry.set as ReturnType<typeof vi.fn>).mock.calls;
    const readyEntry = calls.find((c: unknown[]) => c[0] === 'proceduralAssetsReady');
    expect(readyEntry).toBeDefined();
    expect(readyEntry?.[1]).toBe(false);
  });

  it('sets proceduralAssetsReady to false on BootScene re-entry', () => {
    const scene = new BootScene();
    scene.create();
    (scene.registry.set as ReturnType<typeof vi.fn>).mockClear();
    // Re-enter
    scene.create();
    expect(scene.registry.set).toHaveBeenCalledWith('proceduralAssetsReady', false);
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');
  });
});

describe('BootScene — eager info/quiz preloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    vi.restoreAllMocks();
  });

  it('schedules preloadInfoFor and preloadQuizFor for all floors via requestIdleCallback', () => {
    const idleCallbacks: Array<() => void> = [];
    const origRic = globalThis.requestIdleCallback;
    (globalThis as Record<string, unknown>).requestIdleCallback = vi.fn((cb: () => void) => {
      idleCallbacks.push(cb);
    });

    const scene = new BootScene();
    scene.create();

    // requestIdleCallback should have been called once
    expect(idleCallbacks).toHaveLength(1);

    // Execute the idle callback
    idleCallbacks[0]!();

    const FLOOR_IDS = [0, 1, 3, 4, 5, 6];
    expect(InfoModule.preloadInfoFor).toHaveBeenCalledTimes(FLOOR_IDS.length);
    expect(QuizModule.preloadQuizFor).toHaveBeenCalledTimes(FLOOR_IDS.length);
    for (const floorId of FLOOR_IDS) {
      expect(InfoModule.preloadInfoFor).toHaveBeenCalledWith(floorId);
      expect(QuizModule.preloadQuizFor).toHaveBeenCalledWith(floorId);
    }

    // Restore
    if (origRic === undefined) {
      delete (globalThis as Record<string, unknown>).requestIdleCallback;
    } else {
      (globalThis as Record<string, unknown>).requestIdleCallback = origRic;
    }
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');
  });

  it('falls back to setTimeout(0) when requestIdleCallback is not available', () => {
    vi.useFakeTimers();
    const origRic = globalThis.requestIdleCallback;
    delete (globalThis as Record<string, unknown>).requestIdleCallback;

    const scene = new BootScene();
    scene.create();

    // Before timers fire, no preloads should have run
    expect(InfoModule.preloadInfoFor).not.toHaveBeenCalled();

    vi.runAllTimers();

    const FLOOR_IDS = [0, 1, 3, 4, 5, 6];
    expect(InfoModule.preloadInfoFor).toHaveBeenCalledTimes(FLOOR_IDS.length);
    expect(QuizModule.preloadQuizFor).toHaveBeenCalledTimes(FLOOR_IDS.length);

    // Restore
    if (origRic !== undefined) {
      (globalThis as Record<string, unknown>).requestIdleCallback = origRic;
    }
    vi.useRealTimers();
    (scene.events as unknown as { emit: (ev: string) => void }).emit('destroy');
  });
});

describe('deriveBootBudget — adaptive phase yield budget math', () => {
  it('returns 8 ms for a very fast device (phase ≤ 16 ms)', () => {
    expect(deriveBootBudget(0)).toBe(8);
    expect(deriveBootBudget(5)).toBe(8);
    expect(deriveBootBudget(16)).toBe(8);
  });

  it('returns half the measured ms for mid-range devices (17 ms ≤ phase < 32 ms)', () => {
    expect(deriveBootBudget(17)).toBeCloseTo(8.5);
    expect(deriveBootBudget(20)).toBe(10);
    expect(deriveBootBudget(24)).toBe(12);
    expect(deriveBootBudget(30)).toBe(15);
    expect(deriveBootBudget(31)).toBeCloseTo(15.5);
  });

  it('returns 16 ms for a slow device (phase >= 32 ms)', () => {
    expect(deriveBootBudget(32)).toBe(16);
    expect(deriveBootBudget(60)).toBe(16);
    expect(deriveBootBudget(100)).toBe(16);
  });

  it('is clamped to min 8 ms regardless of very short phase times', () => {
    expect(deriveBootBudget(1)).toBeGreaterThanOrEqual(8);
  });

  it('is clamped to max 16 ms regardless of very long phase times', () => {
    expect(deriveBootBudget(1000)).toBeLessThanOrEqual(16);
  });
});
