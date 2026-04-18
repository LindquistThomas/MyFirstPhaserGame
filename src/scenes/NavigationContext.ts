import type { FloorId } from '../config/gameConfig';

/**
 * Typed hand-off between scenes.
 *
 * Previously, scenes passed whatever fields they needed as anonymous
 * objects to `scene.start(key, data)` (or wrote them onto the global
 * `scene.registry`). That produced a scattered contract: each scene
 * invented its own field names (`returnFromFloor`, `returnFromSide`,
 * `returnFromProductDoor`, `fromDoor`, `loadSave`) and there was no
 * single place to document the full transition API.
 *
 * `NavigationContext` collects every known field. Scenes consume only
 * the ones that apply to them; everything is optional. A missing field
 * means "no hint — use defaults."
 *
 * Rules for adding a new field:
 *   1. Add it here (not on a per-scene data type).
 *   2. Document the producer (who sets it) and consumer (who reads it).
 *   3. Keep it optional so old transitions remain valid.
 */
export interface NavigationContext {
  /**
   * The floor the player just left.
   * Producer: `LevelScene.returnToElevator`.
   * Consumer: `ElevatorScene` (spawns the cab at the correct floor
   * and suppresses immediate re-entry of the floor the player just
   * exited).
   */
  fromFloor?: FloorId;

  /**
   * The side of the shaft the player should spawn on when returning
   * to the elevator — `left` or `right`.
   * Producer: `LevelScene.returnToElevator`.
   * Consumer: `ElevatorScene` initial player placement.
   */
  spawnSide?: 'left' | 'right';

  /**
   * The product-hall door id the player returned through, if any.
   * Producer: `ProductRoomScene.exitToElevator`.
   * Consumer: `ElevatorScene` (spawn the player next to that door on
   * the PRODUCTS floor of the shaft).
   */
  spawnDoorId?: string;

  /**
   * `MenuScene → ElevatorScene` only. When `true`, the progression
   * system loads the saved slot; when `false`, it resets. Omitted
   * on intra-gameplay transitions.
   */
  loadSave?: boolean;
}

/**
 * Start a scene with a typed navigation context.
 *
 * Convenience wrapper so call sites don't have to repeat the
 * `scene.start(key, ctx as NavigationContext)` cast; exported as a
 * helper function rather than a plugin to avoid adding yet another
 * Phaser plugin.
 */
export function startSceneWithContext(
  scene: Phaser.Scene,
  key: string,
  context: NavigationContext = {},
): void {
  scene.scene.start(key, context);
}
