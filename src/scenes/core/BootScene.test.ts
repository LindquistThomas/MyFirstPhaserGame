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
    registry = { set: vi.fn() };
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
}));
vi.mock('../../systems/SoundGenerator', () => ({
  generateSounds: vi.fn(),
  SOUND_PHASES: [],
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
vi.mock('../../config/gameConfig', () => ({ COLORS: { hudText: '#fff', titleText: '#fff' } }));
vi.mock('../../style/theme', () => ({ theme: { color: { ui: { accent: 0xffffff } } } }));

// isPersistenceAvailable is the module under test — NOT mocked by default.
// Individual tests that need to control the return value use vi.spyOn.

import { eventBus } from '../../systems/EventBus';
import { BootScene } from './BootScene';
import * as PersistedStore from '../../systems/PersistedStore';

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
