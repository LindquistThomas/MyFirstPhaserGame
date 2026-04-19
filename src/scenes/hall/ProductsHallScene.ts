import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, FLOORS } from '../../config/gameConfig';
import { allKeyLabels } from '../../input';
import { LevelScene, LevelConfig } from '../../features/floors/_shared/LevelScene';
import { theme } from '../../style/theme';

interface ProductDoor {
  x: number;
  label: string;
  /** Info content ID — also the door identifier and the target scene's contentId. */
  contentId: string;
  /** Phaser scene key the door opens into. */
  sceneKey: string;
}

/**
 * Products floor — a long hall lined with a door for each ISY product.
 *
 * Each door opens into a dedicated product room scene. Walk up to a
 * door. Walk up to a door and press Enter — or tap/click it — to enter;
 * the room's exit door returns the player
 * to this hall, respawning next to the door they came through.
 */
export class ProductsHallScene extends LevelScene {
  private static readonly DOORS: ProductDoor[] = [
    { x: 280,  label: 'ISY Project Controls', contentId: 'product-isy-project-controls', sceneKey: 'ProductIsyProjectControlsScene' },
    { x: 540,  label: 'ISY Beskrivelse',      contentId: 'product-isy-beskrivelse',      sceneKey: 'ProductIsyBeskrivelseScene' },
    { x: 800,  label: 'ISY Road',             contentId: 'product-isy-road',             sceneKey: 'ProductIsyRoadScene' },
    { x: 1060, label: 'Admin & Lisens',       contentId: 'product-admin-lisens',         sceneKey: 'ProductAdminLisensScene' },
  ];

  /** Set when arriving from a product room — used to spawn next to that door. */
  private spawnNearDoor?: string;

  constructor() {
    super('ProductsHallScene', FLOORS.PRODUCTS);
  }

  override init(data?: { fromDoor?: string }): void {
    super.init();
    this.spawnNearDoor = data?.fromDoor;
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Hall ambience
    this.add.image(90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(GAME_WIDTH - 90, G - 40, 'plant_tall').setDepth(3);

    // Render each product door with a name plate above it.
    for (const door of ProductsHallScene.DOORS) {
      const img = this.add.image(door.x, G - 56, 'door_unlocked').setDepth(3);
      // Click / tap the door directly to enter — matches the keyboard
      // Enter path but lets touch/mouse users bypass proximity.
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.enterProductRoom(door));
      this.add.text(door.x, G - 130, door.label, {
        fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textPale,
        fontStyle: 'bold', align: 'center',
        backgroundColor: theme.color.css.bgPanel, padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(4);
    }
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Spawn next to the door the player just came back through, if any.
    let spawnX = 150;
    if (this.spawnNearDoor) {
      const door = ProductsHallScene.DOORS.find((d) => d.contentId === this.spawnNearDoor);
      if (door) spawnX = door.x + 70; // step out to the right of the door
    }

    return {
      floorId: FLOORS.PRODUCTS,
      playerStart: { x: spawnX, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // No collectible AU on this floor — it's a portfolio hall.
      tokens: [],

      // No info zones — doors are interactive entry points, not info anchors.
      infoPoints: [],
    };
  }

  /**
   * Layer door-entry detection on top of the base elevator-exit check.
   * Doors live well to the right of the elevator exit (x = 80) so the
   * two prompts never collide.
   */
  protected override checkExitProximity(): void {
    super.checkExitProximity();

    if (this.isTransitioning) return;

    const px = this.player.sprite.x;
    const G = GAME_HEIGHT - TILE_SIZE;
    const playerOnGround = this.player.sprite.y > G - 200;
    if (!playerOnGround) return;

    for (const door of ProductsHallScene.DOORS) {
      if (Math.abs(px - door.x) < 60) {
        this.interactPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 ${door.label}`).setPosition(
          door.x - 100, G - 180,
        ).setVisible(true);
        if (this.inputs.justPressed('Interact')) {
          this.enterProductRoom(door);
        }
        return;
      }
    }
  }

  private enterProductRoom(door: ProductDoor): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(door.sceneKey));
  }
}

