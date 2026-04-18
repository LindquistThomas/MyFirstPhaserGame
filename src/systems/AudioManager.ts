import * as Phaser from 'phaser';
import { eventBus } from './EventBus';
import { SFX_EVENTS, MUSIC_VOLUME } from '../config/audioConfig';

/**
 * Thin wrapper around Phaser's sound manager.
 *
 * Purely reactive — subscribes to EventBus events and plays audio in
 * response. No other module should call its methods directly; all audio
 * is triggered through the EventBus.
 */
const MUTE_STORAGE_KEY = 'architect_audio_muted_v1';

export class AudioManager {
  private sound: Phaser.Sound.BaseSoundManager;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  /** Stack of music keys suspended by `music:push`, popped back on `music:pop`. */
  private musicStack: string[] = [];

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
    // Restore persisted mute preference.
    try {
      if (localStorage.getItem(MUTE_STORAGE_KEY) === '1') {
        this.sound.mute = true;
      }
    } catch { /* localStorage unavailable — ignore */ }
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

  /** Stop the current music track. */
  private stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  toggleMute(): void {
    this.sound.mute = !this.sound.mute;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, this.sound.mute ? '1' : '0');
    } catch { /* localStorage unavailable — ignore */ }
    eventBus.emit('audio:mute-changed', this.sound.mute);
  }

  isMuted(): boolean {
    return this.sound.mute;
  }
}
