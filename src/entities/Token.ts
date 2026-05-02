import * as Phaser from 'phaser';
import { getColorBlindPalette } from '../style/theme';
import { settingsStore } from '../systems/SettingsStore';
import { eventBus } from '../systems/EventBus';

export class Token extends Phaser.Physics.Arcade.Sprite {
  private floatTween?: Phaser.Tweens.Tween;
  private haloTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;
  private halo?: Phaser.GameObjects.Image;
  private collected = false;
  /** The texture key of this token, saved so the halo tint can be recalculated. */
  private readonly textureKeyStr: string;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string = 'token') {
    super(scene, x, y, textureKey);
    this.textureKeyStr = textureKey;
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.setDepth(5);

    // Soft halo behind the token — tinted per-texture to match the coin
    // color. Pulses slowly so idle rooms don't feel static.
    if (scene.textures.exists('token_halo')) {
      this.halo = scene.add.image(x, y, 'token_halo').setDepth(4).setAlpha(0.4);
      // Tint halo to match the coin rim for theme cohesion.
      // Floor-tinted tokens keep their baked-in colours; the default gold
      // token respects the active color-blind palette.
      const palette = getColorBlindPalette(settingsStore.read().colorBlindMode);
      const rimTint = textureKey === 'token_floor1' ? 0x95d5b2
        : textureKey === 'token_floor2' ? 0x90e0ef
        : palette.token;
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

    // Refresh the default-token halo tint when the color-blind mode changes
    // (floor-tinted tokens use baked-in colours and don't need updating).
    if (textureKey === 'token') {
      const onSettingsChanged = (): void => { this.refreshHaloTint(); };
      eventBus.on('settings:changed', onSettingsChanged);
      // Auto-unsubscribe when the scene shuts down so no ghost handlers linger.
      scene.events.once('shutdown', () => eventBus.off('settings:changed', onSettingsChanged));
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
    this.pulseTween = scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Keep halo locked to the coin so it tracks the float bob.
    if (this.halo && !this.collected) {
      this.halo.setPosition(this.x, this.y);
    }
  }

  /** Update halo tint to match the current color-blind palette (default token only). */
  private refreshHaloTint(): void {
    if (!this.halo || this.collected) return;
    const palette = getColorBlindPalette(settingsStore.read().colorBlindMode);
    this.halo.setTint(palette.token);
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
    this.pulseTween?.stop();
    // Ensure no leftover idle tweens on `this` fight the collection animation.
    this.scene.tweens.killTweensOf(this);
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
