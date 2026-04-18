import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, TILE_SIZE, COLORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import { Player } from '../entities/Player';
import { Elevator } from '../entities/Elevator';
import { HUD } from '../ui/HUD';
import { ElevatorButtons } from '../ui/ElevatorButtons';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { DialogController } from '../ui/DialogController';
import { ZoneManager } from '../systems/ZoneManager';
import { markSeen } from '../systems/InfoDialogManager';
import { ElevatorZones, ELEVATOR_INFO_ID, WELCOME_BOARD_ID } from './elevator/ElevatorZones';
import { ElevatorController } from './elevator/ElevatorController';
import { ElevatorShaftDoors } from './elevator/ElevatorShaftDoors';

const ARCHITECTURE_TEAM_SCENE_KEY = 'ArchitectureTeamScene';
const PRODUCT_LEADERSHIP_SCENE_KEY = 'ProductLeadershipScene';

/**
 * Product doors rendered directly on the PRODUCTS floor of the shaft.
 * Walking up to a door and pressing Enter (or tapping the door) transitions
 * straight to the matching product room scene ΓÇö no intermediate hall scene.
 *
 * x is a world X in the elevator scene (must lie in the right-of-shaft walk surface,
 * i.e. roughly 770..1250).
 */
interface ElevatorProductDoor {
  x: number;
  label: string;
  sceneKey: string;
  /** Door identifier ΓÇö matches ProductRoomConfig.contentId for return-spawn. */
  contentId: string;
}

/**
 * Elevator-shaft scene ΓÇö Impossible-Mission style.
 *
 * The player rides the elevator up and down using Up/Down controls.
 * At each floor there is an opening; walking off the elevator onto
 * the floor platform triggers a scene transition to that floor's level.
 *
 * Structural concerns are extracted to focused collaborators:
 *   - ElevatorController  ΓÇö elevator entity, ride loop, music cues
 *   - ElevatorZones               ΓÇö zone registrations, info icons, first-ride setup
 *   - DialogController       ΓÇö info + quiz dialog orchestration
 * This scene owns world construction, the update loop, and scene transitions.
 */
export class ElevatorScene extends Phaser.Scene {
  private player!: Player;
  private hud!: HUD;
  private progression!: ProgressionSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;

  private elevatorButtons?: ElevatorButtons;

  /** Product doors on the PRODUCTS floor. Start with two; easy to extend. */
  private static readonly PRODUCT_DOORS: ElevatorProductDoor[] = [
    { x: 900,  label: 'ISY Project Controls', sceneKey: 'ProductIsyProjectControlsScene', contentId: 'product-isy-project-controls' },
    { x: 1120, label: 'ISY Beskrivelse',      sceneKey: 'ProductIsyBeskrivelseScene',     contentId: 'product-isy-beskrivelse'      },
  ];

  /** Proximity prompt shown when the player is near a product door. */
  private productDoorPrompt?: Phaser.GameObjects.Text;

  /** If returning from a product room, which door to spawn next to. */
  private spawnAtProductDoor?: string;

  /** If returning from a floor/room scene, which floor to spawn on. */
  private spawnAtFloor?: FloorId;
  /** Which side of the shaft to spawn on when returning from a floor. */
  private spawnAtFloorSide: 'left' | 'right' = 'left';
  /** Suppress auto-entry for this floor until the player rides the elevator. */
  private skipFloorEntry?: FloorId;

  private dialogs!: DialogController;
  private zones!: ElevatorZones;
  private elevatorCtrl!: ElevatorController;
  private shaftDoors: ElevatorShaftDoors[] = [];

  /** Cable tile sprite that spans from shaft ceiling down to the top of the cab. */
  private shaftCable?: Phaser.GameObjects.TileSprite;
  /** Per-floor 2-LED indicator graphics; lit when the cab Y is near the landing. */
  private floorLEDs: Map<number, { gfx: Phaser.GameObjects.Graphics; x: number; y: number; dockY: number }> = new Map();

  private zoneManager = new ZoneManager();

