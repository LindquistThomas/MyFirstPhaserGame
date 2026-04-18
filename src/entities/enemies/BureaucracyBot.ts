import * as Phaser from 'phaser';
import { Enemy } from '../Enemy';

/**
 * Bureaucracy Bot — avoid-only corporate hazard.
 *
 * Patrols between `minX` and `maxX`. Cannot be stomped (narratively
 * protected by their unshakeable clipboard / process). Touching the bot
 * deals `hitCost` AU damage and knocks the player back.
 */
export class BureaucracyBot extends Enemy {
  private minX: number;
  private maxX: number;
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { minX: number; maxX: number; speed?: number } = { minX: x - 160, maxX: x + 160 },
  ) {
    super(scene, x, y, 'enemy_bot');
    this.canBeStomped = false;
    this.hitCost = 1;
    this.minX = opts.minX;
    this.maxX = opts.maxX;
    this.speed = opts.speed ?? 75;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 52);
    body.setOffset(6, 2);

    this.setVelocityX(this.speed);
  }

  override update(): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.x <= this.minX && body.velocity.x < 0) {
      this.setVelocityX(this.speed);
      this.setFlipX(true);
    } else if (this.x >= this.maxX && body.velocity.x > 0) {
      this.setVelocityX(-this.speed);
      this.setFlipX(false);
    }
  }
}
