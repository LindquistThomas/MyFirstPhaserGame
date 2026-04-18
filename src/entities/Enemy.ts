import * as Phaser from 'phaser';

/**
 * Base class for all enemies in the game.
 *
 * Concrete subclasses drive movement via `updateBehavior()`. The base
 * handles:
 *  - arcade physics body setup
 *  - a subtle bob/squash tween (visual life)
 *  - defeat animation (squash + fade) for stompable enemies
 *
 * An enemy declares itself stompable by setting `canBeStomped = true`.
 * LevelScene handles the overlap callback and routes to `onStomp()` or
 * to the player's `takeHit()` based on approach angle.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  /** When true, jumping on top defeats this enemy. */
  public canBeStomped = false;

  /** AU lost on contact (non-stomp). */
  public hitCost = 1;

  /** Knockback impulse applied to the player on contact. */
  public knockbackX = 240;
  public knockbackY = -260;

  /** True once onStomp() or similar kills the enemy. Overlap callback must check this. */
  public defeated = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(6);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setAllowGravity(true);
  }

  /**
   * Called once per frame by LevelScene. Default no-op; subclasses
   * override to add patrol / seek / hover behavior.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_time: number, _delta: number): void { /* no-op */ }

  /**
   * Kill the enemy via stomp. Plays a short squash animation, then destroys.
   * Safe to call multiple times — checks `defeated`.
   */
  onStomp(): void {
    if (this.defeated) return;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.2,
      scaleX: 1.3,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }
}
