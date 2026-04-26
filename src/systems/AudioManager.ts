import * as Phaser from 'phaser';
import { eventBus } from './EventBus';
import { SFX_EVENTS, MUSIC_VOLUME, MUSIC_FADE_MS, AMBIENCE_VOLUME } from '../config/audioConfig';
import { settingsStore } from './SettingsStore';

/**
 * Thin wrapper around Phaser's sound manager.
 *
 * Purely reactive — subscribes to EventBus events and plays audio in
 * response. No other module should call its methods directly; all audio
 * is triggered through the EventBus.
 *
 * Exposes three independent channels:
 *   - SFX:       one-shot sounds via sound.play().
 *   - Music:     looping music with push/pop stack (scene background).
 *   - Ambience:  looping atmospheric bed that layers UNDER the music
 *                (e.g. datacenter hum on the Platform floor). Volume is
 *                intentionally quieter than music so it reads as background
 *                texture.
 *
 * Volume and mute state are read from SettingsStore on construction and
 * whenever `audio:volume-changed` is received.
 */

/** Helper type for concrete sound instances that expose a volume property. */
type SoundWithVolume = Phaser.Sound.BaseSound & { setVolume: (v: number) => void };

/** Number of discrete volume steps used for fade-in/out intervals. */
const FADE_STEPS = 20;

export class AudioManager {
  private sound: Phaser.Sound.BaseSoundManager;
  /** Crossfade duration used for this instance (0 = instant, no timers). */
  private readonly fadeDurationMs: number;

  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  /** Stack of music keys suspended by `music:push`, popped back on `music:pop`. */
  private musicStack: string[] = [];

  /**
   * Actual current volume of `currentMusic` — updated on every setVolume call
   * during a fade so that `stopMusic()` always fades out from the real level.
   */
  private currentMusicVolume = 0;

  /** Track fading out — kept alive until fade completes, then destroyed. */
  private dyingMusic: Phaser.Sound.BaseSound | null = null;
  /** setInterval handle for the outgoing fade. */
  private fadeOutTimer: ReturnType<typeof setInterval> | null = null;
  /** Incremented on every cancelFadeOut; callbacks compare against this to bail out. */
  private fadeOutEpoch = 0;
  /** setInterval handle for the incoming fade. */
  private fadeInTimer: ReturnType<typeof setInterval> | null = null;
  /** Incremented on every cancelFadeIn; callbacks compare against this to bail out. */
  private fadeInEpoch = 0;

  /** Independent looping ambience slot — layered under music. */
  private currentAmbience: Phaser.Sound.BaseSound | null = null;
  private currentAmbienceKey: string | null = null;

  /**
   * @param sound           Phaser sound manager.
   * @param fadeDurationMs  Override the crossfade duration.  Pass `0` for
   *                        instant cuts (used in tests).  Defaults to
   *                        `MUSIC_FADE_MS` in production and `0` in the Vitest
   *                        environment so existing specs need no changes.
   */
  constructor(sound: Phaser.Sound.BaseSoundManager, fadeDurationMs?: number) {
    this.sound = sound;
    this.fadeDurationMs =
      fadeDurationMs ?? (import.meta.env.MODE === 'test' ? 0 : MUSIC_FADE_MS);
    this.applyVolumeSettings();
  }

  /**
   * Subscribe to EventBus events defined in audioConfig.
   * Call once after construction (from BootScene).
   */
  registerEventListeners(): void {
    eventBus.on('music:play', (key) => this.playMusic(key));
    eventBus.on('music:stop', () => this.stopMusic());
    eventBus.on('music:push', (key) => this.pushMusic(key));
    eventBus.on('music:pop', () => this.popMusic());
    eventBus.on('music:pause', () => this.pauseMusic());
    eventBus.on('music:resume', () => this.resumeMusic());
    eventBus.on('ambience:play', (key) => this.playAmbience(key));
    eventBus.on('ambience:stop', () => this.stopAmbience());
    eventBus.on('audio:toggle-mute', () => this.toggleMute());
    eventBus.on('audio:volume-changed', () => this.applyVolumeSettings());

    const events = Object.keys(SFX_EVENTS) as Array<keyof typeof SFX_EVENTS>;
    for (const event of events) {
      const sfxKey = SFX_EVENTS[event];
      eventBus.on(event, () => this.playSfx(sfxKey));
    }
  }

