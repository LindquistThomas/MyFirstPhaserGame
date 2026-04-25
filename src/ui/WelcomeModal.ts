import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';

/**
 * First-time welcome card shown when a brand-new save reaches the elevator
 * lobby for the first time.
 *
 * Explains AU, the goal, and how to play. Skippable via Esc (Cancel) or the
 * "Continue" button (Confirm). Closing it marks `onboardingComplete` via the
 * supplied callback so it never appears again for this save.
 */
export class WelcomeModal extends ModalBase {
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
    const panelW = 660;
    const panelH = 460;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const PADDING = 36;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x08082a, 0.97);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    bg.lineStyle(2, theme.color.ui.border, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    this.container.add(bg);

    // Accent bar at top
    const accentBar = this.scene.add.graphics();
    accentBar.fillStyle(0x0099cc, 1);
    accentBar.fillRect(panelX + 12, panelY, panelW - 24, 4);
    this.container.add(accentBar);

    // Title
    const title = this.scene.add.text(
      GAME_WIDTH / 2, panelY + PADDING,
      'Welcome, Architect!',
      { fontFamily: 'monospace', fontSize: '30px', color: '#ffffff', fontStyle: 'bold' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(title);

    // Body text
    const bodyLines = [
      'You are an aspiring architect.',
      '',
      'Ride the elevator between floors, visit each team,',
      'talk to people, and learn their architectural challenges.',
      '',
      'Collecting AU (Architecture Units) proves your expertise.',
      'Reach 100 AU to graduate as a full architect!',
      '',
      'CONTROLS',
      '  ←  →     Walk',
      '  Space    Jump / Front-flip',
      '  ↑  /  I  Open info panels',
      '  Enter    Interact',
      '  Esc      Close dialogs',
    ];
    const bodyText = this.scene.add.text(
      panelX + PADDING, panelY + PADDING + 50,
      bodyLines.join('\n'),
      {
        fontFamily: 'monospace', fontSize: '15px',
        color: theme.color.css.textSecondary,
        lineSpacing: 4,
      },
    ).setScrollFactor(0);
    this.container.add(bodyText);

    // Continue button
    const btnY = panelY + panelH - 60;
    const btn = this.scene.add.text(
      GAME_WIDTH / 2, btnY,
      '[ Continue  (Enter) ]',
      {
        fontFamily: 'monospace', fontSize: '18px',
        color: '#ffffff', fontStyle: 'bold',
        backgroundColor: '#0e2a4a',
        padding: { x: 20, y: 10 },
      },
    ).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#55eeff'));
    btn.on('pointerout',  () => btn.setColor('#ffffff'));
    btn.on('pointerdown', () => this.close());
    this.container.add(btn);

    // "Confirm" keyboard shortcut (Enter) — stored so onBeforeClose() can
    // remove it regardless of whether the modal is closed by the button,
    // the Esc/Cancel binding in ModalBase, or by scene shutdown.
    this.confirmHandler = () => this.close();
    this.scene.inputs.on('Confirm', this.confirmHandler);

    // Skip label
    const skip = this.scene.add.text(
      GAME_WIDTH / 2, btnY + 38,
      'Esc to skip',
      { fontFamily: 'monospace', fontSize: '12px', color: '#556677' },
    ).setOrigin(0.5).setScrollFactor(0);
    this.container.add(skip);
  }
}
