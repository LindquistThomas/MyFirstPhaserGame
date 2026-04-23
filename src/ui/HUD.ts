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
  private coinShine!: Phaser.GameObjects.Graphics;
  private progressStrip!: Phaser.GameObjects.Graphics;
  private lastAU = 0;
  private lastFloor: FloorId | -1 = -1;
  private lastProgressSig = '';
  /** Animated progress-strip ratio (tweened toward the target). */
  private progressRatio = 0;
  private progressTween?: Phaser.Tweens.Tween;
  private onMuteChanged = (muted: boolean): void => this.renderMuteIcon(muted);

  /** Caffeine buff indicator — mug + shrinking countdown arc. */
  private caffeineIcon!: Phaser.GameObjects.Graphics;
  private caffeineRing!: Phaser.GameObjects.Graphics;
  /** Scene time (ms) when the active buff ends. 0 when inactive. */
  private caffeineEndAt = 0;
  private caffeineDuration = 0;
  private onCaffeineStart = (durationMs: number): void => {
    this.caffeineDuration = durationMs;
    this.caffeineEndAt = this.scene.time.now + durationMs;
    this.renderCaffeineIcon(1);
  };
  private onCaffeineEnd = (): void => {
    this.caffeineEndAt = 0;
    this.caffeineDuration = 0;
    this.caffeineIcon.setVisible(false);
    this.caffeineRing.setVisible(false);
  };

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

    // Shimmer band swept across the coin periodically — small live-UI cue
    // so the HUD doesn't read as static when idling. Drawn as a separate
    // graphics so the tween can slide it without re-rendering the coin.
    this.coinShine = this.scene.add.graphics();
    this.coinShine.fillStyle(0xffffff, 0.6);
    this.coinShine.fillRect(-1, -10, 2, 20);
    this.coinShine.setPosition(COIN_X - 14, COIN_Y).setAlpha(0);
    this.container.add(this.coinShine);
    this.scheduleCoinShimmer();

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
    this.muteHit.on('pointerdown', () => this.punchMuteIcon());
    this.container.add(this.muteHit);
    this.renderMuteIcon(this.getAudio()?.isMuted() ?? false);

    // Caffeine buff indicator — mug + shrinking arc, sits between the
    // floor label and the mute icon. Hidden until the first buff start.
    const CAF_X = GAME_WIDTH - 76;
    const CAF_Y = 22;
    this.caffeineRing = this.scene.add.graphics().setPosition(CAF_X, CAF_Y).setVisible(false);
    this.container.add(this.caffeineRing);
    this.caffeineIcon = this.scene.add.graphics().setPosition(CAF_X, CAF_Y).setVisible(false);
    this.container.add(this.caffeineIcon);

    const lifecycle = createSceneLifecycle(this.scene);
    lifecycle.bindEventBus('audio:mute-changed', this.onMuteChanged);
    lifecycle.bindEventBus('buff:caffeine_start', this.onCaffeineStart);
    lifecycle.bindEventBus('buff:caffeine_end', this.onCaffeineEnd);

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
    const x = 46;
    const y = 30;
    const floor = this.progression.getCurrentFloor();
    const fillColor = LEVEL_DATA[floor]?.theme.platformColor ?? theme.color.ui.accent;
    // Background track
    g.fillStyle(0x1a2a3a, 0.6);
    g.fillRect(x, y, PROGRESS_STRIP_WIDTH, PROGRESS_STRIP_HEIGHT);
    // Fill — uses the tweened `progressRatio`, not the raw AU ratio, so
    // changes animate instead of snapping.
    const fillW = Math.round(this.progressRatio * PROGRESS_STRIP_WIDTH);
    if (fillW > 0) {
      g.fillStyle(this.lighten(fillColor, 0.25), 0.95);
      g.fillRect(x, y, fillW, PROGRESS_STRIP_HEIGHT);
    }
  }

  /** Tween `progressRatio` toward the current AU/required ratio, repainting each frame. */
  private tweenProgressTo(target: number): void {
    this.progressTween?.stop();
    this.progressTween = this.scene.tweens.add({
      targets: this,
      progressRatio: target,
      duration: 260,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.redrawProgressStrip(),
      onComplete: () => this.redrawProgressStrip(),
    });
  }

  /** Crossfade the floor label between old and new text. */
  private crossfadeFloorLabel(nextText: string): void {
    const g = this.floorText;
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      y: g.y - 6,
      duration: 100,
      ease: 'Quad.easeIn',
      onComplete: () => {
        g.setText(nextText).setY(g.y + 12).setAlpha(0);
        this.scene.tweens.add({
          targets: g,
          alpha: 1,
          y: g.y - 6,
          duration: 140,
          ease: 'Quad.easeOut',
        });
      },
    });
  }

  /** Schedule a 2s shimmer sweep across the coin, looping every ~6s. */
  private scheduleCoinShimmer(): void {
    const fire = (): void => {
      if (!this.coinShine.scene) return;
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
    // Kick off the first sweep after a short delay, then repeat.
    this.scene.time.delayedCall(3000, fire);
    this.scene.time.addEvent({ delay: 6000, loop: true, callback: fire });
  }

  /** Scale-punch + tint pulse on mute icon press. */
  private punchMuteIcon(): void {
    this.scene.tweens.add({
      targets: this.muteIcon,
      scale: { from: 1, to: 0.85 },
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true,
    });
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

  /**
   * Draw the mug icon + a shrinking arc. `ratio` is 1..0 over the buff
   * window. Called on `buff:caffeine_start` and every HUD update tick
   * while the buff is active.
   */
  private renderCaffeineIcon(ratio: number): void {
    this.caffeineIcon.setVisible(true);
    this.caffeineRing.setVisible(true);

    const icon = this.caffeineIcon;
    icon.clear();
    // Mug body.
    icon.fillStyle(0x6b3b23, 1);
    icon.fillRoundedRect(-6, -5, 11, 12, 2);
    icon.fillStyle(0x3a1e10, 1);
    icon.fillRect(-6, -5, 11, 2);
    icon.fillStyle(0xc9a27a, 1);
    icon.fillRect(-5, -5, 9, 1);
    // Handle stroke (right).
    icon.lineStyle(1.5, 0x4a2b1a, 1);
    icon.beginPath();
    icon.arc(6, 1, 4, -Math.PI / 2, Math.PI / 2, false);
    icon.strokePath();

    const ring = this.caffeineRing;
    ring.clear();
    // Background track — full circle, dim.
    ring.lineStyle(2, 0x3b4a5c, 0.6);
    ring.beginPath();
    ring.arc(0, 0, 12, 0, Math.PI * 2);
    ring.strokePath();
    // Countdown arc — shrinks clockwise from the top.
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * Math.max(0, Math.min(1, ratio));
    ring.lineStyle(2, 0xffb84a, 0.95);
    ring.beginPath();
    ring.arc(0, 0, 12, start, end);
    ring.strokePath();
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
    const nextFloorLabel = fd ? `F${fd.id}: ${fd.name}` : '';

    if (floor !== this.lastFloor) {
      const isFirstRender = this.lastFloor === -1;
      this.lastFloor = floor;
      this.redrawBackground();
      if (isFirstRender || !fd) {
        this.floorText.setText(nextFloorLabel);
      } else {
        this.crossfadeFloorLabel(nextFloorLabel);
      }
    } else if (fd && this.floorText.text !== nextFloorLabel) {
      this.floorText.setText(nextFloorLabel);
    }

    if (au > this.lastAU) {
      this.punchCoin(au - this.lastAU);
    }
    this.lastAU = au;

    const next = this.findNextUnlockFloor();
    const sig = next ? `${next.id}:${au}:${floor}` : `none:${floor}`;
    if (sig !== this.lastProgressSig) {
      this.lastProgressSig = sig;
      const target = next ? Phaser.Math.Clamp(au / next.auRequired, 0, 1) : 0;
      this.tweenProgressTo(target);
    }

    if (this.caffeineEndAt > 0 && this.caffeineDuration > 0) {
      const remaining = this.caffeineEndAt - this.scene.time.now;
      if (remaining <= 0) {
        this.onCaffeineEnd();
      } else {
        this.renderCaffeineIcon(remaining / this.caffeineDuration);
      }
    }
  }
}
