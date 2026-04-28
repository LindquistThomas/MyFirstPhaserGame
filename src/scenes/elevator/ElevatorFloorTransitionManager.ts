import * as Phaser from 'phaser';
import { GAME_WIDTH, FLOORS, FloorId } from '../../config/gameConfig';
import { LEVEL_DATA } from '../../config/levelData';
import { Player } from '../../entities/Player';
import { ProgressionSystem } from '../../systems/ProgressionSystem';

const ARCHITECTURE_TEAM_SCENE_KEY = 'ArchitectureTeamScene';
const PRODUCT_LEADERSHIP_SCENE_KEY = 'ProductLeadershipScene';
const CUSTOMER_SUCCESS_SCENE_KEY = 'CustomerSuccessScene';
const FLOOR_DETECTION_TOLERANCE = 18;

export interface FloorTransitionDeps {
  scene: Phaser.Scene;
  progression: ProgressionSystem;
  player: Player;
  shaftWidth: number;
  /** Absolute Y (top of slab) keyed by FloorId. */
  floorYPositions: Record<number, number>;
  /** Height of one floor slab in pixels. */
  floorHeight: number;
  /** True while the player is standing on the elevator cab. */
  isPlayerOnElevator: () => boolean;
  /** Floor the cab is currently docked at (null while moving). */
  getCabDockedFloor: () => number | null;
  /**
   * Invoked when the player steps onto a floor platform. Side is which
   * side of the shaft they stepped off (used by floor split rules).
   */
  onEnterFloor: (floorId: FloorId, side: 'left' | 'right') => void;
  /**
   * Optional predicate: returning true suppresses auto-transition for that
   * floor/side. Used to keep the player in the elevator scene when they're
   * standing in an NPC proximity zone (e.g. Geir Harald on F4).
   */
  isFloorEntryBlocked?: (floorId: FloorId, side: 'left' | 'right') => boolean;
}

/**
 * Encapsulates the "player steps off the cab onto a floor" rule set,
 * including the left/right split on F1 (Platform/Architecture) and F3
 * (Finance/Product Leadership), and resolves the scene key for a
 * floor/side combination.
 */
export class ElevatorFloorTransitionManager {
  /** Floor the player just returned from; its re-entry is suppressed. */
  private skipFloorEntry?: FloorId;
  /** Side of the shaft the player returned on; restricts the skip to that side. */
  private skipFloorSide?: 'left' | 'right';

  constructor(private readonly deps: FloorTransitionDeps) {}

  setSkipFloorEntry(floorId: FloorId | undefined, side?: 'left' | 'right'): void {
    this.skipFloorEntry = floorId;
    this.skipFloorSide = floorId === undefined ? undefined : side;
  }

  /**
   * Clear the skip-floor guard once the player has ridden the cab away from
   * the floor they just returned from.
   *
   * Two conditions must both be true before the guard is lifted:
   *  1. The player is currently on the elevator (they've boarded).
   *  2. The cab is docked at a different floor than the one being skipped.
   *
   * Requiring the player to be on board prevents the guard from being
   * wiped by the elevator's own auto-descend logic (no rider → cab drifts
   * downward and leaves the 12 px dock tolerance within ~5 frames), which
   * was the original source of the looping re-entry bug: the guard was
   * cleared before the player could even move, so checkFloorEntry()
   * immediately re-triggered the transition they had just exited.
   *
   * Keeping the guard armed while the cab is still docked at that floor
   * also prevents a bounce when the player brushes the cab tolerance zone
   * and steps back onto the floor walking surface — the on-elevator latch
   * can engage while the player is still on the floor (cab top sits 8 px
   * below the walking surface), so using the latch alone to clear the
   * guard was too eager.
   */
  clearSkipWhenBackOnElevator(): void {
    if (this.skipFloorEntry === undefined) return;
    if (!this.deps.isPlayerOnElevator()) return;
    const cabFloor = this.deps.getCabDockedFloor();
    if (cabFloor !== this.skipFloorEntry) {
      this.skipFloorEntry = undefined;
      this.skipFloorSide = undefined;
    }
  }

  /** Detect player stepping onto a floor platform (not elevator, not lobby). */
  checkFloorEntry(): void {
    if (this.deps.isPlayerOnElevator()) return;

    const body = this.deps.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down) return;

    const px = this.deps.player.sprite.x;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;

    if (px > cx - sw / 2 + 20 && px < cx + sw / 2 - 20) return;

    const positions = this.deps.floorYPositions;
    const bodyBottom = body.bottom;
    const side: 'left' | 'right' = px < cx ? 'left' : 'right';

    for (const [floorId, floorY] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue;
      // PRODUCTS floor uses explicit doors — no auto-transition on walk.
      if (fId === FLOORS.PRODUCTS) continue;
      // Skip re-entry only on the same side the player returned from; the
      // other side of a split floor (e.g. Architecture when returning from
      // Platform) is a different scene and remains enterable.
      if (fId === this.skipFloorEntry && side === this.skipFloorSide) continue;

      const walkingSurface = floorY + this.deps.floorHeight;
      if (Math.abs(bodyBottom - walkingSurface) < FLOOR_DETECTION_TOLERANCE) {
        if (this.deps.progression.isFloorUnlocked(fId)) {
          if (this.deps.isFloorEntryBlocked?.(fId, side)) return;
          this.deps.onEnterFloor(fId, side);
          return;
        }
      }
    }
  }

  /**
   * Resolve the scene key for a floor + side combo and return it. Callers
   * drive the actual scene transition (fade + start) so they can stay in
   * control of isTransitioning flags.
   */
  static resolveSceneKey(floorId: FloorId, side: 'left' | 'right'): string {
    const fd = LEVEL_DATA[floorId];
    if (floorId === FLOORS.PLATFORM_TEAM && side === 'right') {
      return ARCHITECTURE_TEAM_SCENE_KEY;
    }
    if (floorId === FLOORS.BUSINESS) {
      return side === 'right' ? CUSTOMER_SUCCESS_SCENE_KEY : PRODUCT_LEADERSHIP_SCENE_KEY;
    }
    return fd.sceneKey;
  }
}