  /** Play a one-shot sound effect. */
  private playSfx(key: string): void {
    const s = settingsStore.read();
    // masterVolume is applied at the sound-manager level (sound.volume),
    // so per-sound volume only needs to scale by the SFX channel preference.
    const vol = this.scaleVolume(1, s.sfxVolume);
    this.sound.play(key, { volume: vol });
  }

  /** Start looping background music. Skips if the same track is already playing. */
  private playMusic(key: string): void {
    if (this.currentMusicKey === key && this.currentMusic) return;
    this.stopMusic();
    const targetVol = this.effectiveMusicVolume();
    const startVol = this.fadeDurationMs > 0 ? 0 : targetVol;
    this.currentMusicVolume = startVol;
    this.currentMusic = this.sound.add(key, { loop: true, volume: startVol });
    this.currentMusic.play();
    this.currentMusicKey = key;

    if (this.fadeDurationMs <= 0) return;

    const stepMs = this.fadeDurationMs / FADE_STEPS;
    let step = 0;
    const music = this.currentMusic;
    const epoch = ++this.fadeInEpoch;
    // Capture the timer handle locally so callbacks never touch a stale this.fadeInTimer.
    const timerId: ReturnType<typeof setInterval> = setInterval(() => {
      if (this.fadeInEpoch !== epoch) return; // cancelled — do not mutate volume
      step++;
      const vol = targetVol * (step / FADE_STEPS);
      this.currentMusicVolume = vol;
      (music as SoundWithVolume).setVolume(vol);
      if (step >= FADE_STEPS) {
        clearInterval(timerId);
        this.fadeInTimer = null;
        this.currentMusicVolume = targetVol;
        (music as SoundWithVolume).setVolume(targetVol);
      }
    }, stepMs);
    this.fadeInTimer = timerId;
  }

  /** Suspend the current track and start a new one. Restore with popMusic. */
  private pushMusic(key: string): void {
    if (this.currentMusicKey === key) return;
    if (this.currentMusicKey) this.musicStack.push(this.currentMusicKey);
    this.playMusic(key);
  }

  /** Restore the track suspended by the most recent pushMusic. */
  private popMusic(): void {
    const prev = this.musicStack.pop();
    if (prev) {
      this.playMusic(prev);
    } else {
      this.stopMusic();
    }
  }

  /** Pause the current music track without stopping it. */
  private pauseMusic(): void {
    if (this.currentMusic && (this.currentMusic as { isPlaying?: boolean }).isPlaying) {
      (this.currentMusic as { pause(): void }).pause();
    }
  }

  /** Resume a music track that was paused. */
  private resumeMusic(): void {
    if (this.currentMusic && (this.currentMusic as { isPaused?: boolean }).isPaused) {
      (this.currentMusic as { resume(): void }).resume();
    }
  }

  /** Stop the current music track, fading it out over `fadeDurationMs`. */
  private stopMusic(): void {
    this.cancelFadeOut();
    this.cancelFadeIn();
    if (!this.currentMusic) return;

    const dying = this.currentMusic;
    // Fade from the actual current volume (may be mid-fade-in) rather than
    // the target level, so there is no audible jump on the first fade-out tick.
    const startVol = this.currentMusicVolume;
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.currentMusicVolume = 0;

    if (this.fadeDurationMs <= 0) {
      dying.stop();
      dying.destroy();
      return;
    }

    this.dyingMusic = dying;
    const stepMs = this.fadeDurationMs / FADE_STEPS;
    let step = 0;
    const epoch = ++this.fadeOutEpoch;
    // Capture the timer handle locally so callbacks never touch a stale this.fadeOutTimer.
    const timerId: ReturnType<typeof setInterval> = setInterval(() => {
      if (this.fadeOutEpoch !== epoch) return; // cancelled — do not act on destroyed track
      step++;
      const vol = Math.max(0, startVol * (1 - step / FADE_STEPS));
      (dying as SoundWithVolume).setVolume(vol);
      if (step >= FADE_STEPS) {
        clearInterval(timerId);
        this.fadeOutTimer = null;
        dying.stop();
        dying.destroy();
        this.dyingMusic = null;
      }
    }, stepMs);
    this.fadeOutTimer = timerId;
  }

