/**
 * Shared level-configuration types for `LevelScene` and all floor scenes.
 *
 * Exported separately from `LevelScene.ts` so the types stay accessible via
 * `import type { LevelConfig } from './LevelConfig'` without pulling in the
 * full scene class.  `LevelScene.ts` re-exports everything from here so
 * existing call-sites (`import type { LevelConfig } from './LevelScene'`)
 * continue to work without modification.
 */

import type { FloorId } from '../../../config/gameConfig';
import type { MovingPlatformConfig } from '../../../entities/MovingPlatform';

export interface RoomElevator {
  x: number;
  minY: number;
  maxY: number;
  startY: number;
}

export interface LevelConfig {
  floorId: FloorId;
  platforms: Array<{ x: number; y: number; width: number }>;
  /**
   * Thin catwalks / walkways.
   *
   * Unlike `platforms` (which use the 128×128 floor tile as both visual
   * and physics body — great for the ground, terrible for mezzanines
   * because the tile body extends 128 px downward and crushes the
   * headroom beneath), catwalks are a ~20 px thin rectangle with a
   * matching graphic on top. Use these for any floating walkway.
   *
   * `x`, `y` = top-left of the walking surface (same semantics as
   * `platforms.y` — the top of the slab, not its centre). `width` is in
   * pixels. `thickness` defaults to 20.
   */
  catwalks?: Array<{ x: number; y: number; width: number; thickness?: number }>;
  /**
   * Floating platforms that move along a single axis. Unlike catwalks
   * (static) and room elevators (player-driven), these travel under their
   * own steam, ferrying the player between tiers. See {@link MovingPlatform}
   * for the semantics of each mode — `bounce` = velocity bouncer,
   * `tween` = smoothed ease-in-out path.
   */
  movingPlatforms?: MovingPlatformConfig[];
  /**
   * Tokens in the room. `index` overrides the default array-position
   * index used to key into the ProgressionSystem's collected-tokens
   * state. Useful when two scenes share the same floorId and need
   * disjoint token-index ranges.
   */
  tokens: Array<{ x: number; y: number; index?: number }>;
  exitPosition: { x: number; y: number };
  playerStart: { x: number; y: number };
  /** Small in-room elevators connecting platform tiers. */
  roomElevators: RoomElevator[];
  /**
   * Info zones placed in the level.
   * Each zone shows its icon and allows its dialog to open only when the
   * player is within the zone shape. Default: 120 px circle.
   *
   * Prefer `zone` for precise anchor-sized regions (e.g. a signpost or
   * monitoring wall). `zoneRadius` is kept for simple back-compat.
   */
  infoPoints?: Array<{
    x: number;
    y: number;
    contentId: string;
    zoneRadius?: number;
    zone?:
      | { shape: 'circle'; radius: number }
      | { shape: 'rect'; width: number; height: number; offsetY?: number };
  }>;
  /**
   * Enemies placed in the level. Each entry is spawned in `createEnemies()`.
   * Enemies are scene-local: they have no persistence, respawn on scene re-entry.
   * `minX` / `maxX` default to ±radius around `x`.
   */
  enemies?: Array<{
    type: 'slime' | 'bot' | 'scope-creep' | 'astronaut' | 'tech-debt-ghost' | 'terrorist';
    x: number;
    y: number;
    minX?: number;
    maxX?: number;
    speed?: number;
  }>;
  /** Consumable — not persisted, respawns every scene entry. */
  coffees?: Array<{ x: number; y: number }>;
  /** Energy drink fridges — interact to open for a long caffeine buff; not persisted. */
  fridges?: Array<{ x: number; y: number }>;
  /**
   * Checkpoint positions for mid-floor respawn.
   * Scene-local — not persisted; resets on scene re-entry.
   * Player activating a checkpoint records its position as the respawn origin.
   * Placed by the floor scene's `getLevelConfig()` override.
   */
  checkpoints?: Array<{ x: number; y: number; id: string }>;
}
