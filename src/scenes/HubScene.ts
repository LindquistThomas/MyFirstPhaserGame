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
import { HubZones, ELEVATOR_INFO_ID, WELCOME_BOARD_ID } from './hub/HubZones';
import { HubElevatorController } from './hub/HubElevatorController';
import { HubFloorDoors } from './hub/HubShaftDoors';

const FLOOR1_ARCH_SCENE_KEY = 'Floor1ArchScene';
const FLOOR3_PRODUCT_SCENE_KEY = 'Floor3ProductScene';

/**
 * Product doors rendered directly on the PRODUCTS floor inside the hub.
 * Walking up to a door and pressing Space/Enter transitions straight to
 * the matching product room scene ΓÇö no intermediate hall scene.
 *
 * x is a world X in the hub (must lie in the right-of-shaft walk surface,
 * i.e. roughly 770..1250).
 */
interface HubProductDoor {
  x: number;
  label: string;
  sceneKey: string;
  /** Door identifier ΓÇö matches ProductRoomConfig.contentId for return-spawn. */
  contentId: string;
}

/**
 * Hub / Elevator-shaft scene ΓÇö Impossible-Mission style.
 *
 * The player rides the elevator up and down using Up/Down controls.
 * At each floor there is an opening; walking off the elevator onto
 * the floor platform triggers a scene transition to that floor's level.
 *
 * Structural concerns are extracted to focused collaborators:
 *   - HubElevatorController  ΓÇö elevator entity, ride loop, music cues
 *   - HubZones               ΓÇö zone registrations, info icons, first-ride setup
 *   - DialogController       ΓÇö info + quiz dialog orchestration
 * This scene owns world construction, the update loop, and scene transitions.
 */
export class HubScene extends Phaser.Scene {
  private player!: Player;
  private hud!: HUD;
  private progression!: ProgressionSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;

  private elevatorButtons?: ElevatorButtons;

  /** Product doors on the PRODUCTS floor. Start with two; easy to extend. */
  private static readonly PRODUCT_DOORS: HubProductDoor[] = [
    { x: 900,  label: 'ISY Project Controls', sceneKey: 'ProductIsyProjectControlsScene', contentId: 'product-isy-project-controls' },
    { x: 1120, label: 'ISY Beskrivelse',      sceneKey: 'ProductIsyBeskrivelseScene',     contentId: 'product-isy-beskrivelse'      },
  ];

  /** Proximity prompt shown when the player is near a product door. */
  private productDoorPrompt?: Phaser.GameObjects.Text;

  /** If returning from a product room, which door to spawn next to. */
  private spawnAtProductDoor?: string;

  private dialogs!: DialogController;
  private zones!: HubZones;
  private elevatorCtrl!: HubElevatorController;
  private shaftDoors: HubFloorDoors[] = [];

  private zoneManager = new ZoneManager();

  /** Total scrollable world height for the hub shaft. */
  private static readonly WORLD_HEIGHT = 2760;
  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;
  /** Number of tile rows stacked per floor slab. */
  private static readonly FLOOR_TILE_ROWS = 2;
  /** Pixel height of one floor slab. */
  private static readonly FLOOR_H = HubScene.FLOOR_TILE_ROWS * TILE_SIZE; // 256
  private static readonly PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y = 56;
  private static readonly FLOOR_DETECTION_TOLERANCE = 18;

  constructor() {
    super({ key: 'HubScene' });
  }

  init(data?: { loadSave?: boolean; returnFromProductDoor?: string }): void {
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
    this.zoneManager.clear();
  }

  create(): void {
    this.isTransitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.background);

