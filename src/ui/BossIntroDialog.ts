import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { promptLabel } from '../input';

/**
 * First-visit intro card shown at the start of the CEO boss fight.
 *
 * Explains the arena mechanics (mug throwing, phases, challenge prompts)
 * before any action begins. Dismissed on Confirm (Enter) or Cancel (Esc).
 * Shown only once per save — the caller is responsible for the first-visit
 * check via `ProgressionSystem.hasVisitedFloor`.
 */
export class BossIntroDialog extends ModalBase {
  private readonly onComplete: () => void;
  private confirmHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, onComplete: () => void) {
    super(scene);
    this.onComplete = onComplete;
    this.buildPanel();
    this.fadeIn();
  }

  protected override onBeforeClose(): void {
    if (this.confirmHandler) {
      this.scene.inputs.off('Confirm', this.confirmHandler);
      this.confirmHandler = null;
    }
  }

  protected override onAfterClose(): void {
    this.onComplete();
  }

  private buildPanel(): void {
    const panelW = 560;
    const panelH = 340;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const PAD = 32;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0505, 0.97);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    bg.lineStyle(2, 0xffd700, 0.9);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    this.container.add(bg);

    // Accent bar (red — danger)
    const accentBar = this.scene.add.graphics();
    accentBar.fillStyle(0xff2222, 1);
    accentBar.fillRect(panelX + 10, panelY, panelW - 20, 4);
    this.container.add(accentBar);

    // Heading
    const heading = this.scene.add.text(
      GAME_WIDTH / 2, panelY + PAD,
      'FACE THE CEO',
      { fontFamily: 'monospace', fontSize: '28px', color: '#ffd700', fontStyle: 'bold' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(heading);

    // Lore line
    const lore = this.scene.add.text(
      GAME_WIDTH / 2, panelY + PAD + 44,
      'Negotiate the merger\u2026 by any means necessary.',
      { fontFamily: 'monospace', fontSize: '14px', color: theme.color.css.textSecondary },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(lore);

    // Controls list
    const attackLabel = promptLabel('Attack');
    const jumpLabel = promptLabel('Jump');
    const moveLeftLabel = promptLabel('MoveLeft');
    const moveRightLabel = promptLabel('MoveRight');
    const moveLabel = moveLeftLabel === moveRightLabel ? moveLeftLabel : `${moveLeftLabel}/${moveRightLabel}`;
    const challengeLabel = '1/2/3 or click';

    const controlLines = [
      `  ${moveLabel.padEnd(12)}Move`,
      `  ${jumpLabel.padEnd(12)}Jump \u2014 dodge the CEO\u2019s briefcases`,
      `  ${attackLabel.padEnd(12)}Throw held mug`,
      `  ${challengeLabel.padEnd(12)}Answer architecture challenges`,
    ];

    const controls = this.scene.add.text(
      panelX + PAD, panelY + PAD + 88,
      controlLines.join('\n'),
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ccddff',
        lineSpacing: 8,
      },
    ).setScrollFactor(0);
    this.container.add(controls);

    // Continue button
    const btnY = panelY + panelH - 56;
    const btn = this.scene.add.text(
      GAME_WIDTH / 2, btnY,
      '[ Fight!  (Enter) ]',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#2a0505',
        padding: { x: 20, y: 10 },
      },
    ).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#ffd700'));
    btn.on('pointerout',  () => btn.setColor('#ffffff'));
    btn.on('pointerdown', () => this.close());
    this.container.add(btn);

    // Confirm keyboard shortcut (Enter)
    this.confirmHandler = () => this.close();
    this.scene.inputs.on('Confirm', this.confirmHandler);

    // Skip hint
    const skip = this.scene.add.text(
      GAME_WIDTH / 2, btnY + 38,
      'Esc to skip',
      { fontFamily: 'monospace', fontSize: '12px', color: '#556677' },
    ).setOrigin(0.5).setScrollFactor(0);
    this.container.add(skip);
  }
}
