import * as Phaser from 'phaser';
import { GAME_WIDTH, COLORS, FloorId } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { LEVEL_DATA } from '../config/levelData';
import { eventBus } from '../systems/EventBus';
import { createSceneLifecycle } from '../systems/sceneLifecycle';
import { theme } from '../style/theme';
import type { AudioManager } from '../systems/AudioManager';

const HUD_HEIGHT = 44;
const COIN_X = 26;
const COIN_Y = 22;
const PROGRESS_STRIP_WIDTH = 140;
const PROGRESS_STRIP_HEIGHT = 6;

export class HUD {
  private scene: Phaser.Scene;
  private progression: ProgressionSystem;
  private auText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private container!: Phaser.GameObjects.Container;
  private muteIcon!: Phaser.GameObjects.Graphics;
  private muteHit!: Phaser.GameObjects.Zone;
  private bg!: Phaser.GameObjects.Graphics;
  private coinIcon!: Phaser.GameObjects.Graphics;
  private progressStrip!: Phaser.GameObjects.Graphics;
  private lastAU = 0;
  private lastFloor: FloorId | -1 = -1;
  private lastProgressSig = '';
  private onMuteChanged = (muted: boolean): void => this.renderMuteIcon(muted);

  constructor(scene: Phaser.Scene, progression: ProgressionSystem) {
    this.scene = scene;
    this.progression = progression;
    this.create();
  }

  private create(): void {
    this.container = this.scene.add.container(0, 0).setDepth(50).setScrollFactor(0);

    this.bg = this.scene.add.graphics();
    this.container.add(this.bg);

    // AU icon (gold coin) — drawn centered at (0,0) so scale tweens pivot on center.
    this.coinIcon = this.scene.add.graphics();
    this.coinIcon.fillStyle(COLORS.token);
    this.coinIcon.fillCircle(0, 0, 12);
    this.coinIcon.fillStyle(theme.color.ui.hover);
    this.coinIcon.fillCircle(-1, -1, 8);
    this.coinIcon.setPosition(COIN_X, COIN_Y);
    this.container.add(this.coinIcon);

    // AU label + counter
    this.auText = this.scene.add.text(46, 6, 'AU: 0', {
      fontFamily: 'monospace', fontSize: '20px',
      color: COLORS.hudText, fontStyle: 'bold',
    });
    this.container.add(this.auText);

    // Unlock-progress strip below AU text
    this.progressStrip = this.scene.add.graphics();
    this.container.add(this.progressStrip);

    // Music mute toggle (far right)
    const muteX = GAME_WIDTH - 24;
    const muteY = 22;
    this.muteIcon = this.scene.add.graphics();
    this.muteIcon.setPosition(muteX, muteY);
    this.container.add(this.muteIcon);
    this.muteHit = this.scene.add.zone(muteX, muteY, 32, 32).setInteractive({ useHandCursor: true });
    this.muteHit.on('pointerup', () => eventBus.emit('audio:toggle-mute'));
    this.container.add(this.muteHit);
    this.renderMuteIcon(this.getAudio()?.isMuted() ?? false);
    createSceneLifecycle(this.scene).bindEventBus('audio:mute-changed', this.onMuteChanged);

    // Floor indicator — to the left of the mute icon
    this.floorText = this.scene.add.text(GAME_WIDTH - 48, 10, '', {
      fontFamily: 'monospace', fontSize: '16px', color: COLORS.titleText,
    }).setOrigin(1, 0);
    this.container.add(this.floorText);

    // Game title (center)
    this.container.add(
      this.scene.add.text(GAME_WIDTH / 2, 9, 'SO YOU WANT TO BE AN ARCHITECT', {
        fontFamily: 'monospace', fontSize: '18px', color: '#b8c8dc', fontStyle: 'bold',
      }).setOrigin(0.5, 0),
    );

    this.lastAU = this.progression.getTotalAU();
    this.redrawBackground();
    this.redrawProgressStrip();
  }

