import type * as Phaser from 'phaser';
import { GAME_WIDTH } from '../../config/gameConfig';
import { createSceneLifecycle, type SceneLifecycle } from '../../systems/sceneLifecycle';

const CAF_X = GAME_WIDTH - 76;
const CAF_Y = 22;

/**
 * Owns the caffeine-buff ring visualization. Renders a coffee-mug icon
 * and a depleting arc ring that tracks remaining buff duration.
 *
 * Subscribes to `buff:caffeine_start` and `buff:caffeine_end` via the
 * scene lifecycle so subscriptions are cleaned up on scene shutdown.
 *
 * Call {@link update} every frame while the buff is active.
 */
export class CaffeineRingController {
  private readonly scene: Phaser.Scene;
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly lifecycle: SceneLifecycle;
  /** Timestamp when the buff ends. 0 when inactive. */
  private endAt = 0;
  private duration = 0;

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;

    this.ring = scene.add.graphics().setPosition(CAF_X, CAF_Y).setVisible(false);
    container.add(this.ring as unknown as Phaser.GameObjects.GameObject);

    this.icon = scene.add.graphics().setPosition(CAF_X, CAF_Y).setVisible(false);
    container.add(this.icon as unknown as Phaser.GameObjects.GameObject);

    this.lifecycle = createSceneLifecycle(scene);
    this.lifecycle.bindEventBus('buff:caffeine_start', (durationMs) => {
      this.duration = durationMs;
      this.endAt = this.scene.time.now + durationMs;
      this.renderIcon(1);
    });
    this.lifecycle.bindEventBus('buff:caffeine_end', () => {
      this.endAt = 0;
      this.duration = 0;
      this.icon.setVisible(false);
      this.ring.setVisible(false);
    });
  }

  /** Update the ring arc. Call every frame from HUD.update(). */
  update(now: number): void {
    if (this.endAt <= 0 || this.duration <= 0) return;
    const remaining = this.endAt - now;
    if (remaining <= 0) {
      this.endAt = 0;
      this.duration = 0;
      this.icon.setVisible(false);
      this.ring.setVisible(false);
    } else {
      this.renderIcon(remaining / this.duration);
    }
  }

  private renderIcon(ratio: number): void {
    this.icon.setVisible(true);
    this.ring.setVisible(true);

    const icon = this.icon;
    icon.clear();
    icon.fillStyle(0x6b3b23, 1);
    icon.fillRoundedRect(-6, -5, 11, 12, 2);
    icon.fillStyle(0x3a1e10, 1);
    icon.fillRect(-6, -5, 11, 2);
    icon.fillStyle(0xc9a27a, 1);
    icon.fillRect(-5, -5, 9, 1);
    icon.lineStyle(1.5, 0x4a2b1a, 1);
    icon.beginPath();
    icon.arc(6, 1, 4, -Math.PI / 2, Math.PI / 2, false);
    icon.strokePath();

    const ring = this.ring;
    ring.clear();
    ring.lineStyle(2, 0x3b4a5c, 0.6);
    ring.beginPath();
    ring.arc(0, 0, 12, 0, Math.PI * 2);
    ring.strokePath();
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * Math.max(0, Math.min(1, ratio));
    ring.lineStyle(2, 0xffb84a, 0.95);
    ring.beginPath();
    ring.arc(0, 0, 12, start, end);
    ring.strokePath();
  }

  destroy(): void {
    this.lifecycle.dispose();
  }
}
