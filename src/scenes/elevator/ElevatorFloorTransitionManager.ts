import * as Phaser from 'phaser';
import { GAME_WIDTH, FLOORS, FloorId } from '../../config/gameConfig';
import { LEVEL_DATA } from '../../config/levelData';
import { Player } from '../../entities/Player';
import { ProgressionSystem } from '../../systems/ProgressionSystem';

const ARCHITECTURE_TEAM_SCENE_KEY = 'ArchitectureTeamScene';
const PRODUCT_LEADERSHIP_SCENE_KEY = 'ProductLeadershipScene';
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
  /**
   * Invoked when the player steps onto a floor platform. Side is which
   * side of the shaft they stepped off (used by floor split rules).
   */
  onEnterFloor: (floorId: FloorId, side: 'left' | 'right') => void;
}

/**
 * Encapsulates the "player steps off the cab onto a floor" rule set,
 * including the left/right split on F1 (Platform/Architecture) and F3
 * (Finance/Product Leadership). Also computes the initial player spawn
 * given a NavigationContext hint (fromFloor + spawnSide).
 */
export class ElevatorFloorTransitionManager {
  /** Suppress immediate re-entry of the floor the player just returned from. */
  private skipFloorEntry?: FloorId;

  constructor(private readonly deps: FloorTransitionDeps) {}

  setSkipFloorEntry(floorId: FloorId | undefined): void {
    this.skipFloorEntry = floorId;
  }

  /** Clear the skip-floor guard once the player is back on the cab. */
  clearSkipWhenBackOnElevator(): void {
    if (this.skipFloorEntry !== undefined && this.deps.isPlayerOnElevator()) {
      this.skipFloorEntry = undefined;
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

    for (const [floorId, floorY] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue;
      // PRODUCTS floor uses explicit doors — no auto-transition on walk.
      if (fId === FLOORS.PRODUCTS) continue;
      if (fId === this.skipFloorEntry) continue;

      const walkingSurface = floorY + this.deps.floorHeight;
      if (Math.abs(bodyBottom - walkingSurface) < FLOOR_DETECTION_TOLERANCE) {
        if (this.deps.progression.isFloorUnlocked(fId)) {
          const side: 'left' | 'right' = px < GAME_WIDTH / 2 ? 'left' : 'right';
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
    if (floorId === FLOORS.BUSINESS && side === 'right') {
      return PRODUCT_LEADERSHIP_SCENE_KEY;
    }
    return fd.sceneKey;
  }
}
