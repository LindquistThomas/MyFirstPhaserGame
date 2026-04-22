import * as Phaser from 'phaser';
import { hasBeenSeen, hasSeenAny } from '../systems/InfoDialogManager';
import { primaryKeyLabel } from '../input';
import type { GameAction } from '../input';
import { theme } from '../style/theme';

const RADIUS = 18;
const BADGE_RADIUS = 10;
const TEXTURE_KEY = 'info_icon_bg_v2';
const RING_TEXTURE_KEY = 'info_icon_ring_v2';

/**
 * Generate antialiased textures for the info icon once per game.
 *
 * Phaser is configured with `pixelArt: true`, which disables canvas-level
 * antialiasing globally — `Graphics.fillCircle` therefore renders with
 * hard-edged, aliased pixels. Pre-rendering the icon into a 2D canvas
 * with `imageSmoothingEnabled = true` gives us a crisp, smooth disc
 * with soft shadow and glossy highlights that we can stamp as an Image
 * (and tint on hover).
 */
function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURE_KEY)) {
    const pad = 10; // extra room for drop shadow + glow
    const size = (RADIUS + pad) * 2;
    const cx = size / 2;
    const cy = size / 2;
    const tex = scene.textures.createCanvas(TEXTURE_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = true;

      // 1. Drop shadow — soft, offset slightly down so the icon
      //    feels "raised" against any background.
      const shadow = ctx.createRadialGradient(cx, cy + 3, RADIUS * 0.2,
        cx, cy + 3, RADIUS + 8);
      shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
      shadow.addColorStop(0.6, 'rgba(0,0,0,0.22)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, size, size);

      // 2. Cyan outer glow (very subtle — reinforces "interactable").
      const glow = ctx.createRadialGradient(cx, cy, RADIUS * 0.8,
        cx, cy, RADIUS + 6);
      glow.addColorStop(0, 'rgba(0,170,255,0)');
      glow.addColorStop(1, 'rgba(0,170,255,0.35)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // 3. Filled disc — vertical gradient for depth (lighter top).
      const disc = ctx.createLinearGradient(0, cy - RADIUS, 0, cy + RADIUS);
      disc.addColorStop(0, '#1a3a6b');
      disc.addColorStop(0.55, '#0e1f44');
      disc.addColorStop(1, '#07122b');
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = disc;
      ctx.fill();

      // 4. Dark inner rim (1px) then bright outer rim (~2px) for a
      //    two-tone metallic edge.
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS - 1.25, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS - 0.25, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(80,210,255,0.95)';
      ctx.stroke();

      // 5. Glossy top-left highlight arc — small crescent inside the disc.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS - 2, 0, Math.PI * 2);
      ctx.clip();
      const hiGrad = ctx.createLinearGradient(cx - RADIUS, cy - RADIUS,
        cx + RADIUS, cy + RADIUS);
      hiGrad.addColorStop(0, 'rgba(180,240,255,0.55)');
      hiGrad.addColorStop(0.45, 'rgba(180,240,255,0)');
      ctx.fillStyle = hiGrad;
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy - 6, RADIUS * 0.85, RADIUS * 0.45, -Math.PI / 4,
        0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 6. Bespoke "i" glyph — round dot + rounded stem. Drawn by hand
      //    so rendering is identical across platforms (no webfont).
      ctx.fillStyle = '#d8f2ff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      // dot
      ctx.beginPath();
      ctx.arc(cx, cy - 7, 2.6, 0, Math.PI * 2);
      ctx.fill();
      // stem (rounded rect)
      const stemW = 4.4;
      const stemH = 11;
      const stemX = cx - stemW / 2;
      const stemY = cy - 2;
      const sr = stemW / 2;
      ctx.beginPath();
      ctx.moveTo(stemX + sr, stemY);
      ctx.lineTo(stemX + stemW - sr, stemY);
      ctx.arcTo(stemX + stemW, stemY, stemX + stemW, stemY + sr, sr);
      ctx.lineTo(stemX + stemW, stemY + stemH - sr);
      ctx.arcTo(stemX + stemW, stemY + stemH, stemX + stemW - sr, stemY + stemH, sr);
      ctx.lineTo(stemX + sr, stemY + stemH);
      ctx.arcTo(stemX, stemY + stemH, stemX, stemY + stemH - sr, sr);
      ctx.lineTo(stemX, stemY + sr);
      ctx.arcTo(stemX, stemY, stemX + sr, stemY, sr);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      tex.refresh();
    }
  }

  if (!scene.textures.exists(RING_TEXTURE_KEY)) {
    const pad = 4;
    const size = (RADIUS + pad) * 2;
    const tex = scene.textures.createCanvas(RING_TEXTURE_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, RADIUS, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,210,255,1)';
      ctx.stroke();
      tex.refresh();
    }
  }
}

