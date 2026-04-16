import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../config/gameConfig';
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

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 220;
    const T2 = G - 440;
    const T3 = G - 660;

    // Ground floor — server room feel
    this.add.image(500, G - 50, 'server_rack').setDepth(3);
    this.add.image(560, G - 50, 'server_rack').setDepth(3);
    this.add.image(620, G - 10, 'router').setDepth(3);
    this.add.image(750, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(500, G - 10, 'cables').setDepth(1);

    // Tier 1 — workstations
    this.add.image(700, T1 - 36, 'desk_monitor').setDepth(3);
    this.add.image(900, T1 - 22, 'monitor_dash').setDepth(3);
    this.add.image(1000, T1 - 10, 'router').setDepth(3);

    // Tier 2 — monitoring station
    this.add.image(250, T2 - 22, 'monitor_dash').setDepth(3);
    this.add.image(850, T2 - 50, 'server_rack').setDepth(3);
    this.add.image(850, T2 - 10, 'cables').setDepth(1);

    // Tier 3 — top level ops
    this.add.image(600, T3 - 36, 'desk_monitor').setDepth(11);
    this.add.image(750, T3 - 22, 'monitor_dash').setDepth(3);
    this.add.image(1000, T3 - 50, 'server_rack').setDepth(3);
    this.add.image(1060, T3 - 10, 'router').setDepth(3);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;  // ground (full tile visible)
    const T1 = G - 220;                 // tier 1
    const T2 = G - 440;                 // tier 2
    const T3 = G - 660;                 // tier 3 (top)

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
        // Room elevator is 12 px tall; center = surface + 6 aligns top with surface
        { x: 460, minY: T3 + 6, maxY: G + 6, startY: G + 6 },
        // Right elevator: connects tier 1 to tier 3
        { x: 1100, minY: T3 + 6, maxY: T1 + 6, startY: T1 + 6 },
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
