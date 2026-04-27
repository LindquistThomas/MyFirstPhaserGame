import * as Phaser from 'phaser';

/**
 * Briefcase projectile — CEO boss counter-attack (phase 2+).
 *
 * Launched horizontally toward the player at 250 px/s.
 * Destroys itself on world-bounds exit.
 * Scene wires overlap with player.
 */
export class BriefcaseProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, towardRight: boolean) {
    super(scene, x, y, 'briefcase_projectile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(7);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
    body.onWorldBounds = true;
    body.setSize(22, 14);
    body.setVelocityX(towardRight ? 250 : -250);
    this.setFlipX(!towardRight);

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