export class InfoIcon {
  private readonly scene: Phaser.Scene;
  private readonly contentId?: string;
  private readonly hintAction: GameAction;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Image;
  private ring?: Phaser.GameObjects.Image;
  private tweens: Phaser.Tweens.Tween[] = [];
  private badge?: Phaser.GameObjects.Container;
  private hint?: Phaser.GameObjects.Container;
  private mode: 'idle' | 'attention' | 'calm' = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, onClick: () => void,
              contentId?: string, worldSpace = false,
              hintAction: GameAction = 'ToggleInfo') {
    this.scene = scene;
    this.contentId = contentId;
    this.hintAction = hintAction;

    ensureTextures(scene);

    this.container = scene.add.container(x, y);
    this.container.setDepth(55);
    if (!worldSpace) this.container.setScrollFactor(0);

    // Attention ring (only visible in attention mode; tween-driven)
    this.ring = scene.add.image(0, 0, RING_TEXTURE_KEY).setVisible(false);
    this.container.add(this.ring);

    // Disc (glyph is baked into the texture for crisp, consistent
    // rendering across platforms — no webfont dependency).
    this.bg = scene.add.image(0, 0, TEXTURE_KEY);
    this.container.add(this.bg);

    const hitArea = scene.add.rectangle(0, 0, (RADIUS + 6) * 2, (RADIUS + 6) * 2)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    hitArea.on('pointerover', () => {
      this.bg.setTint(0x9feaff);
    });
    hitArea.on('pointerout', () => {
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
      // offset reset is handled by stopAllTweens via setScale
      if (this.ring) { this.ring.setVisible(false); this.ring.setScale(1).setAlpha(1); }
      this.hint?.setVisible(false);
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

    this.refreshHint();
  }

  /** Force-switch to the subtle "seen" animation (called after the dialog is closed). */
  markAsSeen(): void {
    // This icon has just been opened/read, so hide its local "Press ↑" hint
    // immediately before switching to the subtle seen-state animation.
    this.hint?.setVisible(false);
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

    this.badge = scene.add.container(RADIUS - 3, -(RADIUS - 3));

    // Drop shadow — soft blob below the badge for lift.
    const shadow = scene.add.graphics();
    shadow.fillStyle(theme.color.bg.dark, 0.35);
    shadow.fillCircle(0, 1.5, BADGE_RADIUS + 1);
    this.badge.add(shadow);

    // Filled disc — brighter, more saturated colours.
    const fillColor = passed ? 0x2ecc71 : 0xf5a623; // green / friendly amber
    const badgeBg = scene.add.graphics();
    badgeBg.fillStyle(fillColor, 1);
    badgeBg.fillCircle(0, 0, BADGE_RADIUS);
    // Dark inner rim then bright outer rim for two-tone metallic edge.
    badgeBg.lineStyle(1, theme.color.bg.dark, 0.45);
    badgeBg.strokeCircle(0, 0, BADGE_RADIUS - 0.5);
    badgeBg.lineStyle(1.25, 0xffffff, 0.75);
    badgeBg.strokeCircle(0, 0, BADGE_RADIUS + 0.25);
    this.badge.add(badgeBg);

    const badgeLabel = scene.add.text(0, 0, passed ? '\u2713' : '?', {
      fontFamily: 'monospace', fontSize: passed ? '13px' : '14px',
      color: theme.color.css.textWhite, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.badge.add(badgeLabel);

    this.container.add(this.badge);
  }

  destroy(): void {
    this.stopAllTweens();
    this.container.destroy();
  }

  /**
   * First-time teaching hint: a small "Press ↑" chip rendered below the
   * disc. Shown while the icon is visible AND the player has never opened
   * any info dialog. Hidden permanently as soon as the first dialog is
   * opened (see {@link markAsSeen}).
   */
  private refreshHint(): void {
    const shouldShow = this.container.visible && !hasSeenAny();
    if (!shouldShow) {
      this.hint?.setVisible(false);
      return;
    }
    if (!this.hint) this.hint = this.createHint();
    this.hint.setVisible(true);
  }

  private createHint(): Phaser.GameObjects.Container {
    const label = `Press ${primaryKeyLabel(this.hintAction)}`;
    const text = this.scene.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: theme.color.css.textWhite,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const padX = 6;
    const padY = 3;
    const w = text.width + padX * 2;
    const h = text.height + padY * 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(theme.color.bg.dark, 0.85);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    bg.lineStyle(1, 0x50d2ff, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

    // Sit just below the disc (disc radius ≈ RADIUS + rim).
    const container = this.scene.add.container(0, RADIUS + h / 2 + 6, [bg, text]);
    this.container.add(container);
    return container;
  }

  private stopAllTweens(): void {
    for (const t of this.tweens) t.stop();
    this.tweens = [];
    // Reset any lingering offsets from the bounce tween.
    this.bg.setScale(1).setAlpha(1).setY(0);
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

    // Bounce — vertical bob on the disc (keeps container scale free for ring tween)
    this.tweens.push(this.scene.tweens.add({
      targets: this.bg,
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

  /**
   * Subtle "already-seen" animation — a gentle breathing scale on the
   * disc itself. Reads as "alive / still clickable" without stealing
   * attention from the scene.
   */
  private playCalmPulse(): void {
    if (this.ring) this.ring.setVisible(false);
    this.tweens.push(this.scene.tweens.add({
      targets: this.bg,
      scale: { from: 0.95, to: 1.05 },
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    // Subtle 2px idle bob so the icon feels alive even in the "seen" state.
    this.tweens.push(this.scene.tweens.add({
      targets: this.bg,
      y: { from: 0, to: -2 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
  }
}
