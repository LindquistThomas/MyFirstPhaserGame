import * as Phaser from 'phaser';

/**
 * Duration of the caffeine buff granted by the energy drink fridge.
 * Twice coffee's {@link CAFFEINE_DURATION_MS} (6 s) for a stronger effect.
 */
export const ENERGY_DRINK_DURATION_MS = 12000;

/**
 * An energy drink fridge the player can open once per scene visit.
 *
 * Renders as a static prop; switching the texture to `fridge_open` is the
 * only visual change. The fridge does not participate in physics — the
 * owning {@link LevelFridgeManager} handles proximity detection and the
 * interact key.
 */
export class EnergyDrinkFridge extends Phaser.GameObjects.Image {
  private _opened = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'fridge_closed');
    scene.add.existing(this);
    this.setDepth(5).setOrigin(0.5, 1);
  }

  get opened(): boolean {
    return this._opened;
  }

  /** Switch to the open texture and mark as used. */
  open(): void {
    if (this._opened) return;
    this._opened = true;
    this.setTexture('fridge_open');
  }
}
