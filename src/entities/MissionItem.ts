import * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';

export type MissionItemId = 'pistol' | 'keycard' | 'bomb_code';

const TEXTURE_MAP: Record<MissionItemId, string> = {
  pistol:    'item_pistol',
  keycard:   'item_keycard',
  bomb_code: 'item_bomb_code',
};

/**
 * Collectible mission item used in the F4 hostage rescue sequence.
 *
 * Static physics body (doesn't fall). A gentle pulse tween draws the player's
 * attention. Emits `sfx:item_pickup` and calls `onCollect` when the player
 * overlaps — the scene is responsible for wiring the overlap collider.
 */
export class MissionItem extends Phaser.Physics.Arcade.Sprite {
  readonly itemId: MissionItemId;
  private collected = false;
  private onCollectCb: (id: MissionItemId) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    itemId: MissionItemId,
    onCollect: (id: MissionItemId) => void,
  ) {
    super(scene, x, y, TEXTURE_MAP[itemId]);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // true = static body
    this.setDepth(5);

    this.itemId = itemId;
    this.onCollectCb = onCollect;

    // Gentle float+pulse to draw attention.
    scene.tweens.add({
      targets: this,
      y: y - 6,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Called by the scene's overlap callback when player touches this item. */
  collect(): void {
    if (this.collected) return;
    this.collected = true;
    eventBus.emit('sfx:item_pickup');
    this.scene?.tweens.add({
      targets: this,
      y: this.y - 24,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
    this.onCollectCb(this.itemId);
  }
}
