import type * as Phaser from 'phaser';
import { GAME_WIDTH } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { createSceneLifecycle, type SceneLifecycle } from '../../systems/sceneLifecycle';
import type { Toast } from '../Toast';
import { AchievementsDialog } from '../AchievementsDialog';

const TROPHY_X = GAME_WIDTH - 128;
const TROPHY_Y = 22;

/**
 * Owns the achievement trophy badge in the HUD: renders a minimal
 * trophy icon, handles hover/click interactions, and opens the
 * {@link AchievementsDialog} when clicked.
 *
 * Also subscribes to `achievement:unlocked` to show a toast notification.
 */
export class AchievementBadgeController {
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly lifecycle: SceneLifecycle;

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container, toast: Toast) {
    this.icon = scene.add.graphics().setPosition(TROPHY_X, TROPHY_Y);
    container.add(this.icon as unknown as Phaser.GameObjects.GameObject);
    this.renderIcon(false);

    const hit = scene.add.zone(TROPHY_X, TROPHY_Y, 32, 32).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => new AchievementsDialog(scene));
    hit.on('pointerover', () => this.renderIcon(true));
    hit.on('pointerout', () => this.renderIcon(false));
    container.add(hit as unknown as Phaser.GameObjects.GameObject);

    this.lifecycle = createSceneLifecycle(scene);
    this.lifecycle.bindEventBus('achievement:unlocked', (_id, label) => {
      toast.show(`\u{1F3C6} Achievement unlocked: ${label}`);
    });
  }

  private renderIcon(hovered: boolean): void {
    const g = this.icon;
    g.clear();
    const color = hovered ? theme.color.ui.hover : 0xffcc44;
    // Cup body
    g.fillStyle(color, 1);
    g.fillRect(-7, -10, 14, 10);
    // Stem
    g.fillRect(-3, 0, 6, 3);
    // Base
    g.fillRect(-6, 3, 12, 3);
    // Handles
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.arc(-9, -5, 3, Math.PI / 2, (3 * Math.PI) / 2);
    g.strokePath();
    g.beginPath();
    g.arc(9, -5, 3, -Math.PI / 2, Math.PI / 2);
    g.strokePath();
  }

  destroy(): void {
    this.lifecycle.dispose();
  }
}
