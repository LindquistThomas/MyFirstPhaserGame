import * as Phaser from 'phaser';
import { Enemy } from '../Enemy';
import { eventBus } from '../../systems/EventBus';

/**
 * Terrorist Commander — F4 hostage rescue mini-boss.
 *
 * Non-stompable, higher hit cost, patrols horizontally.
 * Can only be defeated when the player has collected the Pistol mission item.
 * Defeat plays a surrender animation (hands-up tween → fade).
 */
export class TerroristCommander extends Enemy {
  private minX: number;
  private maxX: number;
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { minX: number; maxX: number; speed?: number } = { minX: x - 160, maxX: x + 160 },
  ) {
    super(scene, x, y, 'enemy_terrorist');
    this.canBeStomped = false;
    this.hitCost = 2;
    this.knockbackX = 300;
    this.knockbackY = -280;
    this.minX = opts.minX;
    this.maxX = opts.maxX;
    this.speed = opts.speed ?? 90;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 50);
    body.setOffset(2, 6);

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

  /**
   * Surrender defeat — used when player has the Pistol and overlaps this enemy.
   * Plays hands-up tween then fades out. Distinct from stomp squash.
   */
  defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.setVelocity(0, 0);
    eventBus.emit('sfx:boss_defeated');
    // Hands-up: slight scale up then drift upward while fading
    this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => this.destroy(),
    });
  }
}
