import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { defineFloorScene } from '../_shared/defineFloorScene';

/** Token range reserved for this room — must not overlap ProductLeadershipScene (5..9). */
const TOKEN_INDEX_OFFSET = 10;

/**
 * Floor 3 — Customer Success room (right side of the Business floor).
 *
 * Reached by stepping OFF the elevator to the RIGHT at floor 3.
 * Hosts the Customer Success team: SLAs, churn, NPS, renewals — the
 * feedback loop between what customers experience and how the product
 * is actually designed and operated.
 *
 * Shares FloorId BUSINESS with ProductLeadershipScene; uses a disjoint
 * token-index range so collected-token bookkeeping does not collide.
 */
export class CustomerSuccessScene extends defineFloorScene({
  key: 'CustomerSuccessScene',
  floorId: FLOORS.BUSINESS,
  returnSide: 'right',
  config: () => {
    const G = GAME_HEIGHT - TILE_SIZE;
    const off = TOKEN_INDEX_OFFSET;
    return {
      floorId: FLOORS.BUSINESS,
      objective: 'Collect AU and check Customer Success Insights',
      playerStart: { x: 1130, y: G - 100 },
      exitPosition: { x: 1200, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Token indices 10..14 — disjoint from ProductLeadershipScene (5..9).
      tokens: [
        { x: 240,  y: G - 40, index: off + 0 },
        { x: 420,  y: G - 40, index: off + 1 },
        { x: 600,  y: G - 40, index: off + 2 },
        { x: 760,  y: G - 40, index: off + 3 },
        { x: 900,  y: G - 40, index: off + 4 },
      ],

      coffees: [
        { x: 120, y: G - 40 },
      ],

      infoPoints: [
        {
          x: 1050, y: G, contentId: 'customer-success',
          zone: { shape: 'rect', width: 140, height: 220 },
        },
      ],
    };
  },
}) {
  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    this.addAmbientPlants([
      { x: 1180, kind: 'tall' },
      { x: 1120, kind: 'small' },
    ]);

    this.addSignpost({
      x: 1050,
      label: ' CUSTOMER\n  SUCCESS',
      color: '#cfe6ff',
      fontSize: 12,
    });

    // Support desks + dashboards — proxy for ticket queues and SLA boards.
    this.add.image(220, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(380, G - 22, 'monitor_dash').setDepth(3);
    this.add.image(560, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(720, G - 22, 'monitor_dash').setDepth(3);
  }
}
