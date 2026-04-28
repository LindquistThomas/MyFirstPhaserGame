import * as Phaser from 'phaser';

/**
 * Pistol projectile fired by the player in the Executive Suite
 * when the `pistol` mission item has been collected.
 *
 * Travels horizontally at 500 px/s. Destroys on world-bounds exit.
 */
export class PistolProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, toRight: boolean) {
    super(scene, x, y, 'item_pistol');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(6);
    this.setScale(0.7);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(toRight ? 500 : -500);
    this.setFlipX(!toRight);

    // Destroy when leaving world bounds — use once() to avoid listener accumulation
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;
    const onBounds = (b: Phaser.Physics.Arcade.Body): void => {
      if (b === this.body) this.destroySelf();
    };
    scene.physics.world.once(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, onBounds);
    this._boundsListener = onBounds;
  }

  private _boundsListener?: (b: Phaser.Physics.Arcade.Body) => void;

  destroySelf(): void {
    if (!this.active) return;
    if (this._boundsListener && this.scene?.physics?.world) {
      this.scene.physics.world.off(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this._boundsListener);
    }
    this.destroy();
  }
}
