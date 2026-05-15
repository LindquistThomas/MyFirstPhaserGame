import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { isTouchPrimary } from './touchPrimary';
import { promptLabel } from '../input';

/** Virtual-pad label for each control row shown on touch-primary devices. */
const TOUCH_CONTROLS = [
  '  MOVE       Stick',
  '  JUMP       A button',
  '  INFO PANEL B button',
  '  INTERACT   B button',
  '  PAUSE      Menu button',
] as const;

/**
 * Welcome / How-to-Play card.
 *
 * - `source: 'first-run'` (default): shown when a brand-new save reaches the
 *   elevator lobby for the first time. Closing it calls `onComplete` so the
 *   caller can mark `onboardingComplete`.
 * - `source: 'help'`: opened on demand from Settings. Shows the same content
 *   with the title "How to Play". Does **not** call `onComplete` on close so
 *   the first-run seen flag is never altered.
 */
export class WelcomeModal extends ModalBase {
  private readonly onComplete: () => void;
  private readonly source: 'first-run' | 'help';
  private confirmHandler: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    onComplete: () => void = () => { /* no-op */ },
    source: 'first-run' | 'help' = 'first-run',
  ) {
    super(scene, {
      title: source === 'help' ? 'How to Play' : 'Welcome, Architect!',
      description: 'Introductory gameplay instructions and controls.',
    });
    this.onComplete = onComplete;
    this.source = source;
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

    // Title — differs between first-run onboarding and on-demand help.
    const title = this.scene.add.text(
      GAME_WIDTH / 2, panelY + PADDING,
      this.source === 'help' ? 'How to Play' : 'Welcome, Architect!',
      { fontFamily: 'monospace', fontSize: '30px', color: '#ffffff', fontStyle: 'bold' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(title);

    // Body text — controls block uses keyboard labels from DEFAULT_BINDINGS
    // (auto-updated if defaults change) or virtual-pad labels on touch devices.
    const controlsRows = isTouchPrimary()
      ? [...TOUCH_CONTROLS]
      : [
          `  MOVE       ${promptLabel('MoveLeft')} / ${promptLabel('MoveRight')}`,
          `  JUMP       ${promptLabel('Jump')}`,
          `  INFO PANEL ${promptLabel('ToggleInfo')}`,
          `  INTERACT   ${promptLabel('Interact')}`,
          `  PAUSE      ${promptLabel('Pause')}`,
          '  MUTE       M',
        ];
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
      ...controlsRows,
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

    // Skip / close label
    const skip = this.scene.add.text(
      GAME_WIDTH / 2, btnY + 38,
      this.source === 'help' ? 'Esc to close' : 'Esc to skip',
      { fontFamily: 'monospace', fontSize: '12px', color: theme.color.css.textHint },
    ).setOrigin(0.5).setScrollFactor(0);
    this.container.add(skip);
  }
}
