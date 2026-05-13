import type { FloorId } from '../../../config/gameConfig';
import type { MovingPlatformConfig } from '../../../entities/MovingPlatform';
import type { NpcConfig } from './LevelNpcManager';

export interface RoomElevator {
  x: number;
  minY: number;
  maxY: number;
  startY: number;
}

export interface LevelConfig {
  floorId: FloorId;
  /** Persistent objective shown in HUD while this scene is active. */
  objective?: string;
  platforms: Array<{ x: number; y: number; width: number }>;
  /** Thin catwalks / walkways. */
  catwalks?: Array<{ x: number; y: number; width: number; thickness?: number }>;
  /** Floating platforms that move along a single axis. */
  movingPlatforms?: MovingPlatformConfig[];
  /** Token spawns for this room. */
  tokens: Array<{ x: number; y: number; index?: number }>;
  exitPosition: { x: number; y: number };
  playerStart: { x: number; y: number };
  /** Small in-room elevators connecting platform tiers. */
  roomElevators: RoomElevator[];
  infoPoints?: Array<{
    x: number;
    y: number;
    contentId: string;
    zoneRadius?: number;
    zone?:
      | { shape: 'circle'; radius: number }
      | { shape: 'rect'; width: number; height: number; offsetY?: number };
  }>;
  enemies?: Array<{
    type: 'slime' | 'bot' | 'scope-creep' | 'astronaut' | 'tech-debt-ghost' | 'terrorist';
    x: number;
    y: number;
    minX?: number;
    maxX?: number;
    speed?: number;
  }>;
  /** Friendly NPCs that patrol locally and ask architecture questions on interaction. */
  npcs?: NpcConfig[];
  /** Consumable — not persisted, respawns every scene entry. */
  coffees?: Array<{ x: number; y: number }>;
  /** Energy drink fridges — interact to open for a long caffeine buff; not persisted. */
  fridges?: Array<{ x: number; y: number }>;
  /** Checkpoint positions for mid-floor respawn. */
  checkpoints?: Array<{ x: number; y: number; id: string }>;
}
