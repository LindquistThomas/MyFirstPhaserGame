import * as Phaser from 'phaser';
import { Enemy } from '../Enemy';

/**
 * Slime — slow floor patrol, stompable.
 *
 * Walks between `minX` and `maxX` at `speed` px/s. Jump on top to defeat.
 * Contact from the side deals `hitCost` AU damage and knocks the player back.
 */
export class Slime extends Enemy {
  private minX: number;
  private maxX: number;
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { minX: number; maxX: number; speed?: number } = { minX: x - 120, maxX: x + 120 },
  ) {
    super(scene, x, y, 'enemy_slime');
    this.canBeStomped = true;
    this.hitCost = 1;
    this.minX = opts.minX;
    this.maxX = opts.maxX;
    this.speed = opts.speed ?? 50;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(42, 26);
    body.setOffset(3, 6);

    // Subtle idle bob — a slime should never look static.
    scene.tweens.add({
      targets: this,
      scaleY: 0.9,
      scaleX: 1.1,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.setVelocityX(this.speed);
  }

  override update(): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.x <= this.minX && body.velocity.x < 0) {
      this.setVelocityX(this.speed);
      this.setFlipX(false);
    } else if (this.x >= this.maxX && body.velocity.x > 0) {
      this.setVelocityX(-this.speed);
      this.setFlipX(true);
    }
  }
}
