import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

/**
 * Floor 3 — Product Leadership room (right side of the Business floor).
 *
 * Reached by stepping OFF the elevator to the RIGHT at floor 3.
 * Hosts product leadership: roadmaps, OKRs, customer outcomes — the
 * voice the architect must translate into technical direction.
 *
 * Shares FloorId BUSINESS with FinanceTeamScene; uses disjoint token
 * indices so collected-token bookkeeping does not collide.
 */
export class ProductLeadershipScene extends LevelScene {
  /** First token index used in this room — must not overlap FinanceTeamScene. */
  private static readonly TOKEN_INDEX_OFFSET = 5;

  constructor() {
    super('ProductLeadershipScene', FLOORS.BUSINESS);
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Plants flanking the room
    this.add.image(90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(160, G - 32, 'plant_small').setDepth(11);

    // Product Leadership signpost — greets the player on entry.
    this.add.image(230, G - 60, 'info_board').setDepth(3);
    this.add.text(230, G - 130, '  PRODUCT\nLEADERSHIP', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffd6f0',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // Roadmap wall + workstations.
    this.add.image(560, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(720, G - 22, 'monitor_dash').setDepth(3);
    this.add.image(900, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(1080, G - 22, 'monitor_dash').setDepth(3);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;
    const off = ProductLeadershipScene.TOKEN_INDEX_OFFSET;

    return {
      floorId: FLOORS.BUSINESS,
      playerStart: { x: 1130, y: G - 100 },
      exitPosition: { x: 1200, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Token indices 5..9 — disjoint from FinanceTeamScene (0..4).
      tokens: [
        { x: 400,  y: G - 40, index: off + 0 },
        { x: 540,  y: G - 40, index: off + 1 },
        { x: 680,  y: G - 40, index: off + 2 },
        { x: 860,  y: G - 40, index: off + 3 },
        { x: 1040, y: G - 40, index: off + 4 },
      ],

      infoPoints: [
        {
          x: 230, y: G, contentId: 'product-leadership',
          zone: { shape: 'rect', width: 140, height: 220 },
        },
      ],
    };
  }
}
