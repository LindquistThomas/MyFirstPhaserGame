import * as Phaser from 'phaser';
import { hasBeenSeen } from '../systems/InfoDialogManager';

const RADIUS = 18;
const BADGE_RADIUS = 9;
const TEXTURE_KEY = 'info_icon_bg';
const RING_TEXTURE_KEY = 'info_icon_ring';

/**
 * Generate antialiased textures for the info icon once per game.
 *
 * Phaser is configured with `pixelArt: true`, which disables canvas-level
 * antialiasing globally — `Graphics.fillCircle` therefore renders with
 * hard-edged, aliased pixels. Pre-rendering the icon into a 2D canvas
 * with `imageSmoothingEnabled = true` gives us a crisp, smooth circle
 * that we can stamp as an Image (and tint on hover).
 */
function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURE_KEY)) {
    const pad = 6;
    const size = (RADIUS + pad) * 2;
    const tex = scene.textures.createCanvas(TEXTURE_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = true;

      // Outer soft glow
      const grad = ctx.createRadialGradient(size / 2, size / 2, RADIUS * 0.7,
        size / 2, size / 2, RADIUS + pad);
      grad.addColorStop(0, 'rgba(0,170,255,0)');
      grad.addColorStop(1, 'rgba(0,170,255,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Filled disc
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,10,42,0.92)';
      ctx.fill();

      // Stroke
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = 'rgba(0,170,255,0.95)';
      ctx.stroke();

      tex.refresh();
    }
  }

  if (!scene.textures.exists(RING_TEXTURE_KEY)) {
    const pad = 2;
    const size = (RADIUS + pad) * 2;
    const tex = scene.textures.createCanvas(RING_TEXTURE_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, RADIUS, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,200,255,1)';
      ctx.stroke();
      tex.refresh();
    }
  }
}

export class InfoIcon {
  private readonly scene: Phaser.Scene;
  private readonly contentId?: string;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private ring?: Phaser.GameObjects.Image;
  private tweens: Phaser.Tweens.Tween[] = [];
  private badge?: Phaser.GameObjects.Container;
  private mode: 'idle' | 'attention' | 'calm' = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, onClick: () => void,
              contentId?: string, worldSpace = false) {
    this.scene = scene;
    this.contentId = contentId;

    ensureTextures(scene);

    this.container = scene.add.container(x, y);
    this.container.setDepth(55);
    if (!worldSpace) this.container.setScrollFactor(0);

    // Attention ring (only visible in attention mode; tween-driven)
    this.ring = scene.add.image(0, 0, RING_TEXTURE_KEY).setVisible(false);
    this.container.add(this.ring);

    this.bg = scene.add.image(0, 0, TEXTURE_KEY);
    this.container.add(this.bg);

    this.label = scene.add.text(0, 0, 'i', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '22px', color: '#7fd4ff', fontStyle: 'bold italic',
    }).setOrigin(0.5, 0.55);
    this.container.add(this.label);

    const hitArea = scene.add.rectangle(0, 0, (RADIUS + 6) * 2, (RADIUS + 6) * 2)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    hitArea.on('pointerover', () => {
      this.label.setColor('#ffffff');
      this.bg.setTint(0x66ddff);
    });
    hitArea.on('pointerout', () => {
      this.label.setColor('#7fd4ff');
      this.bg.clearTint();
    });
    hitArea.on('pointerdown', () => onClick());
    this.container.add(hitArea);

    this.container.setVisible(false);
  }

  setVisible(visible: boolean): void {
    const wasVisible = this.container.visible;
    this.container.setVisible(visible);

    if (!visible) {
      this.stopAllTweens();
      this.container.setScale(1);
      this.container.setAlpha(1);
      this.container.y = this.container.y; // no-op; offset reset handled by stopAllTweens via setScale
      if (this.ring) { this.ring.setVisible(false); this.ring.setScale(1).setAlpha(1); }
      this.mode = 'idle';
      return;
    }

    // Re-check seen state each time we become visible so the animation
    // mode updates after the player reads the dialog.
    const unseen = !!this.contentId && !hasBeenSeen(this.contentId);
    const nextMode: 'attention' | 'calm' = unseen ? 'attention' : 'calm';

    if (!wasVisible || nextMode !== this.mode) {
      this.stopAllTweens();
      this.mode = nextMode;
      if (nextMode === 'attention') {
        this.playAttention(/* entrance = */ !wasVisible);
      } else {
        this.playCalmPulse();
      }
    }
  }

  /** Force-switch to the subtle "seen" animation (called after the dialog is closed). */
  markAsSeen(): void {
    if (!this.container.visible) return;
    if (this.mode === 'calm') return;
    this.stopAllTweens();
    this.mode = 'calm';
    this.playCalmPulse();
  }

  /** Show a small badge on the info icon indicating quiz status. */
  setQuizBadge(scene: Phaser.Scene, passed: boolean): void {
    if (this.badge) {
      this.badge.destroy();
      this.badge = undefined;
    }

    this.badge = scene.add.container(RADIUS - 2, -(RADIUS - 2));

    const badgeBg = scene.add.graphics();
    badgeBg.fillStyle(passed ? 0x228b22 : 0xdaa520, 1);
    badgeBg.fillCircle(0, 0, BADGE_RADIUS);
    badgeBg.lineStyle(1.5, 0x000000, 0.45);
    badgeBg.strokeCircle(0, 0, BADGE_RADIUS);
    this.badge.add(badgeBg);

    const badgeLabel = scene.add.text(0, 0, passed ? '\u2713' : '?', {
      fontFamily: 'monospace', fontSize: passed ? '12px' : '13px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.badge.add(badgeLabel);

    this.container.add(this.badge);
  }

  destroy(): void {
    this.stopAllTweens();
    this.container.destroy();
  }

  private stopAllTweens(): void {
    for (const t of this.tweens) t.stop();
    this.tweens = [];
    // Reset any lingering offsets from the bounce tween.
    this.bg.setScale(1).setAlpha(1).setY(0);
    this.label.setScale(1).setAlpha(1).setY(0);
    if (this.ring) this.ring.setScale(1).setAlpha(1);
    this.container.setScale(1).setAlpha(1);
  }

  /** Eye-catching, first-visit animation. */
  private playAttention(entrance: boolean): void {
    if (entrance) {
      // Pop-in
      this.container.setScale(0.2);
      this.container.setAlpha(0);
      this.tweens.push(this.scene.tweens.add({
        targets: this.container, scale: 1, alpha: 1,
        duration: 360, ease: 'Back.easeOut',
      }));
    }

    // Bounce — vertical bob on the inner pieces (keeps container scale for ring tween)
    this.tweens.push(this.scene.tweens.add({
      targets: [this.bg, this.label],
      y: { from: 0, to: -4 },
      duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));

    // Ring pulse — expands outward and fades, repeating
    if (this.ring) {
      const ring = this.ring;
      ring.setVisible(true).setScale(1).setAlpha(0.9);
      this.tweens.push(this.scene.tweens.add({
        targets: ring,
        scale: { from: 0.9, to: 1.8 },
        alpha: { from: 0.9, to: 0 },
        duration: 1100, repeat: -1, ease: 'Sine.easeOut',
      }));
    }
  }

  /** Subtle "already-seen" animation. */
  private playCalmPulse(): void {
    if (this.ring) this.ring.setVisible(false);
    this.tweens.push(this.scene.tweens.add({
      targets: this.container, alpha: { from: 1, to: 0.65 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
  }
}
