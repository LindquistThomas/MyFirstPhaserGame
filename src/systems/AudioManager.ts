import * as Phaser from 'phaser';
import { eventBus } from './EventBus';
import { SFX_EVENTS, MUSIC_VOLUME, AMBIENCE_VOLUME } from '../config/audioConfig';
import { createPersistedStore } from './PersistedStore';

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
 *                intentionally quieter than music so it reads as texture.
 */
const MUTE_STORAGE_KEY = 'architect_audio_muted_v1';

// Mute preference is shared across AudioManager instances within the page.
// The store accepts the legacy `'1'` / `'0'` numeric encoding on read so
// existing players' preferences survive the migration; new writes use the
// JSON-boolean form (`'true'` / `'false'`).
const muteStore = createPersistedStore<boolean>({
  key: MUTE_STORAGE_KEY,
  defaultValue: () => false,
  parse: (raw) => raw === true || raw === 1 || raw === '1',
});

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
    if (muteStore.read()) this.sound.mute = true;
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

    const events = Object.keys(SFX_EVENTS) as Array<keyof typeof SFX_EVENTS>;
    for (const event of events) {
      const sfxKey = SFX_EVENTS[event];
      eventBus.on(event, () => this.playSfx(sfxKey));
    }
  }

  /** Play a one-shot sound effect. */
  private playSfx(key: string): void {
    this.sound.play(key);
  }

  /** Start looping background music. Skips if the same track is already playing. */
  private playMusic(key: string, volume: number = MUSIC_VOLUME): void {
    if (this.currentMusicKey === key && this.currentMusic) return;
    this.stopMusic();
    this.currentMusic = this.sound.add(key, { loop: true, volume });
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
   * AMBIENCE_VOLUME — kept low so the bed layers under the music.
   *
   * Independent of the music channel: `music:*` events do not affect it,
   * and it honours global mute via the underlying sound manager.
   */
  private playAmbience(key: string, volume: number = AMBIENCE_VOLUME): void {
    if (this.currentAmbienceKey === key && this.currentAmbience) return;
    this.stopAmbience();
    this.currentAmbience = this.sound.add(key, { loop: true, volume });
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

  toggleMute(): void {
    this.sound.mute = !this.sound.mute;
    muteStore.write(this.sound.mute);
    eventBus.emit('audio:mute-changed', this.sound.mute);
  }

  isMuted(): boolean {
    return this.sound.mute;
  }
}