  /** Total scrollable world height for the elevator shaft. */
  private static readonly WORLD_HEIGHT = 2760;
  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;
  /** Number of tile rows stacked per floor slab. */
  private static readonly FLOOR_TILE_ROWS = 2;
  /** Pixel height of one floor slab. */
  private static readonly FLOOR_H = ElevatorScene.FLOOR_TILE_ROWS * TILE_SIZE; // 256
  private static readonly PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y = 56;
  private static readonly FLOOR_DETECTION_TOLERANCE = 18;

  constructor() {
    super({ key: 'ElevatorScene' });
  }

  init(data?: {
    loadSave?: boolean;
    returnFromProductDoor?: string;
    returnFromFloor?: FloorId;
    returnFromSide?: 'left' | 'right';
  }): void {
    if (!this.registry.get('progression')) {
      const progression = new ProgressionSystem();
      if (data?.loadSave) {
        progression.loadFromSave();
      } else if (data?.loadSave === false) {
        progression.reset();
      }
      this.registry.set('progression', progression);
    }
    this.progression = this.registry.get('progression') as ProgressionSystem;
    this.spawnAtProductDoor = data?.returnFromProductDoor;
    this.spawnAtFloor = data?.returnFromFloor;
    this.spawnAtFloorSide = data?.returnFromSide ?? 'left';
    this.skipFloorEntry = data?.returnFromFloor;
    this.zoneManager.clear();
  }

  create(): void {
    this.isTransitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.background);