  /** Gradient HUD bar with theme-colored accent line. Repaints only when floor changes. */
  private redrawBackground(): void {
    const floor = this.progression.getCurrentFloor();
    const fd = LEVEL_DATA[floor];
    const accent = fd ? this.lighten(fd.theme.platformColor, 0.35) : theme.color.ui.accent;
    const top = 0x0a1428;
    const bottom = theme.color.bg.shaft;
    const alpha = 0.8;

    const g = this.bg;
    g.clear();
    // Phaser 3.60+: fillGradientStyle + fillRect produces a 4-corner gradient.
    g.fillGradientStyle(top, top, bottom, bottom, alpha);
    g.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    // Accent line (1px) — use the floor theme color so it shifts per floor.
    g.fillStyle(accent, 0.9);
    g.fillRect(0, HUD_HEIGHT - 1, GAME_WIDTH, 1);
  }

  /** Lighten a 0xRRGGBB int by `amount` (0..1) toward white. */
  private lighten(color: number, amount: number): number {
    const r = (color >> 16) & 0xff;
    const gC = (color >> 8) & 0xff;
    const b = color & 0xff;
    const lr = Math.min(255, Math.round(r + (255 - r) * amount));
    const lg = Math.min(255, Math.round(gC + (255 - gC) * amount));
    const lb = Math.min(255, Math.round(b + (255 - b) * amount));
    return (lr << 16) | (lg << 8) | lb;
  }

  /**
   * Find the first floor with `auRequired > 0` that the player has not yet reached.
   * Returns undefined if all unlock thresholds are met.
   */
  private findNextUnlockFloor(): typeof LEVEL_DATA[FloorId] | undefined {
    const au = this.progression.getTotalAU();
    return Object.values(LEVEL_DATA)
      .filter((f) => f.auRequired > 0 && au < f.auRequired)
      .sort((a, b) => a.auRequired - b.auRequired)[0];
  }

  private redrawProgressStrip(): void {
    const g = this.progressStrip;
    g.clear();
    const next = this.findNextUnlockFloor();
    if (!next) return;
    const au = this.progression.getTotalAU();
    const ratio = Phaser.Math.Clamp(au / next.auRequired, 0, 1);
    const x = 46;
    const y = 30;
    const floor = this.progression.getCurrentFloor();
    const fillColor = LEVEL_DATA[floor]?.theme.platformColor ?? theme.color.ui.accent;
    // Background track
    g.fillStyle(0x1a2a3a, 0.6);
    g.fillRect(x, y, PROGRESS_STRIP_WIDTH, PROGRESS_STRIP_HEIGHT);
    // Fill
    const fillW = Math.round(ratio * PROGRESS_STRIP_WIDTH);
    if (fillW > 0) {
      g.fillStyle(this.lighten(fillColor, 0.25), 0.95);
      g.fillRect(x, y, fillW, PROGRESS_STRIP_HEIGHT);
    }
  }

  /** Punch coin + float "+N" on AU gain. */
  private punchCoin(delta: number): void {
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

  private getAudio(): AudioManager | undefined {
    return this.scene.registry.get('audio') as AudioManager | undefined;
  }

  /** Draw a musical-note icon; struck-through when muted. */
  private renderMuteIcon(muted: boolean): void {
    const g = this.muteIcon;
    g.clear();
    const color = muted ? 0x808080 : theme.color.ui.accent;
    // Note stem
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.moveTo(4, -10);
    g.lineTo(4, 8);
    g.strokePath();
    // Flag
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.moveTo(4, -10);
    g.lineTo(12, -6);
    g.lineTo(12, 2);
    g.strokePath();
    // Note head
    g.fillStyle(color, 1);
    g.fillEllipse(0, 8, 10, 7);
    if (muted) {
      g.lineStyle(2.5, 0xff4444, 1);
      g.beginPath();
      g.moveTo(-12, -14);
      g.lineTo(14, 14);
      g.strokePath();
    }
  }

  update(): void {
    const au = this.progression.getTotalAU();
    this.auText.setText(`AU: ${au}`);

    const floor = this.progression.getCurrentFloor();
    const fd = LEVEL_DATA[floor];
    if (fd) this.floorText.setText(`F${fd.id}: ${fd.name}`);

    if (floor !== this.lastFloor) {
      this.lastFloor = floor;
      this.redrawBackground();
    }

    if (au > this.lastAU) {
      this.punchCoin(au - this.lastAU);
    }
    this.lastAU = au;

    const next = this.findNextUnlockFloor();
    const sig = next ? `${next.id}:${au}:${floor}` : `none:${floor}`;
    if (sig !== this.lastProgressSig) {
      this.lastProgressSig = sig;
      this.redrawProgressStrip();
    }
  }
}