    const wh = HubScene.WORLD_HEIGHT;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, wh);

    this.createShaftBackground(wh);
    this.createPlatforms();
    this.createLobbyDecorations();
    this.createFloorDecorations();
    this.createPlayer();
    this.elevatorCtrl = new HubElevatorController(this, this.player, this.buildElevator());
    this.createShaftDoors();
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
    this.zones = new HubZones({
      scene: this,
      zoneManager: this.zoneManager,
      dialogs: this.dialogs,
      player: this.player,
      elevatorButtons: () => this.elevatorButtons,
      isPlayerOnElevator: () => this.elevatorCtrl.isOnElevator,
      boardX: 300,
      boardY: lobbyY + HubScene.FLOOR_H - 60,
    });
  }

  /* ---- background ---- */
  private createShaftBackground(worldHeight: number): void {
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;
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
    const sw = HubScene.SHAFT_WIDTH;
    const WALK_H = 8;
    const floorH = HubScene.FLOOR_H;
    const elevHW = HubElevatorController.PLATFORM_HALF_WIDTH;
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
      for (let row = 0; row < HubScene.FLOOR_TILE_ROWS; row++) {
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

      // Walking surface ΓÇö extends from screen edge to elevator platform edge
      const walkY = y + floorH;
      const addWalkSurface = (rx: number, rw: number) => {
        const rect = this.add.rectangle(
          rx, walkY + WALK_H / 2, rw, WALK_H, 0x444466, 1,
        ).setDepth(2);
        this.physics.add.existing(rect, true);
        this.platforms.add(rect);
      };
      addWalkSurface(elevLeft / 2, elevLeft);
      addWalkSurface((elevRight + GAME_WIDTH) / 2, GAME_WIDTH - elevRight);

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
    const netY = HubScene.WORLD_HEIGHT - 4;
    const shaftNet = this.add.rectangle(cx, netY, sw, 8, 0x000000, 0).setDepth(0);
    this.physics.add.existing(shaftNet, true);
    this.platforms.add(shaftNet);
  }

  /* ---- lobby decorations ---- */
  private createLobbyDecorations(): void {
    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];
    const floorBottom = lobbyY + HubScene.FLOOR_H;
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;
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
    const sw = HubScene.SHAFT_WIDTH;
    const rightEdge = cx + sw / 2;

    // F1 ΓÇö Platform Team: server racks, desks, and networking gear
    const f1Bottom = positions[FLOORS.PLATFORM_TEAM] + HubScene.FLOOR_H;
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
    const fProductsBottom = positions[FLOORS.PRODUCTS] + HubScene.FLOOR_H;
    this.add.image(150, fProductsBottom - 60, 'info_board').setDepth(3);
    this.add.image(rightEdge + 100, fProductsBottom - 40, 'plant_tall').setDepth(3);
    this.add.image(rightEdge + 240, fProductsBottom - 32, 'plant_small').setDepth(11);

    // Render a door sprite + name plate for each product.
    for (const door of HubScene.PRODUCT_DOORS) {
      this.add.image(door.x, fProductsBottom - 56, 'door_unlocked').setDepth(3);
      this.add.text(door.x, fProductsBottom - 130, door.label, {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfe6ff',
        fontStyle: 'bold', align: 'center',
        backgroundColor: '#0a1422', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(4);
    }

    // F3 ΓÇö Business: finance left, product leadership right
    const f3Bottom = positions[FLOORS.BUSINESS] + HubScene.FLOOR_H;
    this.add.image(150, f3Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(310, f3Bottom - 22, 'monitor_dash').setDepth(3);
    this.add.image(rightEdge + 120, f3Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(rightEdge + 280, f3Bottom - 22, 'monitor_dash').setDepth(11);
    this.add.image(rightEdge + 440, f3Bottom - 40, 'plant_tall').setDepth(3);

    // F4 ΓÇö Executive Suite: penthouse vibe with plants and an info board
    const f4Bottom = positions[FLOORS.EXECUTIVE] + HubScene.FLOOR_H;
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
    const floorH = HubScene.FLOOR_H;
    const startY = positions[this.progression.getCurrentFloor()] + floorH + 8;

    const elevator = new Elevator(this, cx, startY);
    for (const [id, y] of Object.entries(positions)) {
      elevator.addFloor(Number(id), y + floorH + 8);
    }
    return elevator;
  }

  private createShaftDoors(): void {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const floorH = HubScene.FLOOR_H;
    const sw = HubScene.SHAFT_WIDTH;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;
    for (const [, y] of Object.entries(positions)) {
      const walkY = y + floorH;
      const dockY = walkY + 8; // same expression used in buildElevator
      this.shaftDoors.push(new HubFloorDoors(this, leftEdge, rightEdge, walkY, dockY));
    }
  }

  /* ---- player ---- */
  private createPlayer(): void {
    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];

    let spawnX = 200;
    let spawnY = lobbyY + HubScene.FLOOR_H - HubScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;

    // If returning from a product room, spawn next to the door we came through.
    if (this.spawnAtProductDoor) {
      const door = HubScene.PRODUCT_DOORS.find((d) => d.contentId === this.spawnAtProductDoor);
      if (door) {
        const productsWalkY = positions[FLOORS.PRODUCTS] + HubScene.FLOOR_H;
        spawnX = door.x;
        spawnY = productsWalkY - HubScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;
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
      [FLOORS.LOBBY]: HubScene.WORLD_HEIGHT - 350,
      [FLOORS.PLATFORM_TEAM]: HubScene.WORLD_HEIGHT - 880,
      [FLOORS.PRODUCTS]: HubScene.WORLD_HEIGHT - 1410,
      [FLOORS.BUSINESS]: HubScene.WORLD_HEIGHT - 1940,
      [FLOORS.EXECUTIVE]: HubScene.WORLD_HEIGHT - 2470,
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

    // Emit zone:enter / zone:exit events; HubZones' subscribers react.
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

    this.checkFloorEntry();
    this.checkProductDoorEntry();
  }

  /** Show prompt + handle Space/Enter when standing near a product door. */
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
    const walkY = positions[FLOORS.PRODUCTS] + HubScene.FLOOR_H;
    if (Math.abs(body.bottom - walkY) > HubScene.FLOOR_DETECTION_TOLERANCE) {
      this.productDoorPrompt?.setVisible(false);
      return;
    }

    const px = this.player.sprite.x;
    for (const door of HubScene.PRODUCT_DOORS) {
      if (Math.abs(px - door.x) < 60) {
        this.productDoorPrompt
          ?.setText(`Press Space/Enter \u2192 ${door.label}`)
          .setPosition(door.x - 120, walkY - 180)
          .setVisible(true);
        if (this.inputs.justPressed('Interact')) this.enterProductDoor(door);
        return;
      }
    }
    this.productDoorPrompt?.setVisible(false);
  }

  private enterProductDoor(door: HubProductDoor): void {
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
    const sw = HubScene.SHAFT_WIDTH;

    if (px > cx - sw / 2 + 20 && px < cx + sw / 2 - 20) return;

    const positions = this.getFloorYPositions();
    const bodyBottom = body.bottom;

    for (const [floorId, floorY] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue;
      // PRODUCTS floor uses explicit doors (see checkProductDoorEntry) ΓÇö
      // stepping onto the walk surface must not auto-transition.
      if (fId === FLOORS.PRODUCTS) continue;

      const walkingSurface = floorY + HubScene.FLOOR_H;
      if (Math.abs(bodyBottom - walkingSurface) < HubScene.FLOOR_DETECTION_TOLERANCE) {
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
      sceneKey = FLOOR1_ARCH_SCENE_KEY;
    } else if (floorId === FLOORS.BUSINESS && direction === 'right') {
      sceneKey = FLOOR3_PRODUCT_SCENE_KEY;
    }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(sceneKey));
  }

}
