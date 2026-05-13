import * as Phaser from 'phaser';
import { getColorBlindPalette } from '../style/theme';
import { settingsStore } from '../systems/SettingsStore';
import { eventBus } from '../systems/EventBus';
import { shouldSkipTween, reducedDuration } from '../systems/motionTween';

export class Token extends Phaser.Physics.Arcade.Sprite {
  private floatTween?: Phaser.Tweens.Tween;
  private haloTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;
  private halo?: Phaser.GameObjects.Image;
  private collected = false;
  /** Stored so the handler can be removed when the token is collected/destroyed. */
  private settingsChangedHandler?: () => void;

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
      // Floor-tinted tokens keep their baked-in colours; the default gold
      // token respects the active color-blind palette.
      const palette = getColorBlindPalette(settingsStore.read().colorBlindMode);
      const rimTint = textureKey === 'token_floor1' ? 0x95d5b2
        : textureKey === 'token_floor2' ? 0x90e0ef
        : palette.token;
      this.halo.setTint(rimTint);
      if (!shouldSkipTween()) {
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

      // Only the default gold token needs live palette refresh — floor tokens
      // use baked-in per-floor colours. Subscribe here so there is no handler
      // when the halo texture was never loaded (no halo to update).
      if (textureKey === 'token') {
        const handler = (): void => { this.refreshHaloTint(); };
        this.settingsChangedHandler = handler;
        eventBus.on('settings:changed', handler);
        // Also unsubscribe when the scene shuts down in case collect() is
        // never called (e.g. player leaves the floor before collecting).
        scene.events.once('shutdown', () => eventBus.off('settings:changed', handler));
      }
    }

    // Floating animation
    if (!shouldSkipTween()) {
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

    // Unsubscribe the settings:changed handler immediately so a collected
    // (but not yet GC'd) token no longer holds a reference in EventBus.
    if (this.settingsChangedHandler) {
      eventBus.off('settings:changed', this.settingsChangedHandler);
    }

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
        duration: reducedDuration(250, 100),
        onComplete: () => halo.destroy(),
      });
      this.halo = undefined;
    }

    // Collection animation — squash-out with a brief vertical lift, reads
    // as the coin being "sucked up" rather than just fading in place.
    const reduceMotion = shouldSkipTween();
    this.scene.tweens.add({
      targets: this,
      y: reduceMotion ? this.y : this.y - 18,
      alpha: 0,
      scaleX: reduceMotion ? 1 : 1.4,
      scaleY: reduceMotion ? 1 : 0.6,
      duration: reducedDuration(220, 50),
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
