import type * as Phaser from 'phaser';
import { theme, getColorBlindPalette } from '../../style/theme';
import type { LayoutTokens } from '../../style/responsive';
import type { ProgressionSystem } from '../../systems/ProgressionSystem';
import { settingsStore } from '../../systems/SettingsStore';
import { lighten } from './colorUtils';

const COIN_X = 26;
const COIN_Y = 22;

/**
 * Owns the AU coin counter: gold coin graphic, shimmer animation,
 * AU text label, and the AU-pill background.
 *
 * Call {@link update} every frame to sync the text and punch the coin
 * whenever AU increases.
 */
export class CoinCounterController {
  readonly auText: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private readonly coinIcon: Phaser.GameObjects.Graphics;
  private readonly coinShine: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    _progression: ProgressionSystem,
    tokens: LayoutTokens,
  ) {
    this.scene = scene;

    // AU pill — static rounded background behind coin + text + progress strip.
    const auPill = scene.add.graphics();
    container.add(auPill as unknown as Phaser.GameObjects.GameObject);
    this.redrawAuPill(auPill);

    // AU icon (gold coin) — drawn centered at (0,0) so scale tweens pivot on center.
    this.coinIcon = scene.add.graphics();
    const coinPalette = getColorBlindPalette(settingsStore.read().colorBlindMode);
    this.coinIcon.fillStyle(coinPalette.token);
    this.coinIcon.fillCircle(0, 0, 12);
    this.coinIcon.fillStyle(theme.color.ui.hover);
    this.coinIcon.fillCircle(-1, -1, 8);
    this.coinIcon.setPosition(COIN_X, COIN_Y);
    container.add(this.coinIcon as unknown as Phaser.GameObjects.GameObject);

    // Shimmer band swept across the coin periodically.
    this.coinShine = scene.add.graphics();
    this.coinShine.fillStyle(0xffffff, 0.6);
    this.coinShine.fillRect(-1, -10, 2, 20);
    this.coinShine.setPosition(COIN_X - 14, COIN_Y).setAlpha(0);
    container.add(this.coinShine as unknown as Phaser.GameObjects.GameObject);
    this.scheduleCoinShimmer();

    // AU label + counter
    this.auText = scene.add.text(46, 6, 'AU: 0', {
      fontFamily: 'monospace', fontSize: tokens.hudFontAU,
      color: theme.color.css.textPrimary, fontStyle: 'bold',
    });
    container.add(this.auText as unknown as Phaser.GameObjects.GameObject);
  }

  private redrawAuPill(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    g.fillStyle(lighten(theme.color.ui.panel, 0.25), 0.55);
    g.fillRoundedRect(8, 4, 196, 36, 8);
    g.fillStyle(theme.color.ui.panel, 0.35);
    g.fillRoundedRect(9, 5, 194, 34, 7);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(10, 5, 192, 1);
  }

  private scheduleCoinShimmer(): void {
    const fire = (): void => {
      if (!(this.coinShine as unknown as { scene: unknown }).scene) return;
      this.coinShine.setX(COIN_X - 14).setAlpha(0.8);
      this.scene.tweens.add({
        targets: this.coinShine,
        x: COIN_X + 14,
        alpha: { from: 0.8, to: 0 },
        duration: 600,
        ease: 'Sine.easeInOut',
        onComplete: () => this.coinShine.setAlpha(0),
      });
    };
    this.scene.time.delayedCall(3000, fire);
    this.scene.time.addEvent({ delay: 6000, loop: true, callback: fire });
  }

  /** Punch coin + float "+N" on AU gain. */
  punchCoin(delta: number): void {
    this.scene.tweens.add({
      targets: this.coinIcon,
      scale: { from: 1, to: 1.25 },
      duration: 125,
      ease: 'Back.out',
      yoyo: true,
    });

    const float = this.scene.add.text(COIN_X, COIN_Y - 6, `+${delta}`, {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#ffed4a', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(51);

    this.scene.tweens.add({
      targets: float,
      y: COIN_Y - 26,
      alpha: { from: 1, to: 0 },
      duration: 500,
      ease: 'Sine.out',
      onComplete: () => float.destroy(),
    });
  }

  /** Redraw the coin icon to reflect the current color-blind palette. */
  refreshCoinColor(): void {
    const palette = getColorBlindPalette(settingsStore.read().colorBlindMode);
    this.coinIcon.clear();
    this.coinIcon.fillStyle(palette.token);
    this.coinIcon.fillCircle(0, 0, 12);
    this.coinIcon.fillStyle(theme.color.ui.hover);
    this.coinIcon.fillCircle(-1, -1, 8);
  }

  /** Update the AU text. Call every frame from HUD.update(). */
  update(currentAU: number, prevAU: number): void {
    this.auText.setText(`AU: ${currentAU}`);
    if (currentAU > prevAU) {
      this.punchCoin(currentAU - prevAU);
    }
  }

  /** Update font size when the viewport size class changes. */
  relayout(tokens: LayoutTokens): void {
    this.auText.setStyle({ fontSize: tokens.hudFontAU });
  }
}
