import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, FLOORS } from '../../config/gameConfig';
import { LevelScene, LevelConfig } from '../LevelScene';
import { allKeyLabels } from '../../input';

export interface ProductRoomDecoration {
  x: number;
  /** Vertical offset above the ground tile top. */
  yOffset: number;
  spriteKey: string;
  depth?: number;
}

export interface ProductRoomConfig {
  /** Phaser scene key ΓÇö must be unique. */
  sceneKey: string;
  /** Info content ID ΓÇö also used as the door identifier in Floor3ProductsScene. */
  contentId: string;
  /** Big title shown on the room signpost. */
  title: string;
  /** Signpost text colour (hex CSS string). */
  titleColor: string;
  /** Floor tint applied to the room (override of theme background). */
  backgroundTint?: number;
  /** Themed decorations placed on the ground row. */
  decorations: ProductRoomDecoration[];
}

/**
 * A self-contained room dedicated to a single product. Reached from
 * the Products hall (`Floor3ProductsScene`) by walking through the
 * matching door and pressing Space/Enter.
 *
 * Same `FLOORS.PRODUCTS` is reused for all product rooms ΓÇö token
 * collection state is shared but no rooms define tokens, so there is
 * no collision risk.
 */
export class ProductRoomScene extends LevelScene {
  private readonly cfg: ProductRoomConfig;

  constructor(cfg: ProductRoomConfig) {
    super(cfg.sceneKey, FLOORS.PRODUCTS);
    this.cfg = cfg;
  }

  protected override createBackground(): void {
    super.createBackground();
    if (this.cfg.backgroundTint !== undefined) {
      const overlay = this.add.graphics().setDepth(0);
      overlay.fillStyle(this.cfg.backgroundTint, 0.25);
      overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Plants flanking the entry on both sides for a "room" feel.
    this.add.image(90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(160, G - 32, 'plant_small').setDepth(11);
    this.add.image(GAME_WIDTH - 90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(GAME_WIDTH - 160, G - 32, 'plant_small').setDepth(11);

    // Title signpost ΓÇö establishes which product room we're in.
    this.add.image(260, G - 60, 'info_board').setDepth(3);
    this.add.text(260, G - 130, this.cfg.title, {
      fontFamily: 'monospace', fontSize: '12px', color: this.cfg.titleColor,
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    for (const d of this.cfg.decorations) {
      this.add.image(d.x, G + d.yOffset, d.spriteKey).setDepth(d.depth ?? 3);
    }
  }

  protected override getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;

    return {
      floorId: FLOORS.PRODUCTS,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],
      tokens: [],

      infoPoints: [
        {
          x: 260, y: G, contentId: this.cfg.contentId,
          zone: { shape: 'rect', width: 160, height: 220 },
        },
      ],
    };
  }

  /**
   * Return to the hub ΓÇö product doors now live directly on the PRODUCTS
   * floor in HubScene, so we go back there and tell HubScene which door
   * to respawn next to.
   */
  protected override returnToHub(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () =>
      this.scene.start('HubScene', { returnFromProductDoor: this.cfg.contentId }),
    );
  }

  /** Customise the exit prompt to match what's actually on the other side. */
  protected override checkExitProximity(): void {
    const d = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y,
      this.exitDoor.x, this.exitDoor.y,
    );
    if (d < 90) {
      this.interactPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 Products Hall`).setPosition(
        this.exitDoor.x - 60, this.exitDoor.y - 90,
      ).setVisible(true);
      if (this.inputs.justPressed('Interact')) this.returnToHub();
    } else {
      this.interactPrompt?.setVisible(false);
    }
  }
}