    const wh = ElevatorScene.WORLD_HEIGHT;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, wh);

    this.createShaftBackground(wh);
    this.createPlatforms();
    this.createLobbyDecorations();
    this.createFloorDecorations();
    this.createPlayer();
    this.elevatorCtrl = new ElevatorController(this, this.player, this.buildElevator());
    this.createShaftDoors();
    this.createShaftCable();
    this.createFloorLEDs();
    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, wh);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.dialogs = new DialogController(this, {
      progression: this.progression,
      getIconForContent: () => this.zones.elevatorInfoIcon,
      onOpen: (id) => markSeen(id),
      onClose: (id) => {
        if (id === ELEVATOR_INFO_ID) {
          this.zones.elevatorInfoIcon?.markAsSeen();
        } else if (id === WELCOME_BOARD_ID) {
          this.zones.lobbyBoardIcon?.markAsSeen();
        }
      },
    });

    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];
    this.zones = new ElevatorZones({
      scene: this,
      zoneManager: this.zoneManager,
      dialogs: this.dialogs,
      player: this.player,
      elevatorButtons: () => this.elevatorButtons,
      isPlayerOnElevator: () => this.elevatorCtrl.isOnElevator,
      boardX: 300,
      boardY: lobbyY + ElevatorScene.FLOOR_H - 60,
    });
  }

  /* ---- background ---- */
  private createShaftBackground(worldHeight: number): void {
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;

    // Concrete back wall (shaft interior) ΓÇö tiled
    for (let y = 0; y < worldHeight; y += TILE_SIZE) {
      this.add.tileSprite(cx, y, sw, TILE_SIZE, 'elevator_shaft').setDepth(0);
    }

    // Inner shadow along both walls (ambient occlusion in the corners)
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRect(leftEdge, 0, 8, worldHeight);
    shadow.fillRect(rightEdge - 8, 0, 8, worldHeight);
    shadow.setDepth(0);

    // Steel shaft walls ΓÇö dark outer pillars flanking the concrete
    const walls = this.add.graphics();
    walls.fillStyle(0x1a1a22, 1);
    walls.fillRect(leftEdge - 12, 0, 12, worldHeight);
    walls.fillRect(rightEdge, 0, 12, worldHeight);
    // Wall bevel highlight
    walls.fillStyle(0x33333f, 1);
    walls.fillRect(leftEdge - 12, 0, 2, worldHeight);
    walls.fillRect(rightEdge + 10, 0, 2, worldHeight);
    walls.setDepth(1);

    // Vertical steel guide rails (two T-section rails the cab slides on)
    const rails = this.add.graphics();
    const railOffsets = [-sw / 2 + 18, sw / 2 - 18];
    for (const off of railOffsets) {
      const rx = cx + off;
      // Rail shadow
      rails.fillStyle(0x0d0d12, 0.8);
      rails.fillRect(rx - 3, 0, 8, worldHeight);
      // Rail body
      rails.fillStyle(0x55606e, 1);
      rails.fillRect(rx - 2, 0, 4, worldHeight);
      // Rail highlight
      rails.fillStyle(0x88909c, 1);
      rails.fillRect(rx - 1, 0, 1, worldHeight);
    }
    rails.setDepth(1);

    // Periodic horizontal I-beams / maintenance struts
    const beams = this.add.graphics();
    for (let y = 60; y < worldHeight; y += 240) {
      // Avoid drawing beams across floor openings (keep shaft openings clean)
      beams.fillStyle(0x3a3a48, 1);
      beams.fillRect(leftEdge + 2, y, sw - 4, 4);
      beams.fillStyle(0x55556a, 1);
      beams.fillRect(leftEdge + 2, y, sw - 4, 1);
      beams.fillStyle(0x1a1a22, 1);
      beams.fillRect(leftEdge + 2, y + 4, sw - 4, 1);
      // Bolts
      beams.fillStyle(0x88909c, 1);
      beams.fillCircle(leftEdge + 10, y + 2, 1.2);
      beams.fillCircle(rightEdge - 10, y + 2, 1.2);
    }
    beams.setDepth(1);

    // Warning chevrons every few meters on the wall
    const chev = this.add.graphics();
    chev.fillStyle(0xffcc33, 0.25);
    for (let y = 120; y < worldHeight; y += 480) {
      for (let i = 0; i < 3; i++) {
        chev.fillTriangle(leftEdge + 26 + i * 6, y, leftEdge + 32 + i * 6, y, leftEdge + 29 + i * 6, y + 8);
      }
    }
    chev.setDepth(1);
  }

  /* ---- platforms ---- */
  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const WALK_H = 8;
    const floorH = ElevatorScene.FLOOR_H;
    const elevHW = ElevatorController.PLATFORM_HALF_WIDTH;
    // Walking surfaces extend to the elevator platform edges so there are
    // no cracks between the floor and the elevator.
    const elevLeft = cx - elevHW;  // 560
    const elevRight = cx + elevHW; // 720

    const labels = this.getFloorLabels();
    for (const [floorId, y] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      const fd = LEVEL_DATA[fId];
      const unlocked = this.progression.isFloorUnlocked(fId);

      const leftEdge = cx - sw / 2;
      const rightEdge = cx + sw / 2;

      // Visual floor slab ΓÇö stacked tile rows (no physics)
      for (let row = 0; row < ElevatorScene.FLOOR_TILE_ROWS; row++) {
        const tileY = y + row * TILE_SIZE + TILE_SIZE / 2;
        for (let tileLeft = 0; tileLeft + TILE_SIZE <= leftEdge; tileLeft += TILE_SIZE) {
          this.add.image(tileLeft + TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
        }
        for (let tileLeft = rightEdge; tileLeft < GAME_WIDTH; tileLeft += TILE_SIZE) {
          this.add.image(tileLeft + TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
        }
      }

      // Visual ledge fills bridging the shaft edges to the elevator
      const ledgeColor = 0x3a3a55;
      const ledgeGapL = elevLeft - leftEdge;  // 30
      const ledgeGapR = rightEdge - elevRight; // 30
      if (ledgeGapL > 0) {
        this.add.rectangle(leftEdge + ledgeGapL / 2, y + floorH + WALK_H / 2,
          ledgeGapL, WALK_H, ledgeColor, 1).setDepth(2);
      }
      if (ledgeGapR > 0) {
        this.add.rectangle(elevRight + ledgeGapR / 2, y + floorH + WALK_H / 2,
          ledgeGapR, WALK_H, ledgeColor, 1).setDepth(2);
      }

      // Walking surface ΓÇö extends from screen edge to just past the elevator
      // platform edge. The 4 px overlap into the cab zone gives the engine a
      // little slack when the cab is docked, closing any seam between the
      // static walk surface and the kinematic cab body.
      const walkY = y + floorH;
      const WALK_OVERLAP = 4;
      const addWalkSurface = (rx: number, rw: number) => {
        const rect = this.add.rectangle(
          rx, walkY + WALK_H / 2, rw, WALK_H, 0x444466, 1,
        ).setDepth(2);
        this.physics.add.existing(rect, true);
        this.platforms.add(rect);
      };
      const leftRw = elevLeft + WALK_OVERLAP;
      const rightRw = GAME_WIDTH - (elevRight - WALK_OVERLAP);
      addWalkSurface(leftRw / 2, leftRw);
      addWalkSurface((elevRight - WALK_OVERLAP + GAME_WIDTH) / 2, rightRw);

      // Floor label ΓÇö inside the tile slab
      this.add.text(20, y + 10, labels[fId] ?? `F${fId}`, {
        fontFamily: 'monospace', fontSize: '28px',
        color: COLORS.hudText, fontStyle: 'bold',
      }).setDepth(5);

      if (fd) {
        const nameColor = unlocked ? '#8899bb' : '#664444';
        this.add.text(80, y + 14, fd.name, {
          fontFamily: 'monospace', fontSize: '18px', color: nameColor,
        }).setDepth(5);
      }

      if (fId !== FLOORS.LOBBY) {
        const arrowColor = unlocked ? '#00ff88' : '#ff4444';
        if (unlocked && fId === FLOORS.PLATFORM_TEAM) {
          // Floor 1 splits: left ΓåÆ Platform room, right ΓåÆ Architecture room.
          this.add.text(leftEdge - 20, walkY + 20, 'PLATFORM \u2190', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setOrigin(1, 0).setDepth(5);
          this.add.text(rightEdge + 20, walkY + 20, '\u2192 ARCHITECTURE', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setDepth(5);
        } else if (unlocked && fId === FLOORS.BUSINESS) {
          // Floor 3 splits: left ΓåÆ Finance, right ΓåÆ Product Leadership.
          this.add.text(leftEdge - 20, walkY + 20, 'FINANCE \u2190', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setOrigin(1, 0).setDepth(5);
          this.add.text(rightEdge + 20, walkY + 20, '\u2192 PRODUCT', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setDepth(5);
        } else if (unlocked && fId === FLOORS.PRODUCTS) {
          // Products floor has doors on the right walk surface ΓÇö no single
          // "enter" arrow; the door name plates serve as the labels.
          this.add.text(rightEdge + 20, walkY + 20, '\u2192 PRODUCTS', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setDepth(5);
        } else {
          const label = unlocked ? '\u2192 ENTER' : `LOCKED: ${this.progression.getAUNeededForFloor(fId)} AU`;
          this.add.text(rightEdge + 20, walkY + 20, label, {
            fontFamily: 'monospace', fontSize: '15px', color: arrowColor,
          }).setDepth(5);
        }
      }
    }

    // Shaft safety net ΓÇö collision floor at the very bottom of the shaft.
    const netY = ElevatorScene.WORLD_HEIGHT - 4;
    const shaftNet = this.add.rectangle(cx, netY, sw, 8, 0x000000, 0).setDepth(0);
    this.physics.add.existing(shaftNet, true);
    this.platforms.add(shaftNet);

    // Invisible shaft walls: prevent airborne players from arcing across the
    // shaft from one floor's walk surface onto the other. Each wall is a stack
    // of vertical segments with an opening at every floor's walking Y so the
    // player can still step between the walk surface and a docked elevator.
    const WALL_W = 2;
    const OPENING_ABOVE = 120; // > HITBOX_HEIGHT (116), so a standing body fits
    const OPENING_BELOW = 24;
    const leftWallX = cx - sw / 2 - 1;
    const rightWallX = cx + sw / 2 + 1;

    const walkYs = Object.values(positions)
      .map((yy) => yy + floorH)
      .sort((a, b) => a - b);

    const addWallSegment = (xCenter: number, yTop: number, yBottom: number): void => {
      const h = yBottom - yTop;
      if (h <= 0) return;
      const rect = this.add.rectangle(xCenter, yTop + h / 2, WALL_W, h, 0x000000, 0).setDepth(0);
      this.physics.add.existing(rect, true);
      this.platforms.add(rect);
    };

    const buildWallColumn = (xCenter: number): void => {
      let cursor = 0;
      for (const walkY of walkYs) {
        addWallSegment(xCenter, cursor, walkY - OPENING_ABOVE);
        cursor = walkY + OPENING_BELOW;
      }
      addWallSegment(xCenter, cursor, ElevatorScene.WORLD_HEIGHT);
    };

    buildWallColumn(leftWallX);
    buildWallColumn(rightWallX);
  }

  /* ---- lobby decorations ---- */
  private createLobbyDecorations(): void {
    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];
    const floorBottom = lobbyY + ElevatorScene.FLOOR_H;
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;

    // Plants behind the player (depth < 10)
    this.add.image(80, floorBottom - 32, 'plant_tall').setDepth(3);
    this.add.image(leftEdge - 140, floorBottom - 40, 'plant_tall').setDepth(3);
    this.add.image(rightEdge + 140, floorBottom - 40, 'plant_tall').setDepth(3);

    // Plants in front of the player (depth > 10)
    this.add.image(leftEdge - 60, floorBottom - 32, 'plant_small').setDepth(11);
    this.add.image(rightEdge + 60, floorBottom - 32, 'plant_small').setDepth(11);
    this.add.image(GAME_WIDTH - 80, floorBottom - 32, 'plant_tall').setDepth(11);

    // Info board ΓÇö between player spawn and elevator shaft
    this.add.image(300, floorBottom - 60, 'info_board').setDepth(3);
  }

  /* ---- floor decorations ---- */
  private createFloorDecorations(): void {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const rightEdge = cx + sw / 2;

    // F1 ΓÇö Platform Team: server racks, desks, and networking gear
    const f1Bottom = positions[FLOORS.PLATFORM_TEAM] + ElevatorScene.FLOOR_H;
    this.add.image(120, f1Bottom - 50, 'server_rack').setDepth(3);
    this.add.image(180, f1Bottom - 50, 'server_rack').setDepth(3);
    this.add.image(300, f1Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(150, f1Bottom - 10, 'router').setDepth(3);
    this.add.image(120, f1Bottom - 10, 'cables').setDepth(1);
    this.add.image(rightEdge + 80, f1Bottom - 50, 'server_rack').setDepth(3);
    this.add.image(rightEdge + 200, f1Bottom - 36, 'desk_monitor').setDepth(11);
    this.add.image(rightEdge + 320, f1Bottom - 22, 'monitor_dash').setDepth(3);
    this.add.image(rightEdge + 440, f1Bottom - 10, 'router').setDepth(3);

    // F (Products) ΓÇö door-lined hall: left-side ambience + product doors on the right.
    const fProductsBottom = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
    this.add.image(150, fProductsBottom - 60, 'info_board').setDepth(3);
    this.add.image(rightEdge + 100, fProductsBottom - 40, 'plant_tall').setDepth(3);
    this.add.image(rightEdge + 240, fProductsBottom - 32, 'plant_small').setDepth(11);

    // Render a door sprite + name plate for each product. Door is also
    // clickable/tappable — mouse and touch users can enter directly.
    for (const door of ElevatorScene.PRODUCT_DOORS) {
      const img = this.add.image(door.x, fProductsBottom - 56, 'door_unlocked').setDepth(3);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.enterProductDoor(door));
      this.add.text(door.x, fProductsBottom - 130, door.label, {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfe6ff',
        fontStyle: 'bold', align: 'center',
        backgroundColor: '#0a1422', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(4);
    }

    // F3 ΓÇö Business: finance left, product leadership right
    const f3Bottom = positions[FLOORS.BUSINESS] + ElevatorScene.FLOOR_H;
    this.add.image(150, f3Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(310, f3Bottom - 22, 'monitor_dash').setDepth(3);
    this.add.image(rightEdge + 120, f3Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(rightEdge + 280, f3Bottom - 22, 'monitor_dash').setDepth(11);
    this.add.image(rightEdge + 440, f3Bottom - 40, 'plant_tall').setDepth(3);

    // F4 ΓÇö Executive Suite: penthouse vibe with plants and an info board
    const f4Bottom = positions[FLOORS.EXECUTIVE] + ElevatorScene.FLOOR_H;
    this.add.image(120, f4Bottom - 40, 'plant_tall').setDepth(3);
    this.add.image(280, f4Bottom - 60, 'info_board').setDepth(3);
    this.add.image(rightEdge + 120, f4Bottom - 40, 'plant_tall').setDepth(3);
    this.add.image(rightEdge + 280, f4Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(GAME_WIDTH - 100, f4Bottom - 40, 'plant_tall').setDepth(11);
  }

  /* ---- elevator ---- */
  private buildElevator(): Elevator {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const floorH = ElevatorScene.FLOOR_H;
    const startY = positions[this.progression.getCurrentFloor()] + floorH + 8;

    const elevator = new Elevator(this, cx, startY);
    for (const [id, y] of Object.entries(positions)) {
      elevator.addFloor(Number(id), y + floorH + 8);
    }
    // Cab starts docked at whichever floor the player was last on — keep
    // the elevator's internal floor id in sync so the HUD doesn't show
    // F0/Lobby while physically parked at F1 on scene re-entry.
    elevator.setCurrentFloor(this.progression.getCurrentFloor());
    return elevator;
  }

  private createShaftDoors(): void {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const floorH = ElevatorScene.FLOOR_H;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;
    for (const [, y] of Object.entries(positions)) {
      const walkY = y + floorH;
      const dockY = walkY + 8; // same expression used in buildElevator
      this.shaftDoors.push(new ElevatorShaftDoors(this, leftEdge, rightEdge, walkY, dockY));
    }
  }

  /**
   * Cable rendered as a vertical TileSprite anchored at the shaft ceiling (y=0)
   * and stretched downward to the top of the cab. Updated every frame in update().
   */
  private createShaftCable(): void {
    const cx = GAME_WIDTH / 2;
    // Depth 1.7: above shaft back wall (0) / rails / beams (1) / shaft doors (1.5),
    // below the elevator cab graphics (2) and platform (3).
    this.shaftCable = this.add.tileSprite(cx, 0, 4, 1, 'elevator_cable')
      .setOrigin(0.5, 0)
      .setDepth(1.7);
    this.updateShaftCable();
  }

  private updateShaftCable(): void {
    if (!this.shaftCable || !this.elevatorCtrl) return;
    // Approximate cab top: platform Y minus the cab height (see Elevator.CAB_H=172).
    const cabTop = this.elevatorCtrl.elevator.getY() - 172;
    const h = Math.max(0, cabTop);
    this.shaftCable.setSize(4, h);
  }

  /**
   * Place a tiny 2-LED indicator near the shaft opening on the right side of
   * the shaft wall for each landing. LEDs light green when the cab Y is within
   * ~12 px of the landing dock Y.
   */
  private createFloorLEDs(): void {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const rightEdge = cx + sw / 2;
    const floorH = ElevatorScene.FLOOR_H;

    for (const [idStr, yTop] of Object.entries(positions)) {
      const id = Number(idStr);
      const walkY = yTop + floorH;
      const dockY = walkY + 8;
      // Mount just above the shaft opening on the inside of the right shaft wall.
      const ledX = rightEdge - 12;
      const ledY = walkY - 148;
      const gfx = this.add.graphics();
      gfx.setDepth(5);
      this.floorLEDs.set(id, { gfx, x: ledX, y: ledY, dockY });
    }
    this.updateFloorLEDs();
  }

  private updateFloorLEDs(): void {
    if (!this.elevatorCtrl) return;
    const cabY = this.elevatorCtrl.elevator.getY();
    for (const { gfx, x, y, dockY } of this.floorLEDs.values()) {
      const lit = Math.abs(cabY - dockY) <= 12;
      const color = lit ? 0x00ff66 : 0x335533;
      gfx.clear();
      // Small backing plate for contrast
      gfx.fillStyle(0x111118, 1);
      gfx.fillRect(x - 1, y - 1, 12, 6);
      gfx.fillStyle(color, 1);
      gfx.fillCircle(x + 2, y + 2, 2);
      gfx.fillCircle(x + 8, y + 2, 2);
      if (lit) {
        gfx.fillStyle(0x00ff66, 0.35);
        gfx.fillCircle(x + 2, y + 2, 4);
        gfx.fillCircle(x + 8, y + 2, 4);
      }
    }
  }

  /* ---- player ---- */
  private createPlayer(): void {
    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];

    let spawnX = 200;
    let spawnY = lobbyY + ElevatorScene.FLOOR_H - ElevatorScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;

    // If returning from a product room, spawn next to the door we came through.
    if (this.spawnAtProductDoor) {
      const door = ElevatorScene.PRODUCT_DOORS.find((d) => d.contentId === this.spawnAtProductDoor);
      if (door) {
        const productsWalkY = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
        spawnX = door.x;
        spawnY = productsWalkY - ElevatorScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;
      }
    } else if (this.spawnAtFloor !== undefined && this.spawnAtFloor !== FLOORS.LOBBY) {
      // Returning from a floor/room scene — place the player on that floor,
      // just outside the shaft on the side they exited to.
      const floorY = positions[this.spawnAtFloor];
      if (floorY !== undefined) {
        const walkY = floorY + ElevatorScene.FLOOR_H;
        const cx = GAME_WIDTH / 2;
        const sw = ElevatorScene.SHAFT_WIDTH;
        spawnX = this.spawnAtFloorSide === 'right' ? cx + sw / 2 + 60 : cx - sw / 2 - 60;
        spawnY = walkY - ElevatorScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;
      }
    }

    this.player = new Player(this, spawnX, spawnY);
    this.physics.add.collider(this.player.sprite, this.platforms);

    // World-space prompt shown when near a product door (follows camera scroll).
    this.productDoorPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#ffdd44', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setDepth(20).setVisible(false);
  }

  /* ---- UI ---- */
  private createUI(): void {
    this.hud = new HUD(this, this.progression);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '\u2191\u2193  Ride Elevator  |  \u2190 \u2192  Walk  |  SPACE  Flip', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    this.elevatorButtons = new ElevatorButtons(this, 56);
  }

  /* ---- helpers ---- */
  private getFloorYPositions(): Record<number, number> {
    return {
      [FLOORS.LOBBY]: ElevatorScene.WORLD_HEIGHT - 350,
      [FLOORS.PLATFORM_TEAM]: ElevatorScene.WORLD_HEIGHT - 880,
      [FLOORS.PRODUCTS]: ElevatorScene.WORLD_HEIGHT - 1410,
      [FLOORS.BUSINESS]: ElevatorScene.WORLD_HEIGHT - 1940,
      [FLOORS.EXECUTIVE]: ElevatorScene.WORLD_HEIGHT - 2470,
    };
  }

  /**
   * Build a "F#" label per floor based on Y position (bottom-up), so the
   * displayed number follows the visual stacking order even when FloorId
   * values aren't allocated in the same order (e.g. when a new floor is
   * inserted into the middle of the shaft).
   */
  private getFloorLabels(): Record<number, string> {
    const positions = this.getFloorYPositions();
    const sorted = Object.entries(positions)
      .map(([id, y]) => ({ id: Number(id), y }))
      .sort((a, b) => b.y - a.y); // bottom (largest y) first
    const out: Record<number, string> = {};
    sorted.forEach((entry, index) => { out[entry.id] = `F${index}`; });
    return out;
  }

  /** Debug overlay info: current floor the elevator is stopped at (or "between"). */
  getDebugInfo(): string[] {
    if (!this.elevatorCtrl) return [];
    const labels = this.getFloorLabels();
    const elev = this.elevatorCtrl.elevator;
    const stoppedAt = elev.getFloorAtCurrentPosition();
    const current = elev.getCurrentFloor();
    const label = (id: number | null): string =>
      id === null ? '—' : `${labels[id] ?? `F?`} (id=${id})`;
    const lines = [`Elevator floor: ${label(current)}`];
    if (stoppedAt === null) lines.push('  (between floors)');
    return lines;
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const inputs = this.inputs;
    const infoPressed = inputs.justPressed('ToggleInfo');

    if (this.dialogs.isOpen) return;

    this.player.update(delta);
    this.hud.update();

    // Emit zone:enter / zone:exit events; ElevatorZones' subscribers react.
    this.zoneManager.update();

    // Keyboard info shortcut: synchronous zone query.
    const activeZone = this.zoneManager.getActiveZone();
    if (infoPressed && activeZone && !this.dialogs.isOpen) {
      this.dialogs.open(activeZone);
      return;
    }

    const btnState = this.elevatorButtons?.getState();
    this.elevatorCtrl.update(
      { up: inputs.isDown('MoveUp'), down: inputs.isDown('MoveDown') },
      btnState ? { up: btnState.up, down: btnState.down } : undefined,
      delta,
    );

    const cabY = this.elevatorCtrl.elevator.getY();
    for (const door of this.shaftDoors) door.update(cabY, delta);
    this.updateShaftCable();
    this.updateFloorLEDs();

    // Keep progression.currentFloor aligned with the docked cab so the HUD
    // floor label tracks the player as they ride between floors. Elevator
    // only bumps its currentFloor on arrival, so this writes rarely.
    const elevFloor = this.elevatorCtrl.elevator.getCurrentFloor() as FloorId;
    if (elevFloor !== this.progression.getCurrentFloor()) {
      this.progression.setCurrentFloor(elevFloor);
    }

    // Once the player gets back on the elevator, clear the return-spawn guard
    // so they can enter the floor again next time.
    if (this.skipFloorEntry !== undefined && this.elevatorCtrl.isOnElevator) {
      this.skipFloorEntry = undefined;
    }

    this.checkFloorEntry();
    this.checkProductDoorEntry();
  }

  /** Show prompt + handle Enter when standing near a product door. */
  private checkProductDoorEntry(): void {
    if (this.isTransitioning) return;
    if (this.elevatorCtrl.isOnElevator) {
      this.productDoorPrompt?.setVisible(false);
      return;
    }
    if (!this.progression.isFloorUnlocked(FLOORS.PRODUCTS)) {
      this.productDoorPrompt?.setVisible(false);
      return;
    }

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const positions = this.getFloorYPositions();
    const walkY = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
    if (Math.abs(body.bottom - walkY) > ElevatorScene.FLOOR_DETECTION_TOLERANCE) {
      this.productDoorPrompt?.setVisible(false);
      return;
    }

    const px = this.player.sprite.x;
    for (const door of ElevatorScene.PRODUCT_DOORS) {
      if (Math.abs(px - door.x) < 60) {
        this.productDoorPrompt
          ?.setText(`Press Enter \u2192 ${door.label}`)
          .setPosition(door.x - 120, walkY - 180)
          .setVisible(true);
        if (this.inputs.justPressed('Interact')) this.enterProductDoor(door);
        return;
      }
    }
    this.productDoorPrompt?.setVisible(false);
  }

  private enterProductDoor(door: ElevatorProductDoor): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(FLOORS.PRODUCTS);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(door.sceneKey));
  }

  /** Detect player stepping onto a floor platform (not elevator, not lobby). */
  private checkFloorEntry(): void {
    if (this.elevatorCtrl.isOnElevator) return;

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down) return;

    const px = this.player.sprite.x;
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;

    if (px > cx - sw / 2 + 20 && px < cx + sw / 2 - 20) return;

    const positions = this.getFloorYPositions();
    const bodyBottom = body.bottom;

    for (const [floorId, floorY] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue;
      // PRODUCTS floor uses explicit doors (see checkProductDoorEntry) —
      // stepping onto the walk surface must not auto-transition.
      if (fId === FLOORS.PRODUCTS) continue;
      // Don't immediately re-enter the floor the player just returned from.
      if (fId === this.skipFloorEntry) continue;

      const walkingSurface = floorY + ElevatorScene.FLOOR_H;
      if (Math.abs(bodyBottom - walkingSurface) < ElevatorScene.FLOOR_DETECTION_TOLERANCE) {
        if (this.progression.isFloorUnlocked(fId)) {
          // Floor 1 splits into two rooms ΓÇö left of shaft = Platform,
          // right of shaft = Architecture (ADRs).
          const direction: 'left' | 'right' = px < GAME_WIDTH / 2 ? 'left' : 'right';
          this.enterFloor(fId, direction);
          return;
        }
      }
    }
  }

  private enterFloor(floorId: FloorId, direction: 'left' | 'right' = 'left'): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(floorId);
    const fd = LEVEL_DATA[floorId];
    // Floor 1 routes leftΓåÆPlatform room, rightΓåÆArchitecture room.
    // Floor 3 routes leftΓåÆFinance room, rightΓåÆProduct Leadership room.
    let sceneKey = fd.sceneKey;
    if (floorId === FLOORS.PLATFORM_TEAM && direction === 'right') {
      sceneKey = ARCHITECTURE_TEAM_SCENE_KEY;
    } else if (floorId === FLOORS.BUSINESS && direction === 'right') {
      sceneKey = PRODUCT_LEADERSHIP_SCENE_KEY;
    }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(sceneKey));
  }

}
