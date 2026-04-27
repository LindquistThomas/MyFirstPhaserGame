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
    load = {
      on: vi.fn(),
      audio: vi.fn(),
      svg: vi.fn(),
    };
    sound = {};
    constructor(_config: unknown) {}
  }
  const phaser = { Scene };
  return { ...phaser, default: phaser };
});

// Stub heavy systems so only the window listener logic is exercised.
vi.mock('../../systems/SpriteGenerator', () => ({ generateSprites: vi.fn() }));
vi.mock('../../systems/SoundGenerator', () => ({ generateSounds: vi.fn() }));
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

import { eventBus } from '../../systems/EventBus';
import { BootScene } from './BootScene';

describe('BootScene M-key mute hotkey', () => {
  let scene: BootScene;
  let spy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    spy = vi.fn();
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
