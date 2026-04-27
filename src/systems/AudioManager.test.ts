import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { AudioManager } from './AudioManager';
import { eventBus } from './EventBus';
import { MUSIC_VOLUME, SFX_EVENTS } from '../config/audioConfig';
import { settingsStore, SETTINGS_STORAGE_KEY } from './SettingsStore';

interface FakeSoundInstance {
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  isPlaying: boolean;
  isPaused: boolean;
}

interface FakeSoundManager {
  mute: boolean;
  volume: number;
  play: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  _instances: FakeSoundInstance[];
}

function makeFakeSoundManager(): FakeSoundManager {
  const instances: FakeSoundInstance[] = [];
  const mgr: FakeSoundManager = {
    mute: false,
    volume: 1,
    play: vi.fn(),
    add: vi.fn((_key: string) => {
      const inst: FakeSoundInstance = {
        play: vi.fn().mockImplementation(function (this: FakeSoundInstance) { this.isPlaying = true; this.isPaused = false; }),
        stop: vi.fn().mockImplementation(function (this: FakeSoundInstance) { this.isPlaying = false; this.isPaused = false; }),
        destroy: vi.fn(),
        setVolume: vi.fn(),
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

// ── Fake tween helpers ────────────────────────────────────────────────────────

interface FakeTweenConfig {
  from: number;
  to: number;
  duration?: number;
  onUpdate?: (tw: FakeTween) => void;
  onComplete?: () => void;
}

interface FakeTween {
  stop: ReturnType<typeof vi.fn>;
  getValue: () => number;
  _currentValue: number;
  _stopped: boolean;
  /**
   * Simulate the tween completing: advances to `to`, fires `onUpdate` then
   * `onComplete`. No-op if `stop()` has already been called.
   */
  _complete: () => void;
}

interface FakeTweenManager {
  addCounter: ReturnType<typeof vi.fn>;
  _tweens: FakeTween[];
}

function makeFakeTweenManager(): FakeTweenManager {
  const tweens: FakeTween[] = [];
  return {
    _tweens: tweens,
    addCounter: vi.fn((config: FakeTweenConfig) => {
      const tw: FakeTween = {
        stop: vi.fn(),
        _stopped: false,
        _currentValue: config.from,
        getValue() { return this._currentValue; },
        _complete() {
          if (this._stopped) return;
          this._currentValue = config.to;
          config.onUpdate?.(this);
          config.onComplete?.();
        },
      };
      tw.stop.mockImplementation(() => { tw._stopped = true; });
      tweens.push(tw);
      return tw;
    }),
  };
}

interface FakeGame {
  scene: {
    getScenes: ReturnType<typeof vi.fn>;
  };
}

function makeFakeGame(): { game: FakeGame; tweens: FakeTweenManager } {
  const tweens = makeFakeTweenManager();
  return {
    tweens,
    game: {
      scene: {
        getScenes: vi.fn((_active?: boolean) => [{ tweens }]),
      },
    },
  };
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
        expect(fakeSound.play).toHaveBeenCalledWith(SFX_EVENTS[ev], expect.objectContaining({ volume: expect.any(Number) }));
      }
    });

    it('routes a specific sfx event to the correct audio key', () => {
      eventBus.emit('sfx:jump');
      expect(fakeSound.play).toHaveBeenCalledWith('jump', expect.objectContaining({ volume: expect.any(Number) }));
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
      const inst = fakeSound._instances[0]!;
      inst.isPlaying = true;
      eventBus.emit('music:pause');
      expect(inst.pause).toHaveBeenCalledTimes(1);
    });

    it('music:pause is a no-op when no track is playing', () => {
      expect(() => eventBus.emit('music:pause')).not.toThrow();
    });

    it('music:pause is a no-op when track is already paused', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0]!;
      inst.isPlaying = false; // not playing (e.g. already paused)
      eventBus.emit('music:pause');
      expect(inst.pause).not.toHaveBeenCalled();
    });

    it('music:resume calls resume() on a paused track', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0]!;
      inst.isPaused = true;
      eventBus.emit('music:resume');
      expect(inst.resume).toHaveBeenCalledTimes(1);
    });

    it('music:resume is a no-op when no track exists', () => {
      expect(() => eventBus.emit('music:resume')).not.toThrow();
    });

    it('music:resume is a no-op when track is not paused', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0]!;
      inst.isPaused = false;
      eventBus.emit('music:resume');
      expect(inst.resume).not.toHaveBeenCalled();
    });

    it('pause then resume round-trip leaves track playing', () => {
      eventBus.emit('music:play', 'track_a');
      const inst = fakeSound._instances[0]!;
      inst.isPlaying = true;
      eventBus.emit('music:pause');
      // After pause, isPlaying is false and isPaused is true (set by mock).
      eventBus.emit('music:resume');
      expect(inst.pause).toHaveBeenCalledTimes(1);
      expect(inst.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe('Crossfade', () => {
    /** Explicit fade duration used in crossfade tests (matches MUSIC_FADE_MS default). */
    const TEST_FADE_MS = 300;

    it('destroy() is NOT called before fade-out completes when fadeDurationMs > 0', () => {
      const { game, tweens } = makeFakeGame();
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        game as unknown as Phaser.Game,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      // Complete fade-in so track_a has non-zero volume, which triggers a real
      // fade-out (not an instant kill) when the next track is requested.
      tweens._tweens[0]!._complete();
      const first = sound._instances[0]!;

      eventBus.emit('music:play', 'track_b');
      // Still alive — destroy waits for the fade-out to complete.
      expect(first.destroy).not.toHaveBeenCalled();
      expect(first.stop).not.toHaveBeenCalled();

      // Simulate the fade-out completing.
      tweens._tweens[1]!._complete();
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(first.destroy).toHaveBeenCalledTimes(1);
    });

    it('track stopped before fade-in advances is destroyed immediately (vol=0 short-circuit)', () => {
      const { game } = makeFakeGame();
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        game as unknown as Phaser.Game,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      const inst = sound._instances[0]!;
      // track_a is at vol=0 (fade-in started but no tick yet)
      eventBus.emit('music:stop');
      // No audible fade needed — instant kill.
      expect(inst.stop).toHaveBeenCalledTimes(1);
      expect(inst.destroy).toHaveBeenCalledTimes(1);
    });

    it('incoming track starts at volume 0 and reaches target volume after fade', () => {
      const { game, tweens } = makeFakeGame();
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        game as unknown as Phaser.Game,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      const inst = sound._instances[0]!;

      // Track was added with volume 0 (fade-in start).
      const addCall = sound.add.mock.calls[0] as [string, { volume: number }];
      expect(addCall[1].volume).toBe(0);

      // After the full fade the volume should be at the effective target level.
      const expectedVol = 0.35 * (70 / 100); // MUSIC_VOLUME * default musicVolume
      tweens._tweens[0]!._complete();
      const calls = inst.setVolume.mock.calls;
      const lastSetVolumeArg: number = (calls[calls.length - 1] as [number])[0];
      expect(lastSetVolumeArg).toBeCloseTo(expectedVol, 2);
    });

    it('without a game/tween manager, track plays at full volume immediately (no silent-forever bug)', () => {
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      // No game passed — instant-cut mode even though fadeDurationMs > 0.
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        undefined,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      const addCall = sound.add.mock.calls[0] as [string, { volume: number }];
      const expectedVol = 0.35 * (70 / 100); // MUSIC_VOLUME * default musicVolume
      // Without tweens, startVol must equal targetVol — not 0.
      expect(addCall[1].volume).toBeCloseTo(expectedVol, 2);
    });

    it('rapid track change cancels previous fade-out and destroys old track immediately', () => {
      const { game, tweens } = makeFakeGame();
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        game as unknown as Phaser.Game,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      // Complete fade-in so track_a has non-zero volume before we switch.
      tweens._tweens[0]!._complete();
      const first = sound._instances[0]!;

      eventBus.emit('music:play', 'track_b');
      // track_a is fading out — not yet destroyed.
      expect(first.destroy).not.toHaveBeenCalled();

      // Switch again — mid-fade.
      eventBus.emit('music:play', 'track_c');
      // cancelFadeOut fires: fade-out tween stopped, then dyingMusic.stop() + destroy()

      // track_a should have been destroyed immediately on the second switch.
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(first.destroy).toHaveBeenCalledTimes(1);
    });

    it('mute toggle during fade-in snaps music to correct muted state instantly', () => {
      const { game, tweens } = makeFakeGame();
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        game as unknown as Phaser.Game,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      // Tween is in-flight (fake tweens don't auto-advance).

      // Toggle mute — applyVolumeSettings cancels the fade-in immediately.
      eventBus.emit('audio:toggle-mute');

      // The sound manager should be muted.
      expect(mgr.isMuted()).toBe(true);
      // The fade-in tween should have been stopped.
      expect(tweens._tweens[0]!.stop).toHaveBeenCalledTimes(1);
    });

    it('starting a second playMusic mid-fade-in cancels the first fade-in tween', () => {
      const { game, tweens } = makeFakeGame();
      const sound = makeFakeSoundManager();
      eventBus.removeAllListeners();
      const mgr = new AudioManager(
        sound as unknown as Phaser.Sound.BaseSoundManager,
        game as unknown as Phaser.Game,
        TEST_FADE_MS,
      );
      mgr.registerEventListeners();

      eventBus.emit('music:play', 'track_a');
      const firstFadeIn = tweens._tweens[0]!;
      expect(firstFadeIn.stop).not.toHaveBeenCalled();

      // Start a second track before the first fade-in completes.
      eventBus.emit('music:play', 'track_b');
      // cancelFadeIn() inside stopMusic() must have stopped the first fade-in.
      expect(firstFadeIn.stop).toHaveBeenCalledTimes(1);
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

    it('persists mute state to settings store on toggle', () => {
      eventBus.emit('audio:toggle-mute');
      const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as { muteAll?: boolean };
      expect(saved.muteAll).toBe(true);
      eventBus.emit('audio:toggle-mute');
      const saved2 = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as { muteAll?: boolean };
      expect(saved2.muteAll).toBe(false);
    });

    it('emits audio:mute-changed with new state when toggled', () => {
      const listener = vi.fn();
      eventBus.on('audio:mute-changed', listener);
      eventBus.emit('audio:toggle-mute');
      expect(listener).toHaveBeenCalledWith(true);
      eventBus.emit('audio:toggle-mute');
      expect(listener).toHaveBeenLastCalledWith(false);
    });

    it('does NOT emit audio:mute-changed when only volume (not mute) changes', () => {
      const muteListener = vi.fn();
      eventBus.on('audio:mute-changed', muteListener);
      // Volume change should not trigger audio:mute-changed
      settingsStore.setMasterVolume(50);
      settingsStore.setMusicVolume(60);
      settingsStore.setSfxVolume(40);
      expect(muteListener).not.toHaveBeenCalled();
    });

    it('restores persisted mute preference from settings store on construction', () => {
      settingsStore.setMuteAll(true);
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(true);
      expect(sound.mute).toBe(true);
    });

    it('does not mute on construction if persisted muteAll is false', () => {
      settingsStore.setMuteAll(false);
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(false);
    });

    it('picks up muteAll=true from settings store on construction', () => {
      // Simulate what migration would have done: settingsStore has muteAll=true
      settingsStore.setMuteAll(true);
      settingsStore._store.setStorage(globalThis.localStorage);
      const sound = makeFakeSoundManager();
      const m = new AudioManager(sound as unknown as Phaser.Sound.BaseSoundManager);
      expect(m.isMuted()).toBe(true);
      expect(sound.mute).toBe(true);
      // Cleanup
      settingsStore.setMuteAll(false);
    });
  });
});
