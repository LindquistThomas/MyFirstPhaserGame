import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

export class Floor0Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Floor0Scene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0f172a);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'Floor 0', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const buttonW = 240;
    const buttonH = 72;
    const buttonY = GAME_HEIGHT / 2 + 10;

    const buttonBg = this.add.rectangle(
      GAME_WIDTH / 2,
      buttonY,
      buttonW,
      buttonH,
      0x00aaff,
      0.9,
    ).setStrokeStyle(2, 0xffffff, 0.9);

    this.add.text(GAME_WIDTH / 2, buttonY, 'Go back', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(GAME_WIDTH / 2, buttonY, buttonW, buttonH, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => buttonBg.setFillStyle(0x44ccff, 0.95));
    hit.on('pointerout', () => buttonBg.setFillStyle(0x00aaff, 0.9));
    hit.on('pointerdown', () => buttonBg.setFillStyle(0x0088cc, 0.95));
    hit.on('pointerup', () => {
      buttonBg.setFillStyle(0x44ccff, 0.95);
      this.scene.start('HubScene');
    });

    const keyboard = this.input.keyboard;
    const goBack = () => this.scene.start('HubScene');

    keyboard?.on('keydown-ESC', goBack);
    keyboard?.on('keydown-ENTER', goBack);

    this.events.once('shutdown', () => {
      keyboard?.off('keydown-ESC', goBack);
      keyboard?.off('keydown-ENTER', goBack);
    });
  }
}