  /** Cancel any in-flight fade-out and immediately destroy the dying track. */
  private cancelFadeOut(): void {
    this.fadeOutEpoch++; // invalidates any already-queued callback
    if (this.fadeOutTimer !== null) {
      clearInterval(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    if (this.dyingMusic) {
      this.dyingMusic.stop();
      this.dyingMusic.destroy();
      this.dyingMusic = null;
    }
  }

  /** Cancel any in-flight fade-in (leaves the track playing at its current volume). */
  private cancelFadeIn(): void {
    this.fadeInEpoch++; // invalidates any already-queued callback
    if (this.fadeInTimer !== null) {
      clearInterval(this.fadeInTimer);
      this.fadeInTimer = null;
    }
  }

  /**
   * Start looping an ambience bed. Skips the restart if the same key is
   * already looping, so repeated scene-start emits are cheap. Volume is
   * AMBIENCE_VOLUME scaled by settings — kept low so the bed layers under
   * the music.
   *
   * Independent of the music channel: `music:*` events do not affect it,
   * and it honours global mute via the underlying sound manager.
   */
  private playAmbience(key: string): void {
    if (this.currentAmbienceKey === key && this.currentAmbience) return;
    this.stopAmbience();
    const vol = this.effectiveAmbienceVolume();
    this.currentAmbience = this.sound.add(key, { loop: true, volume: vol });
    this.currentAmbience.play();
    this.currentAmbienceKey = key;
  }

  /** Stop the ambience bed. No-op if none is playing. */
  private stopAmbience(): void {
    if (this.currentAmbience) {
      this.currentAmbience.stop();
      this.currentAmbience.destroy();
      this.currentAmbience = null;
      this.currentAmbienceKey = null;
    }
  }

  /**
   * Apply the current SettingsStore values to the live sound manager and
   * any currently playing tracks. Called on construction and whenever
   * `audio:volume-changed` fires.
   *
   * Any in-flight fade-in is cancelled so the new target volume takes effect
   * immediately (mute must apply instantly per spec).
   */
  private applyVolumeSettings(): void {
    const s = settingsStore.read();
    const prevMute = this.sound.mute;

    this.sound.mute = s.muteAll;
    this.sound.volume = s.masterVolume / 100;

    // Cancel any in-flight fade-in so the correct volume is applied right away.
    this.cancelFadeIn();

    if (this.currentMusic) {
      const vol = this.effectiveMusicVolume();
      this.currentMusicVolume = vol;
      (this.currentMusic as SoundWithVolume).setVolume(vol);
    }
    if (this.currentAmbience) {
      (this.currentAmbience as SoundWithVolume).setVolume(this.effectiveAmbienceVolume());
    }

    // Only emit when mute state actually changed to avoid redundant UI updates.
    if (s.muteAll !== prevMute) {
      eventBus.emit('audio:mute-changed', s.muteAll);
    }
  }

  /**
   * Scale a base volume (0–1) by a user preference in the 0–100 range.
   * Returns a value in [0, 1].
   */
  private scaleVolume(base: number, pref: number): number {
    return base * (pref / 100);
  }

  /**
   * Effective music volume = authored level (MUSIC_VOLUME) × player's music
   * channel preference (0–1). Master volume is applied at the sound-manager
   * level so individual tracks don't need to account for it.
   */
  private effectiveMusicVolume(): number {
    const { musicVolume } = settingsStore.read();
    return this.scaleVolume(MUSIC_VOLUME, musicVolume);
  }

  /**
   * Effective ambience volume = authored level (AMBIENCE_VOLUME) × player's
   * music channel preference (same channel as music).
   */
  private effectiveAmbienceVolume(): number {
    const { musicVolume } = settingsStore.read();
    return this.scaleVolume(AMBIENCE_VOLUME, musicVolume);
  }

  toggleMute(): void {
    settingsStore.toggleMute();
    // applyVolumeSettings is called via the audio:volume-changed event emitted
    // by settingsStore.update(), so we only need to keep isMuted() consistent.
  }

  isMuted(): boolean {
    return this.sound.mute;
  }
}

