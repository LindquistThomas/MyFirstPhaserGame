import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/gameConfig';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(centerX, centerY - 160, 'ARCHITECTURE', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: COLORS.titleText,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 100, 'ELEVATOR', {
      fontFamily: 'monospace',
      fontSize: '56px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(centerX, centerY - 50, 'Rise through the ranks of IT architecture', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#8899aa',
    }).setOrigin(0.5);

    // Animated elevator icon (simple visual)
    const elevIcon = this.add.graphics();
    elevIcon.fillStyle(0x0f3460);
    elevIcon.fillRect(centerX - 20, centerY + 10, 40, 8);
    this.tweens.add({
      targets: elevIcon,
      y: -30,
      duration: 2000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Start button
    const startBtn = this.add.text(centerX, centerY + 80, '[ START GAME ]', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: COLORS.titleText,
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Button hover effects
    startBtn.on('pointerover', () => {
      startBtn.setColor('#ffffff');
      startBtn.setScale(1.1);
    });
    startBtn.on('pointerout', () => {
      startBtn.setColor(COLORS.titleText);
      startBtn.setScale(1.0);
    });
    startBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start('HubScene');
      });
    });

    // Pulsing start text
    this.tweens.add({
      targets: startBtn,
      alpha: 0.6,
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Controls info
    this.add.text(centerX, GAME_HEIGHT - 80, 'WASD / Arrow Keys: Move  |  Space: Jump  |  E: Interact', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#556677',
    }).setOrigin(0.5);

    this.add.text(centerX, GAME_HEIGHT - 50, 'Inspired by Impossible Mission (C64)', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#334455',
    }).setOrigin(0.5);

    // Keyboard start
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start('HubScene');
      });
    });

    // Fade in
    this.cameras.main.fadeIn(800, 0, 0, 0);
  }
}
