import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../../config/gameConfig';
import { pushContext, popContext } from '../../../input';
import { createSceneLifecycle } from '../../../systems/sceneLifecycle';
import { theme } from '../../../style/theme';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0f172a);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'Floor 0', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: theme.color.css.textWhite,
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
      theme.color.ui.accentAlt,
      0.9,
    ).setStrokeStyle(2, 0xffffff, 0.9);

    this.add.text(GAME_WIDTH / 2, buttonY, 'Go back', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: theme.color.css.textWhite,
    }).setOrigin(0.5);

    const hit = this.add.rectangle(GAME_WIDTH / 2, buttonY, buttonW, buttonH, theme.color.bg.dark, 0.001)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => buttonBg.setFillStyle(0x44ccff, 0.95));
    hit.on('pointerout', () => buttonBg.setFillStyle(theme.color.ui.accentAlt, 0.9));
    hit.on('pointerdown', () => buttonBg.setFillStyle(0x0088cc, 0.95));
    hit.on('pointerup', () => {
      buttonBg.setFillStyle(0x44ccff, 0.95);
      this.scene.start('ElevatorScene');
    });

    const contextToken = pushContext('menu');
    const lifecycle = createSceneLifecycle(this);
    lifecycle.add(() => popContext(contextToken));

    const goBack = () => this.scene.start('ElevatorScene');
    lifecycle.bindInput('Cancel', goBack);
    lifecycle.bindInput('Confirm', goBack);
  }
}
