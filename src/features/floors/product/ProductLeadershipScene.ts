import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';

/**
 * Floor 3 — Product Leadership room (left side of the Business floor).
 *
 * Reached by stepping OFF the elevator to the LEFT at floor 3.
 * Hosts product leadership: roadmaps, OKRs, customer outcomes — the
 * voice the architect must translate into technical direction.
 *
 * Shares FloorId BUSINESS with CustomerSuccessScene; uses disjoint token
 * indices so collected-token bookkeeping does not collide.
 */
export class ProductLeadershipScene extends LevelScene {
  /** First token index used in this room — must not overlap CustomerSuccessScene. */
  private static readonly TOKEN_INDEX_OFFSET = 5;

  constructor() {
    super('ProductLeadershipScene', FLOORS.BUSINESS);
    this.returnSide = 'left';
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    this.addAmbientPlants([
      { x: 90, kind: 'tall' },
      { x: 160, kind: 'small' },
    ]);

    this.addSignpost({
      x: 230,
      label: '  PRODUCT\nLEADERSHIP',
      color: '#ffd6f0',
      fontSize: 12,
    });

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
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Token indices 5..9 — disjoint from CustomerSuccessScene (10..14).
      tokens: [
        { x: 400,  y: G - 40, index: off + 0 },
        { x: 540,  y: G - 40, index: off + 1 },
        { x: 680,  y: G - 40, index: off + 2 },
        { x: 860,  y: G - 40, index: off + 3 },
        { x: 1040, y: G - 40, index: off + 4 },
      ],

      coffees: [
        { x: 1180, y: G - 40 },
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
