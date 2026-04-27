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

export class AudioManager {
  private sound: Phaser.Sound.BaseSoundManager;
  /**
   * Phaser game reference — used to lazily resolve the active scene's tween
   * manager at fade time so fades always run on a live scene regardless of
   * which scene created the AudioManager.
   */
  private game: Phaser.Game | null;
  /** Crossfade duration used for this instance (0 = instant, no tweens). */
  private readonly fadeDurationMs: number;

  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  /** Stack of music keys suspended by `music:push`, popped back on `music:pop`. */
  private musicStack: string[] = [];

  /**
   * Actual current volume of `currentMusic` — updated on every tween tick
   * during a fade so that `stopMusic()` always fades out from the real level.
   */
  private currentMusicVolume = 0;

  /** Track fading out — kept alive until fade completes, then destroyed. */
  private dyingMusic: Phaser.Sound.BaseSound | null = null;
  /** Active tween driving the outgoing fade (null when not fading). */
  private fadeOutTween: Phaser.Tweens.Tween | null = null;
  /** Active tween driving the incoming fade (null when not fading). */
  private fadeInTween: Phaser.Tweens.Tween | null = null;

  /** Independent looping ambience slot — layered under music. */
  private currentAmbience: Phaser.Sound.BaseSound | null = null;
  private currentAmbienceKey: string | null = null;

  /**
   * @param sound           Phaser sound manager.
   * @param game            The Phaser game instance.  `AudioManager` resolves
   *                        the tween manager from the first active scene at the
   *                        time each fade starts, so fades remain live even
   *                        after the constructing scene has shut down.
   *                        Omit (or pass `undefined`) to disable tween-driven
   *                        fades; tracks will start/stop at full volume
   *                        regardless of `fadeDurationMs`.
   * @param fadeDurationMs  Override the crossfade duration.  Pass `0` for
   *                        instant cuts (used in tests).  Defaults to
   *                        `MUSIC_FADE_MS` in production and `0` in the Vitest
   *                        environment so existing specs need no changes.
   */
  constructor(sound: Phaser.Sound.BaseSoundManager, game?: Phaser.Game, fadeDurationMs?: number) {
    this.sound = sound;
    this.game = game ?? null;
    this.fadeDurationMs =
      fadeDurationMs ?? (import.meta.env.MODE === 'test' ? 0 : MUSIC_FADE_MS);
    this.applyVolumeSettings();
  }

  /**
   * Resolve the tween manager of the first currently-active Phaser scene.
   * Called at the start of each fade so the tween always runs on a live scene.
   * Returns null when no game reference was provided or no scene is active.
   */
  private getActiveTweens(): Phaser.Tweens.TweenManager | null {
    if (!this.game) return null;
    const scenes = this.game.scene.getScenes(true);
    return scenes[0]?.tweens ?? null;
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
    // Resolve tweens before deciding startVol: if no active tween manager is
    // available the track must start at full volume so it is never silent.
    const tweens = this.fadeDurationMs > 0 ? this.getActiveTweens() : null;
    const startVol = tweens ? 0 : targetVol;
    this.currentMusicVolume = startVol;
    this.currentMusic = this.sound.add(key, { loop: true, volume: startVol });
    this.currentMusic.play();
    this.currentMusicKey = key;

    if (!tweens) return;

    const music = this.currentMusic;
    this.fadeInTween = tweens.addCounter({
      from: 0,
      to: targetVol,
      duration: this.fadeDurationMs,
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const v = tw.getValue() ?? 0;
        this.currentMusicVolume = v;
        (music as SoundWithVolume).setVolume(v);
      },
      onComplete: () => {
        this.currentMusicVolume = targetVol;
        (music as SoundWithVolume).setVolume(targetVol);
        this.fadeInTween = null;
      },
    });
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

    // Skip the fade-out when the track is already silent (e.g. stopped before
    // the first fade-in tick) or when no tween manager is available — just
    // stop and destroy immediately to avoid a no-op tween.
    const tweens = this.fadeDurationMs > 0 && startVol > 0 ? this.getActiveTweens() : null;
    if (!tweens) {
      dying.stop();
      dying.destroy();
      return;
    }

    this.dyingMusic = dying;
    this.fadeOutTween = tweens.addCounter({
      from: startVol,
      to: 0,
      duration: this.fadeDurationMs,
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        (dying as SoundWithVolume).setVolume(tw.getValue() ?? 0);
      },
      onComplete: () => {
        dying.stop();
        dying.destroy();
        this.dyingMusic = null;
        this.fadeOutTween = null;
      },
    });
  }

  /** Cancel any in-flight fade-out and immediately destroy the dying track. */
  private cancelFadeOut(): void {
    this.fadeOutTween?.stop();
    this.fadeOutTween = null;
    if (this.dyingMusic) {
      this.dyingMusic.stop();
      this.dyingMusic.destroy();
      this.dyingMusic = null;
    }
  }

  /** Cancel any in-flight fade-in (leaves the track playing at its current volume). */
  private cancelFadeIn(): void {
    this.fadeInTween?.stop();
    this.fadeInTween = null;
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

