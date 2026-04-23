import * as Phaser from 'phaser';

/**
 * Collectible coffee mug. Consumable — not persisted, respawns every
 * time the scene is re-entered. Visual contract mirrors {@link Token}:
 * idle float + pulse, soft halo behind, squash-out on collect.
 */
export class Coffee extends Phaser.Physics.Arcade.Sprite {
  private floatTween?: Phaser.Tweens.Tween;
  private haloTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;
  private steam?: Phaser.GameObjects.Image;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'coffee_mug');
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.setDepth(5);

    // Steam halo — positioned above the mug so it reads as rising vapor
    // rather than a glow around the cup itself.
    if (scene.textures.exists('coffee_steam')) {
      this.steam = scene.add
        .image(x, y - 22, 'coffee_steam')
        .setDepth(4)
        .setAlpha(0.55)
        .setTint(0xe8d8c0);
      this.haloTween = scene.tweens.add({
        targets: this.steam,
        alpha: { from: 0.35, to: 0.65 },
        y: { from: y - 22, to: y - 30 },
        scale: { from: 0.9, to: 1.15 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.floatTween = scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this.pulseTween = scene.tweens.add({
      targets: this,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 700,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Steam floats above the bobbing mug — keep horizontal x tracking but
    // let the halo y-tween drive vertical motion so it doesn't jitter.
    if (this.steam && !this.collected) {
      this.steam.setX(this.x);
    }
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    this.floatTween?.stop();
    this.haloTween?.stop();
    this.pulseTween?.stop();
    this.scene.tweens.killTweensOf(this);

    if (this.steam) {
      const steam = this.steam;
      this.scene.tweens.add({
        targets: steam,
        alpha: 0,
        y: steam.y - 16,
        scale: 1.6,
        duration: 280,
        onComplete: () => steam.destroy(),
      });
      this.steam = undefined;
    }

    this.scene.tweens.add({
      targets: this,
      y: this.y - 22,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.7,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
