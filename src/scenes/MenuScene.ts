import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/gameConfig';
import { hasSave } from '../systems/SaveManager';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(cx, cy - 220, 'SO YOU WANT', {
      fontFamily: 'monospace', fontSize: '40px',
      color: COLORS.titleText, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 165, 'TO BE AN', {
      fontFamily: 'monospace', fontSize: '40px',
      color: COLORS.titleText, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 100, 'ARCHITECT', {
      fontFamily: 'monospace', fontSize: '64px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 70, 'Rise through the ranks of IT architecture', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8899aa',
    }).setOrigin(0.5);

    // Animated elevator icon
    const icon = this.add.graphics();
    icon.fillStyle(0x0f3460);
    icon.fillRect(cx - 30, cy + 10, 60, 10);
    this.tweens.add({ targets: icon, y: -40, duration: 2000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    // Start button
    const btn = this.add.text(cx, cy + 100, '[ START GAME ]', {
      fontFamily: 'monospace', fontSize: '28px', color: COLORS.titleText,
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#ffffff').setScale(1.1));
    btn.on('pointerout', () => btn.setColor(COLORS.titleText).setScale(1.0));
    btn.on('pointerdown', () => this.startGame());

    this.tweens.add({ targets: btn, alpha: 0.6, duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    if (hasSave()) {
      const contBtn = this.add.text(cx, cy + 160, '[ CONTINUE ]', {
        fontFamily: 'monospace', fontSize: '24px', color: COLORS.titleText,
        padding: { x: 24, y: 12 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      contBtn.on('pointerover', () => contBtn.setColor('#ffffff').setScale(1.1));
      contBtn.on('pointerout', () => contBtn.setColor(COLORS.titleText).setScale(1.0));
      contBtn.on('pointerdown', () => this.continueGame());

      this.tweens.add({ targets: contBtn, alpha: 0.6, duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      this.input.keyboard?.once('keydown-ENTER', () => this.continueGame());
    }

    // Controls
    this.add.text(cx, GAME_HEIGHT - 100, 'WASD / Arrows: Move  |  Space: Jump  |  E: Interact', {
      fontFamily: 'monospace', fontSize: '14px', color: '#556677',
    }).setOrigin(0.5);

    this.add.text(cx, GAME_HEIGHT - 65, 'Collect AU (Architecture Utility) to unlock new floors!', {
      fontFamily: 'monospace', fontSize: '13px', color: '#445566',
    }).setOrigin(0.5);

    this.add.text(cx, GAME_HEIGHT - 35, 'Inspired by Impossible Mission (C64)', {
      fontFamily: 'monospace', fontSize: '12px', color: '#334455',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
    this.cameras.main.fadeIn(800, 0, 0, 0);
  }

  private startGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start('HubScene', { loadSave: false }));
  }

  private continueGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start('HubScene', { loadSave: true }));
  }
}
