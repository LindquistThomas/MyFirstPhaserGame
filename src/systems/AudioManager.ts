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
export class AudioManager {
  private sound: Phaser.Sound.BaseSoundManager;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
  }

  /**
   * Subscribe to EventBus events defined in audioConfig.
   * Call once after construction (from BootScene).
   */
  registerEventListeners(): void {
    eventBus.on('music:play', (key) => this.playMusic(key));
    eventBus.on('music:stop', () => this.stopMusic());

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
  }

  isMuted(): boolean {
    return this.sound.mute;
  }
}
