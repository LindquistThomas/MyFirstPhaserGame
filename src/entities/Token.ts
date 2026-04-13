import * as Phaser from 'phaser';

export class Token extends Phaser.Physics.Arcade.Sprite {
  private floatTween?: Phaser.Tweens.Tween;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string = 'token') {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.setDepth(5);

    // Floating animation
    this.floatTween = scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Subtle scale pulse
    scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;

    // Disable physics body immediately to prevent duplicate overlap callbacks
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    this.floatTween?.stop();

    // Collection animation
    this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
