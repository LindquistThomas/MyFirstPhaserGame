import type * as Phaser from 'phaser';
import { GAME_WIDTH, COLORS, type FloorId } from '../../config/gameConfig';
import { LEVEL_DATA } from '../../config/levelData';
import { theme } from '../../style/theme';
import { createSceneLifecycle, type SceneLifecycle } from '../../systems/sceneLifecycle';
import { eventBus } from '../../systems/EventBus';
import type { ProgressionSystem } from '../../systems/ProgressionSystem';
import type { LayoutTokens } from '../../style/responsive';
import type { Toast } from '../Toast';

const PROGRESS_STRIP_WIDTH = 140;
const PROGRESS_STRIP_HEIGHT = 6;

/** Lighten a 0xRRGGBB int by `amount` (0..1) toward white. */
export function lighten(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const gC = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(gC + (255 - gC) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return (lr << 16) | (lg << 8) | lb;
}

/**
 * Owns the unlock-progress strip, floor name indicator, floor pill,
 * AU-milestone / floor-unlock toasts, and the "2 AU from unlock" nudge.
 *
 * Call {@link update} every frame to keep the strip and nudge timer in sync.
 */
export class ProgressStripController {
  readonly floorText: Phaser.GameObjects.Text;
  readonly floorLabel: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private readonly progression: ProgressionSystem;
  private readonly toast: Toast;
  private readonly progressStrip: Phaser.GameObjects.Graphics;
  private readonly floorPill: Phaser.GameObjects.Graphics;
  private readonly lifecycle: SceneLifecycle;
  /** Animated progress-strip ratio (tweened toward the target). */
  private progressRatio = 0;
  private progressTween?: Phaser.Tweens.Tween;
  private lastProgressSig = '';
  /** Cached result of the last findNextUnlockFloor() call. */
  private cachedNextFloor: (typeof LEVEL_DATA)[FloorId] | undefined = undefined;
  /** Timestamp when the player first entered the "2 AU from unlock" zone. null = inactive. */
  private nudgeTimerStart: number | null = null;
  /** FloorId for which a nudge was already shown (prevents repeat spam). */
  private nudgeShownForFloor: FloorId | null = null;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    progression: ProgressionSystem,
    toast: Toast,
    tokens: LayoutTokens,
  ) {
    this.scene = scene;
    this.progression = progression;
    this.toast = toast;

    // Floor pill — re-tinted per floor.
    this.floorPill = scene.add.graphics();
    container.add(this.floorPill as unknown as Phaser.GameObjects.GameObject);

    // Unlock-progress strip below AU text.
    this.progressStrip = scene.add.graphics();
    container.add(this.progressStrip as unknown as Phaser.GameObjects.GameObject);

    // "FLOOR" micro-label above the floor name.
    this.floorLabel = scene.add.text(GAME_WIDTH - 210, 9, 'FLOOR', {
      fontFamily: 'monospace', fontSize: tokens.hudFontFloorLabel,
      color: theme.color.css.textQuizHint, fontStyle: 'bold',
    }).setOrigin(0, 0);
    container.add(this.floorLabel as unknown as Phaser.GameObjects.GameObject);

    // Floor indicator — to the left of the mute icon.
    this.floorText = scene.add.text(GAME_WIDTH - 48, 10, '', {
      fontFamily: 'monospace', fontSize: tokens.hudFontFloor, color: COLORS.titleText,
    }).setOrigin(1, 0);
    container.add(this.floorText as unknown as Phaser.GameObjects.GameObject);

    this.lifecycle = createSceneLifecycle(scene);
    this.lifecycle.bindEventBus('progression:au_milestone', (total) => {
      this.toast.show(`\u2B50 ${total} AU collected!`);
    });
    this.lifecycle.bindEventBus('progression:floor_unlocked', (floorId) => {
      const floorData = LEVEL_DATA[floorId];
      const name = floorData?.name ?? 'new floor';
      this.toast.show(`\u{1F513} ${name} UNLOCKED!`);
      eventBus.emit('sfx:floor_unlocked');
    });
  }

  /** Update font sizes when the viewport size class changes. */
  relayout(tokens: LayoutTokens): void {
    this.floorText.setStyle({ fontSize: tokens.hudFontFloor });
    this.floorLabel.setStyle({ fontSize: tokens.hudFontFloorLabel });
  }

  /** Redraw the floor pill for the current floor theme. */
  redrawFloorPill(fd: (typeof LEVEL_DATA)[FloorId] | undefined): void {
    const g = this.floorPill;
    g.clear();
    if (!fd) return;
    const base = fd.theme.platformColor;
    g.fillStyle(lighten(base, 0.45), 0.55);
    g.fillRoundedRect(GAME_WIDTH - 216, 4, 174, 36, 8);
    g.fillStyle(lighten(base, 0.1), 0.22);
    g.fillRoundedRect(GAME_WIDTH - 215, 5, 172, 34, 7);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(GAME_WIDTH - 214, 5, 170, 1);
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

  private findNextUnlockFloor(): (typeof LEVEL_DATA)[FloorId] | undefined {
    const au = this.progression.getTotalAU();
    return Object.values(LEVEL_DATA)
      .filter((f) => f.auRequired > 0 && au < f.auRequired)
      .sort((a, b) => a.auRequired - b.auRequired)[0];
  }

  private redrawProgressStrip(): void {
    const g = this.progressStrip;
    g.clear();
    const next = this.cachedNextFloor;
    if (!next) return;
    const x = 46;
    const y = 30;
    const floor = this.progression.getCurrentFloor();
    const fillColor = LEVEL_DATA[floor]?.theme.platformColor ?? theme.color.ui.accent;
    g.fillStyle(0x0a1422, 0.7);
    g.fillRoundedRect(x, y, PROGRESS_STRIP_WIDTH, PROGRESS_STRIP_HEIGHT, 3);
    const fillW = Math.round(this.progressRatio * PROGRESS_STRIP_WIDTH);
    if (fillW > 0) {
      g.fillStyle(lighten(fillColor, 0.25), 0.95);
      g.fillRoundedRect(x, y, fillW, PROGRESS_STRIP_HEIGHT, 3);
      if (fillW >= 4) {
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(x + 1, y + 1, fillW - 2, 1);
      }
    }
  }

  /** Tween `progressRatio` toward the current AU/required ratio. */
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

  /**
   * Update floor text, progress strip, and nudge timer.
   * @param au - current total AU
   * @param floor - current floor
   * @param floorChanged - true when the floor changed this frame
   * @param auChanged - true when AU changed this frame
   * @param now - scene.time.now
   */
  update(
    au: number,
    floor: FloorId,
    floorChanged: boolean,
    auChanged: boolean,
    now: number,
  ): void {
    const fd = LEVEL_DATA[floor];
    const nextFloorLabel = fd ? `F${fd.id}: ${fd.name}` : '';

    if (floorChanged) {
      this.redrawFloorPill(fd);
    }

    if (floorChanged) {
      if (this.floorText.text === '') {
        this.floorText.setText(nextFloorLabel);
      } else {
        this.crossfadeFloorLabel(nextFloorLabel);
      }
    } else if (fd && this.floorText.text !== nextFloorLabel) {
      this.floorText.setText(nextFloorLabel);
    }

    if (auChanged || floorChanged) {
      const next = this.findNextUnlockFloor();
      this.cachedNextFloor = next;
      const sig = next ? `${next.id}:${au}:${floor}` : `none:${floor}`;
      if (sig !== this.lastProgressSig) {
        this.lastProgressSig = sig;
        const target = next ? Math.min(1, Math.max(0, au / next.auRequired)) : 0;
        this.tweenProgressTo(target);
      }
    }

    // Tutorial nudge: when within 2 AU of the next floor unlock for 20 s,
    // show a hint toast once.
    const nextForNudge = this.cachedNextFloor;
    if (nextForNudge && nextForNudge.auRequired - au <= 2) {
      if (this.nudgeShownForFloor !== nextForNudge.id) {
        if (this.nudgeTimerStart === null) {
          this.nudgeTimerStart = now;
        } else if (now - this.nudgeTimerStart >= 20_000) {
          const needed = nextForNudge.auRequired - au;
          this.toast.show(
            `\u{1F4A1} Just ${needed} more AU to unlock ${nextForNudge.name}! Keep exploring for more AU.`,
          );
          this.nudgeShownForFloor = nextForNudge.id;
          this.nudgeTimerStart = null;
        }
      }
    } else {
      this.nudgeTimerStart = null;
    }
  }

  destroy(): void {
    this.lifecycle.dispose();
  }
}
