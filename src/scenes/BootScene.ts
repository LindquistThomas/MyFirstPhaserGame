import * as Phaser from 'phaser';
import { generateSprites } from '../systems/SpriteGenerator';
import { generateSounds } from '../systems/SoundGenerator';
import { AudioManager } from '../systems/AudioManager';
import { COLORS } from '../config/gameConfig';

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

    // Background music loads from MP3 files in public/music/
    this.load.audio('music_retro_synth', 'music/retro-synth/retro_synth.mp3');
    this.load.audio('music_elevator_jazz', 'music/elevator-jazz/elevator_jazz.mp3');
  }

  create(): void {
    // Generate all sprites programmatically
    generateSprites(this);

    // Initialize audio manager and wire it to the EventBus
    const audio = new AudioManager(this.sound);
    audio.registerEventListeners();
    this.registry.set('audio', audio);

    this.scene.start('MenuScene');
  }
}
