import * as Phaser from 'phaser';
import { eventBus } from './EventBus';
import { SFX_EVENTS, MUSIC_VOLUME, AMBIENCE_VOLUME } from '../config/audioConfig';
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
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  /** Stack of music keys suspended by `music:push`, popped back on `music:pop`. */
  private musicStack: string[] = [];

  /** Independent looping ambience slot — layered under music. */
  private currentAmbience: Phaser.Sound.BaseSound | null = null;
  private currentAmbienceKey: string | null = null;

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
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
    const vol = this.effectiveMusicVolume();
    this.currentMusic = this.sound.add(key, { loop: true, volume: vol });
    this.currentMusic.play();
    this.currentMusicKey = key;
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

  /** Stop the current music track. */
  private stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
      this.currentMusicKey = null;
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
   */
  private applyVolumeSettings(): void {
    const s = settingsStore.read();
    const prevMute = this.sound.mute;

    this.sound.mute = s.muteAll;
    this.sound.volume = s.masterVolume / 100;

    if (this.currentMusic) {
      (this.currentMusic as SoundWithVolume).setVolume(this.effectiveMusicVolume());
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

