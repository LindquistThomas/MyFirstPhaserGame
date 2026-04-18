import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager } from './AudioManager';
import { eventBus } from './EventBus';
import { SFX_EVENTS } from '../config/audioConfig';

const MUTE_STORAGE_KEY = 'architect_audio_muted_v1';

interface FakeSoundInstance {
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface FakeSoundManager {
  mute: boolean;
  play: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  _instances: FakeSoundInstance[];
}

function makeFakeSoundManager(): FakeSoundManager {
  const instances: FakeSoundInstance[] = [];
  const mgr: FakeSoundManager = {
    mute: false,
    play: vi.fn(),
    add: vi.fn((_key: string) => {
      const inst: FakeSoundInstance = {
        play: vi.fn(),
        stop: vi.fn(),
        destroy: vi.fn(),
      };
      instances.push(inst);
      return inst;
    }),
    _instances: instances,
  };
  return mgr;
}

/** Strip all listeners from the EventBus singleton between tests. */
function resetEventBus(): void {
  const listeners = (eventBus as unknown as { listeners: Map<unknown, unknown> }).listeners;
  listeners.clear();
}

describe('AudioManager', () => {
  let fakeSound: FakeSoundManager;
  let manager: AudioManager;

  beforeEach(() => {
    localStorage.clear();
    resetEventBus();
    fakeSound = makeFakeSoundManager();
    // Cast to unknown to bypass Phaser's rich type — the subset we use is covered.
    manager = new AudioManager(fakeSound as unknown as Phaser.Sound.BaseSoundManager);
    manager.registerEventListeners();
  });

  afterEach(() => {
    resetEventBus();
    localStorage.clear();
  });

  describe('SFX', () => {
    it('subscribes to every SFX event declared in audioConfig', () => {
      const events = Object.keys(SFX_EVENTS) as Array<keyof typeof SFX_EVENTS>;
      for (const ev of events) {
        fakeSound.play.mockClear();
        eventBus.emit(ev);
        expect(fakeSound.play).toHaveBeenCalledWith(SFX_EVENTS[ev]);
      }
    });

    it('routes a specific sfx event to the correct audio key', () => {
      eventBus.emit('sfx:jump');
      expect(fakeSound.play).toHaveBeenCalledWith('jump');
    });

    it('does not play anything before events are emitted', () => {
      expect(fakeSound.play).not.toHaveBeenCalled();
    });
  });

  describe('Music', () => {
    it('music:play adds and starts a sound instance', () => {
      eventBus.emit('music:play', 'music_menu');
      expect(fakeSound.add).toHaveBeenCalledWith('music_menu', expect.objectContaining({ loop: true }));
      expect(fakeSound._instances).toHaveLength(1);
      expect(fakeSound._instances[0].play).toHaveBeenCalledTimes(1);
    });

    it('music:play with the same key twice in a row skips the second add', () => {
      eventBus.emit('music:play', 'music_menu');
      eventBus.emit('music:play', 'music_menu');
      expect(fakeSound.add).toHaveBeenCalledTimes(1);
    });

    it('music:play with a different key stops the previous track', () => {
      eventBus.emit('music:play', 'track_a');
      const first = fakeSound._instances[0];
      eventBus.emit('music:play', 'track_b');
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(first.destroy).toHaveBeenCalledTimes(1);
      expect(fakeSound.add).toHaveBeenCalledTimes(2);
    });

    it('music:stop halts the current track', () => {
      eventBus.emit('music:play', 'track_a');
      const first = fakeSound._instances[0];
      eventBus.emit('music:stop');
      expect(first.stop).toHaveBeenCalledTimes(1);
    });

    it('music:stop without any current track is a no-op', () => {
      expect(() => eventBus.emit('music:stop')).not.toThrow();
    });

    it('music:push suspends current track and music:pop restores it', () => {
      eventBus.emit('music:play', 'base');
      eventBus.emit('music:push', 'overlay');
      expect(fakeSound.add).toHaveBeenLastCalledWith('overlay', expect.anything());

      eventBus.emit('music:pop');
      // After pop, the base should be playing again — a new sound instance is added for it.
      expect(fakeSound.add).toHaveBeenLastCalledWith('base', expect.anything());
    });

    it('music:pop with an empty stack stops music', () => {
      eventBus.emit('music:play', 'base');
      const first = fakeSound._instances[0];
      eventBus.emit('music:pop');
      expect(first.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mute', () => {
    it('starts unmuted by default', () => {
      expect(manager.isMuted()).toBe(false);
    });

    it('audio:toggle-mute flips mute state', () => {
      eventBus.emit('audio:toggle-mute');
      expect(manager.isMuted()).toBe(true);
      eventBus.emit('audio:toggle-mute');
      expect(manager.isMuted()).toBe(false);
    });

    it('persists mute state to localStorage on toggle', () => {
      eventBus.emit('audio:toggle-mute');
      expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('1');
      eventBus.emit('audio:toggle-mute');
      expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('0');
    });

    it('emits audio:mute-changed with new state when toggled', () => {
      const listener = vi.fn();
      eventBus.on('audio:mute-changed', listener);
      eventBus.emit('audio:toggle-mute');
      expect(listener).toHaveBeenCalledWith(true);
      eventBus.emit('audio:toggle-mute');
      expect(listener).toHaveBeenLastCalledWith(false);
    });

    it('restores persisted mute preference from localStorage on construction', () => {
      localStorage.setItem(MUTE_STORAGE_KEY, '1');
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(true);
      expect(sound.mute).toBe(true);
    });

    it('does not mute on construction if persisted value is not "1"', () => {
      localStorage.setItem(MUTE_STORAGE_KEY, '0');
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(false);
    });
  });
});
