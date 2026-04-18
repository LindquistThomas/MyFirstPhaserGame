import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

/**
 * Floor 4 — Executive Suite (penthouse).
 *
 * The top of the elevator shaft in Hohpe's metaphor: strategy, vision,
 * and organizational direction. Lighter on platforms than the engine-room
 * floors below, with a single info point exploring the penthouse role.
 */
export class Floor4Scene extends LevelScene {
  constructor() {
    super('Floor4Scene', FLOORS.EXECUTIVE);
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Penthouse plants flanking the executive lounge.
    this.add.image(110, G - 40, 'plant_tall').setDepth(3);
    this.add.image(220, G - 32, 'plant_small').setDepth(11);
    this.add.image(1180, G - 40, 'plant_tall').setDepth(3);
    this.add.image(1060, G - 32, 'plant_small').setDepth(11);

    // Executive signpost — greets the player on entry.
    this.add.image(380, G - 60, 'info_board').setDepth(3);
    this.add.text(380, G - 130, 'EXECUTIVE\n   SUITE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffd700',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // Strategy desk in the centre.
    this.add.image(720, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(880, G - 22, 'monitor_dash').setDepth(3);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 240;

    return {
      floorId: FLOORS.EXECUTIVE,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        // Ground spans the whole room.
        { x: 0, y: G, width: 10 },
        // A single mezzanine for the strategy lounge.
        { x: 384, y: T1, width: 4 },
      ],

      roomElevators: [
        // One in-room lift up to the mezzanine.
        { x: 280, minY: T1 + 6, maxY: G + 6, startY: G + 6 },
      ],

      tokens: [
        { x: 500,  y: G - 40 },
        { x: 720,  y: G - 40 },
        { x: 920,  y: G - 40 },
        { x: 460,  y: T1 - 40 },
        { x: 600,  y: T1 - 40 },
        { x: 740,  y: T1 - 40 },
      ],

      infoPoints: [
        {
          x: 380, y: G, contentId: 'executive-suite',
          zone: { shape: 'rect', width: 160, height: 220 },
        },
      ],
    };
  }
}
