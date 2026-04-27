import * as Phaser from 'phaser';

/**
 * Coffee mug projectile — player's weapon in the CEO boss fight.
 *
 * Launched horizontally at 400 px/s in the player's facing direction.
 * Destroys itself on world-bounds exit.
 * The scene wires the overlap with CEOBoss and calls `onHit()`.
 */
export class CoffeeMugProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, facingRight: boolean) {
    super(scene, x, y, 'mug_projectile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(7);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
    body.onWorldBounds = true;
    body.setSize(14, 12);
    body.setVelocityX(facingRight ? 400 : -400);
    this.setFlipX(!facingRight);

    scene.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.onWorldBounds, this);
  }

  private onWorldBounds = (body: Phaser.Physics.Arcade.Body): void => {
    if (body.gameObject === this) this.destroySelf();
  };

  destroySelf(): void {
    if (!this.scene) return;
    this.scene.physics.world.off(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.onWorldBounds, this);
    this.destroy();
  }
}
