import * as Phaser from 'phaser';

export class Token extends Phaser.Physics.Arcade.Sprite {
  private floatTween?: Phaser.Tweens.Tween;
  private haloTween?: Phaser.Tweens.Tween;
  private halo?: Phaser.GameObjects.Image;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string = 'token') {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.setDepth(5);

    // Soft halo behind the token — tinted per-texture to match the coin
    // color. Pulses slowly so idle rooms don't feel static.
    if (scene.textures.exists('token_halo')) {
      this.halo = scene.add.image(x, y, 'token_halo').setDepth(4).setAlpha(0.4);
      // Tint halo to match the coin rim for theme cohesion.
      const rimTint = textureKey === 'token_floor1' ? 0x95d5b2
        : textureKey === 'token_floor2' ? 0x90e0ef
        : 0xffd700;
      this.halo.setTint(rimTint);
      this.haloTween = scene.tweens.add({
        targets: this.halo,
        alpha: { from: 0.25, to: 0.55 },
        scale: { from: 0.9, to: 1.1 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

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
    this.haloTween?.stop();
    if (this.halo) {
      const halo = this.halo;
      this.scene.tweens.add({
        targets: halo,
        alpha: 0,
        scale: 1.6,
        duration: 250,
        onComplete: () => halo.destroy(),
      });
      this.halo = undefined;
    }

    // Collection animation — squash-out with a brief vertical lift, reads
    // as the coin being "sucked up" rather than just fading in place.
    this.scene.tweens.add({
      targets: this,
      y: this.y - 18,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 0.6,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
