import * as Phaser from 'phaser';
import { Enemy } from '../Enemy';

/**
 * Terrorist Commander — the boss-type enemy for the Executive Suite
 * hostage rescue scenario.
 *
 * Non-stompable: patrols horizontally between `minX`/`maxX` like other
 * enemies, but cannot be defeated by jumping on top. The player must
 * collect the Pistol mission item first — then overlapping from above
 * triggers `defeatByWeapon()` instead of dealing damage.
 *
 * Higher `hitCost` (2 AU) and faster patrol speed than regular enemies.
 */
export class TerroristCommander extends Enemy {
  private minX: number;
  private maxX: number;
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { minX: number; maxX: number; speed?: number } = { minX: x - 200, maxX: x + 200 },
  ) {
    super(scene, x, y, 'enemy_terrorist');
    this.canBeStomped = false;
    this.hitCost = 2;
    this.knockbackX = 320;
    this.knockbackY = -300;
    this.minX = opts.minX;
    this.maxX = opts.maxX;
    this.speed = opts.speed ?? 100;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 52);
    body.setOffset(4, 4);

    // Menacing shoulder-sway idle animation.
    scene.tweens.add({
      targets: this,
      scaleX: 1.05,
      duration: 600,
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

  /**
   * Defeat this enemy via weapon (pistol). Plays a surrender animation
   * (raise hands → fade out) instead of the normal stomp squash.
   *
   * Returns `true` if the enemy was successfully defeated, `false` if
   * already defeated.
   */
  defeatByWeapon(): boolean {
    if (this.defeated) return false;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.scene.tweens.killTweensOf(this);

    // White-hot flash for impact readability.
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.scene) return;
      this.clearTint();
    });

    // Surrender: raise hands (scaleY stretch) then fade out.
    this.scene.tweens.add({
      targets: this,
      scaleY: 1.2,
      scaleX: 0.9,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.scene) return;
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          y: this.y - 20,
          duration: 400,
          ease: 'Quad.easeIn',
          onComplete: () => this.destroy(),
        });
      },
    });
    return true;
  }
}
