import * as Phaser from 'phaser';

export type MissionItemId = 'pistol' | 'keycard' | 'bomb_code';

/**
 * Collectible mission item — non-persisted pickup that gates the hostage
 * rescue scenario on the Executive Suite floor.
 *
 * Modelled after {@link Coffee}: static body, float/pulse tweens, and a
 * `collect()` method that disables the body, plays a pickup animation,
 * then destroys the game object.
 *
 * The scene is responsible for creating the overlap collider and calling
 * `collect()` on contact.
 */
export class MissionItem extends Phaser.Physics.Arcade.Sprite {
  readonly itemId: MissionItemId;
  private collected = false;
  private floatTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    itemId: MissionItemId,
  ) {
    super(scene, x, y, texture);
    this.itemId = itemId;
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.setDepth(5);

    this.floatTween = scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 900,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this.pulseTween = scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 650,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Whether this item has already been collected. */
  isCollected(): boolean {
    return this.collected;
  }

  /**
   * Collect the item: disable body, play a rising fade-out, then destroy.
   * Returns `true` if the item was collected, `false` if already collected.
   */
  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    this.floatTween?.stop();
    this.pulseTween?.stop();
    this.scene.tweens.killTweensOf(this);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 24,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 0.6,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
    return true;
  }
}
