import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';

/**
 * Floor 3 — Finance room (left side of the Business floor).
 *
 * Reached by stepping OFF the elevator to the LEFT at floor 3.
 * Hosts the Finance team: budgets, forecasts, ROI, and the unit
 * economics that ultimately fund the engine room.
 *
 * A sibling scene `ProductLeadershipScene` hosts the Product Leadership
 * room on the right; both share FloorId BUSINESS and use disjoint
 * token-index ranges.
 */
export class FinanceTeamScene extends LevelScene {
  constructor() {
    super('FinanceTeamScene', FLOORS.BUSINESS);
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Plants flanking the room
    this.add.image(90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(160, G - 32, 'plant_small').setDepth(11);

    // Finance signpost — greets the player on entry.
    this.add.image(260, G - 60, 'info_board').setDepth(3);
    this.add.text(260, G - 130, '  FINANCE\n   TEAM', {
      fontFamily: 'monospace', fontSize: '13px', color: '#b8ffd1',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // Trading-desk style monitors — proxy for FP&A dashboards.
    this.add.image(560, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(720, G - 22, 'monitor_dash').setDepth(3);
    this.add.image(900, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(1080, G - 22, 'monitor_dash').setDepth(3);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;

    return {
      floorId: FLOORS.BUSINESS,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Token indices 0..4 — disjoint from ProductLeadershipScene (5..).
      tokens: [
        { x: 400,  y: G - 40 },
        { x: 540,  y: G - 40 },
        { x: 680,  y: G - 40 },
        { x: 860,  y: G - 40 },
        { x: 1040, y: G - 40 },
      ],

      infoPoints: [
        {
          x: 260, y: G, contentId: 'finance',
          zone: { shape: 'rect', width: 140, height: 220 },
        },
      ],
    };
  }
}
