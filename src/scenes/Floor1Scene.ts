import { GAME_HEIGHT, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

/**
 * Floor 1 — Platform Team.
 *
 * Single-screen room (Impossible Mission style) with multiple platform
 * tiers connected by two in-room elevators.
 */
export class Floor1Scene extends LevelScene {
  constructor() {
    super('Floor1Scene', FLOORS.PLATFORM_TEAM);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - 64;  // ground
    const T1 = G - 220;          // tier 1
    const T2 = G - 440;          // tier 2
    const T3 = G - 660;          // tier 3 (top)

    return {
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        // Ground floor — full width
        { x: 0, y: G, width: 10 },

        // Tier 1 — two platforms with a gap for elevator
        { x: 0, y: T1, width: 3 },
        { x: 640, y: T1, width: 5 },

        // Tier 2 — offset platforms
        { x: 128, y: T2, width: 4 },
        { x: 768, y: T2, width: 3 },

        // Tier 3 — top platforms
        { x: 0, y: T3, width: 3 },
        { x: 512, y: T3, width: 4 },
        { x: 896, y: T3, width: 3 },
      ],

      roomElevators: [
        // Left elevator: connects ground to tier 3
        { x: 460, minY: T3, maxY: G - 8, startY: G - 8 },
        // Right elevator: connects tier 1 to tier 3
        { x: 1100, minY: T3, maxY: T1 - 8, startY: T1 - 8 },
      ],

      tokens: [
        // Ground level
        { x: 900, y: G - 40 },
        // Tier 1
        { x: 200, y: T1 - 40 },
        { x: 850, y: T1 - 40 },
        // Tier 2
        { x: 350, y: T2 - 40 },
        { x: 920, y: T2 - 40 },
        // Tier 3
        { x: 150, y: T3 - 40 },
        { x: 700, y: T3 - 40 },
        { x: 1050, y: T3 - 40 },
      ],

      infoPoints: [
        { x: 300, y: G, contentId: 'platform-engineering' },
      ],
    };
  }
}
