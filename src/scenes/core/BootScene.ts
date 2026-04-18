import * as Phaser from 'phaser';
import { generateSprites } from '../../systems/SpriteGenerator';
import { generateSounds } from '../../systems/SoundGenerator';
import { AudioManager } from '../../systems/AudioManager';
import { eventBus } from '../../systems/EventBus';
import { COLORS } from '../../config/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const progressBar = this.add.graphics();

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Initializing Systems...', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: COLORS.hudText,
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: COLORS.titleText,
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(`${Math.round(value * 100)}%`);
      progressBar.clear();
      progressBar.fillStyle(0x00d4ff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Generate procedural SFX and queue for Phaser's loader
    generateSounds(this);

    // Load background music from MP3 files (distinct per scene)
    this.load.audio('music_menu', 'music/8bit-chiptune/bgm_menu.mp3');
    this.load.audio('music_elevator_jazz', 'music/elevator-jazz/elevator_jazz.mp3');
    this.load.audio('music_elevator_ride', 'music/8bit-chiptune/bgm_action_3.mp3');
    this.load.audio('music_floor1', 'music/8bit-chiptune/bgm_action_1.mp3');
    this.load.audio('music_floor2', 'music/8bit-chiptune/bgm_action_2.mp3');
    this.load.audio('music_quiz', 'music/retro-synth/hostile_territory-loop1.ogg');
  }

  create(): void {
    // Generate all sprites programmatically
    generateSprites(this);

    // Initialize audio manager and wire it to the EventBus
    const audio = new AudioManager(this.sound);
    audio.registerEventListeners();
    this.registry.set('audio', audio);

    // Global M-key toggles music/audio mute from any scene or context.
    // Attached to window so it works regardless of which Phaser scene has
    // keyboard focus or what input context is active.
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      if (ev.key === 'm' || ev.key === 'M') {
        const target = ev.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
        eventBus.emit('audio:toggle-mute');
      }
    });

    this.scene.start('MenuScene');
  }
}
