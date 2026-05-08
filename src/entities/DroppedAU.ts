import * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';

/**
 * Transient AU pickup dropped when the player is hit by an enemy.
 *
 * Unlike `Token` (which is persistent / tied to the progression save),
 * DroppedAU is scene-local and purely cosmetic: it represents AU that
 * was already deducted from the player's total via
 * ProgressionSystem.loseAU(). Picking it up calls back into the scene
 * to re-award that AU (without using a tokenIndex, so it doesn't affect
 * the collected-tokens set).
 *
 * Behavior:
 *  - Spawns with an outward burst velocity and gravity enabled.
 *  - Collides with platforms so it settles on the floor.
 *  - A short "no-pickup" window prevents instant re-collection by the
 *    player who just dropped it.
 */
export class DroppedAU extends Phaser.Physics.Arcade.Sprite {
  /** When true, overlap with the player will re-award 1 AU. */
  public ready = false;

  /** Set to true once collected to guard against duplicate callbacks. */
  public collected = false;
  private armVersion = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string = 'token_floor1') {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);
    this.reset(x, y, textureKey);
  }

  public reset(x: number, y: number, textureKey: string = 'token_floor1'): void {
    this.armVersion++;
    this.ready = false;
    this.collected = false;
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
    this.setScale(1);
    this.setTexture(textureKey);
    this.setPosition(x, y);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCollideWorldBounds(true);
    body.setBounce(0.4, 0.4);
    body.setDragX(120);
    body.setAllowGravity(true);

    // Random outward burst — caller can override with setVelocity afterward.
    const angle = Phaser.Math.FloatBetween(-Math.PI * 0.75, -Math.PI * 0.25);
    const speed = Phaser.Math.Between(180, 320);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.scene.tweens.killTweensOf(this);
    // Subtle pulse so the player notices scattered coins.
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Arm pickup after a short window to avoid instant re-collection.
    // Capture current reset generation so delayed callbacks from older cycles
    // on pooled instances do not arm the coin.
    const armVersion = this.armVersion;
    this.scene.time.delayedCall(450, () => {
      if (this.armVersion === armVersion && this.active) this.ready = true;
    });
  }

  /** Re-award AU on pickup. Safe to call multiple times. */
  recover(onComplete?: () => void): void {
    if (this.collected) return;
    this.collected = true;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    eventBus.emit('sfx:recover_au');
    this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 250,
      ease: 'Power2',
      onComplete,
    });
  }
}
