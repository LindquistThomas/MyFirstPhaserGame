import * as Phaser from 'phaser';
import { GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';

/**
 * A touch / pointer-friendly "CALL ELEVATOR" button shown on every floor
 * scene.  Pressing it triggers the callback (typically `returnToElevator()`).
 *
 * Positioned bottom-left so it doesn't clash with the ▲/▼ room-lift buttons
 * (bottom-right) or the HUD (top).  Scroll-factor 0 so it stays fixed on
 * screen regardless of camera position.
 */
export class CallElevatorButton {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;

  private static readonly BTN_W = 130;
  private static readonly BTN_H = 44;
  private static readonly MARGIN = 16;

  constructor(scene: Phaser.Scene, onCall: () => void) {
    const { BTN_W, BTN_H, MARGIN } = CallElevatorButton;
    const x = MARGIN;
    const y = GAME_HEIGHT - MARGIN - BTN_H;

    this.container = scene.add.container(x, y);
    this.container.setDepth(60);
    this.container.setScrollFactor(0);

    // Background — drawn once, redrawn on press/release.
    this.bg = scene.add.graphics();
    this.drawBg(false);
    this.container.add(this.bg);

    // Label.
    const label = scene.add.text(BTN_W / 2, BTN_H / 2, '▲  CALL LIFT', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: theme.color.css.textWhite,
    }).setOrigin(0.5);
    this.container.add(label);

    // Invisible hit-zone.
    const hit = scene.add
      .rectangle(BTN_W / 2, BTN_H / 2, BTN_W, BTN_H)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);
    this.container.add(hit);

    hit.on('pointerdown', () => this.drawBg(true));
    hit.on('pointerup', () => {
      this.drawBg(false);
      onCall();
    });
    hit.on('pointerout', () => this.drawBg(false));
    hit.on('pointerupoutside', () => this.drawBg(false));

    this.container.setSize(BTN_W, BTN_H);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  private drawBg(pressed: boolean): void {
    const { BTN_W, BTN_H } = CallElevatorButton;
    this.bg.clear();
    this.bg.fillStyle(
      pressed ? theme.color.ui.accent : theme.color.ui.accentAlt,
      pressed ? 0.95 : 0.75,
    );
    this.bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 6);
    // Thin border so the button reads on any floor-tinted background.
    this.bg.lineStyle(1, theme.color.ui.border, 0.6);
    this.bg.strokeRoundedRect(0, 0, BTN_W, BTN_H, 6);
  }
}
