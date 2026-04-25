import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager } from './AudioManager';
import { eventBus } from './EventBus';
import { MUSIC_VOLUME, SFX_EVENTS } from '../config/audioConfig';

const MUTE_STORAGE_KEY = 'architect_audio_muted_v1';

interface FakeSoundInstance {
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  isPlaying: boolean;
  isPaused: boolean;
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
        play: vi.fn().mockImplementation(function (this: FakeSoundInstance) { this.isPlaying = true; this.isPaused = false; }),
        stop: vi.fn().mockImplementation(function (this: FakeSoundInstance) { this.isPlaying = false; this.isPaused = false; }),
        destroy: vi.fn(),
        pause: vi.fn().mockImplementation(function (this: FakeSoundInstance) { this.isPlaying = false; this.isPaused = true; }),
        resume: vi.fn().mockImplementation(function (this: FakeSoundInstance) { this.isPlaying = true; this.isPaused = false; }),
        isPlaying: false,
        isPaused: false,
      };
      instances.push(inst);
      return inst;
    }),
    _instances: instances,
  };
  return mgr;
}

describe('AudioManager', () => {
  let fakeSound: FakeSoundManager;
  let manager: AudioManager;

  beforeEach(() => {
    localStorage.clear();
    eventBus.removeAllListeners();
    fakeSound = makeFakeSoundManager();
    // Cast to unknown to bypass Phaser's rich type — the subset we use is covered.
    manager = new AudioManager(fakeSound as unknown as Phaser.Sound.BaseSoundManager);
    manager.registerEventListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
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
      expect(fakeSound._instances[0]!.play).toHaveBeenCalledTimes(1);
    });

    it('music:play with the same key twice in a row skips the second add', () => {
      eventBus.emit('music:play', 'music_menu');
      eventBus.emit('music:play', 'music_menu');
      expect(fakeSound.add).toHaveBeenCalledTimes(1);
    });

    it('music:play with a different key stops the previous track', () => {
      eventBus.emit('music:play', 'track_a');
      const first = fakeSound._instances[0]!;
      eventBus.emit('music:play', 'track_b');
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(first.destroy).toHaveBeenCalledTimes(1);
      expect(fakeSound.add).toHaveBeenCalledTimes(2);
    });

    it('music:stop halts the current track', () => {
      eventBus.emit('music:play', 'track_a');
      const first = fakeSound._instances[0]!;
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
      const first = fakeSound._instances[0]!;
      eventBus.emit('music:pop');
      expect(first.stop).toHaveBeenCalledTimes(1);
    });

    it('music:pause calls pause() on the playing track', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0];
      inst.isPlaying = true;
      eventBus.emit('music:pause');
      expect(inst.pause).toHaveBeenCalledTimes(1);
    });

    it('music:pause is a no-op when no track is playing', () => {
      expect(() => eventBus.emit('music:pause')).not.toThrow();
    });

    it('music:pause is a no-op when track is already paused', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0];
      inst.isPlaying = false; // not playing (e.g. already paused)
      eventBus.emit('music:pause');
      expect(inst.pause).not.toHaveBeenCalled();
    });

    it('music:resume calls resume() on a paused track', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0];
      inst.isPaused = true;
      eventBus.emit('music:resume');
      expect(inst.resume).toHaveBeenCalledTimes(1);
    });

    it('music:resume is a no-op when no track exists', () => {
      expect(() => eventBus.emit('music:resume')).not.toThrow();
    });

    it('music:resume is a no-op when track is not paused', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0];
      inst.isPaused = false;
      eventBus.emit('music:resume');
      expect(inst.resume).not.toHaveBeenCalled();
    });

    it('pause then resume round-trip leaves track playing', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0];
      inst.isPlaying = true;
      eventBus.emit('music:pause');
      // After pause, isPlaying is false and isPaused is true (set by mock).
      eventBus.emit('music:resume');
      expect(inst.pause).toHaveBeenCalledTimes(1);
      expect(inst.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ambience', () => {
    it('ambience:play adds and starts a looping sound at lower volume than music', () => {
      eventBus.emit('ambience:play', 'ambience_datacenter');
      expect(fakeSound.add).toHaveBeenCalledWith(
        'ambience_datacenter',
        expect.objectContaining({ loop: true }),
      );
      const callVolume = (fakeSound.add.mock.calls[0]![1] as { volume: number }).volume;
      // Ambience must be quieter than music so it sits UNDER the main track.
      expect(callVolume).toBeLessThan(MUSIC_VOLUME);
      expect(fakeSound._instances).toHaveLength(1);
      expect(fakeSound._instances[0]!.play).toHaveBeenCalledTimes(1);
    });

    it('ambience:play with the same key twice skips the second add', () => {
      eventBus.emit('ambience:play', 'ambience_datacenter');
      eventBus.emit('ambience:play', 'ambience_datacenter');
      expect(fakeSound.add).toHaveBeenCalledTimes(1);
    });

    it('ambience:play with a different key stops the previous bed', () => {
      eventBus.emit('ambience:play', 'ambience_a');
      const first = fakeSound._instances[0]!;
      eventBus.emit('ambience:play', 'ambience_b');
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(first.destroy).toHaveBeenCalledTimes(1);
      expect(fakeSound.add).toHaveBeenCalledTimes(2);
    });

    it('ambience:stop halts the current bed', () => {
      eventBus.emit('ambience:play', 'ambience_a');
      const first = fakeSound._instances[0]!;
      eventBus.emit('ambience:stop');
      expect(first.stop).toHaveBeenCalledTimes(1);
    });

    it('ambience:stop with nothing playing is a no-op', () => {
      expect(() => eventBus.emit('ambience:stop')).not.toThrow();
    });

    it('ambience is independent of music — music:stop does not stop ambience', () => {
      eventBus.emit('music:play', 'music_x');
      eventBus.emit('ambience:play', 'ambience_a');
      const ambienceInst = fakeSound._instances[1]!;
      eventBus.emit('music:stop');
      expect(ambienceInst.stop).not.toHaveBeenCalled();
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
      expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('true');
      eventBus.emit('audio:toggle-mute');
      expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('false');
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
      localStorage.setItem(MUTE_STORAGE_KEY, 'true');
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(true);
      expect(sound.mute).toBe(true);
    });

    it('does not mute on construction if persisted value is "false"', () => {
      localStorage.setItem(MUTE_STORAGE_KEY, 'false');
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(false);
    });

    it('honours the legacy "1" / "0" encoding on read for backward compat', () => {
      localStorage.setItem(MUTE_STORAGE_KEY, '1');
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(true);

      localStorage.setItem(MUTE_STORAGE_KEY, '0');
      const sound2 = makeFakeSoundManager();
      const m2 = new AudioManager(sound2 as unknown as Phaser.Sound.BaseSoundManager);
      expect(m2.isMuted()).toBe(false);
    });
  });
});
