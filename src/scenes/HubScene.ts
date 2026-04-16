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

const FLOOR0_TEST_SCENE_KEY = 'Floor0Scene';

/**
 * Hub / Elevator-shaft scene — Impossible-Mission style.
 *
 * The player rides the elevator up and down using Up/Down controls.
 * At each floor there is an opening; walking off the elevator onto
 * the floor platform triggers a scene transition to that floor's level.
 *
 * Structural concerns are extracted to focused collaborators:
 *   - HubElevatorController  — elevator entity, ride loop, music cues
 *   - HubZones               — zone registrations, info icons, first-ride setup
 *   - DialogController       — info + quiz dialog orchestration
 * This scene owns world construction, the update loop, and scene transitions.
 */
export class HubScene extends Phaser.Scene {
  private player!: Player;
  private hud!: HUD;
  private progression!: ProgressionSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;

  private elevatorButtons?: ElevatorButtons;

  private dialogs!: DialogController;
  private zones!: HubZones;
  private elevatorCtrl!: HubElevatorController;

  private zoneManager = new ZoneManager();

  /** Total scrollable world height for the hub shaft. */
  private static readonly WORLD_HEIGHT = 1700;
  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;
  /** Number of tile rows stacked per floor slab. */
  private static readonly FLOOR_TILE_ROWS = 2;
  /** Pixel height of one floor slab. */
  private static readonly FLOOR_H = HubScene.FLOOR_TILE_ROWS * TILE_SIZE; // 256
  private static readonly FLOOR0_EDGE_TRIGGER_X = 36;
  private static readonly PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y = 56;
  private static readonly FLOOR_DETECTION_TOLERANCE = 18;

  constructor() {
    super({ key: 'HubScene' });
  }

  init(data?: { loadSave?: boolean }): void {
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
    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, wh);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.dialogs = new DialogController(this, {
      progression: this.progression,
      getIconForContent: () => this.zones.elevatorInfoIcon,
      onClose: (id) => {
        if (id === ELEVATOR_INFO_ID && !this.zones.elevatorInfoIcon) {
          markSeen(id);
          this.zones.onElevatorInfoSeen();
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

    for (let y = 0; y < worldHeight; y += TILE_SIZE) {
      this.add.tileSprite(cx, y, sw, TILE_SIZE, 'elevator_shaft').setDepth(0);
    }

    const rail = this.add.graphics();
    rail.fillStyle(0x00aaff, 0.6);
    rail.fillRect(cx - sw / 2 - 8, 0, 8, worldHeight);
    rail.fillRect(cx + sw / 2, 0, 8, worldHeight);
    rail.lineStyle(2, 0x005588, 0.4);
    rail.lineBetween(cx - sw / 2 + 20, 0, cx - sw / 2 + 20, worldHeight);
    rail.lineBetween(cx + sw / 2 - 20, 0, cx + sw / 2 - 20, worldHeight);
    rail.setDepth(1);

    const beams = this.add.graphics();
    beams.lineStyle(1, 0x003355, 0.3);
    for (let y = 0; y < worldHeight; y += 200) {
      beams.lineBetween(cx - sw / 2, y, cx + sw / 2, y);
    }
    beams.setDepth(1);
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

    for (const [floorId, y] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      const fd = LEVEL_DATA[fId];
      const unlocked = this.progression.isFloorUnlocked(fId);

      const leftEdge = cx - sw / 2;
      const rightEdge = cx + sw / 2;

      // Visual floor slab — stacked tile rows (no physics)
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

      // Walking surface — extends from screen edge to elevator platform edge
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

      // Floor label — inside the tile slab
      this.add.text(20, y + 10, `F${fId}`, {
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
        const label = unlocked ? '\u2192 ENTER' : `LOCKED: ${this.progression.getAUNeededForFloor(fId)} AU`;
        this.add.text(rightEdge + 20, walkY + 20, label, {
          fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
        }).setDepth(5);
      }
    }

    // Shaft safety net — collision floor at the very bottom of the shaft.
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

    // Info board — between player spawn and elevator shaft
    this.add.image(300, floorBottom - 60, 'info_board').setDepth(3);
  }

  /* ---- floor decorations ---- */
  private createFloorDecorations(): void {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;
    const rightEdge = cx + sw / 2;

    // F1 — Platform Team: server racks, desks, and networking gear
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

    // F2 — Cloud Team: monitors and dashboards (lighter touch)
    const f2Bottom = positions[FLOORS.CLOUD_TEAM] + HubScene.FLOOR_H;
    this.add.image(150, f2Bottom - 22, 'monitor_dash').setDepth(3);
    this.add.image(350, f2Bottom - 36, 'desk_monitor').setDepth(3);
    this.add.image(rightEdge + 120, f2Bottom - 22, 'monitor_dash').setDepth(11);
    this.add.image(rightEdge + 300, f2Bottom - 36, 'desk_monitor').setDepth(3);
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

  /* ---- player ---- */
  private createPlayer(): void {
    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];
    const spawnX = 200;
    const spawnY = lobbyY + HubScene.FLOOR_H - HubScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;

    this.player = new Player(this, spawnX, spawnY);
    this.physics.add.collider(this.player.sprite, this.platforms);
  }

  /* ---- UI ---- */
  private createUI(): void {
    this.hud = new HUD(this, this.progression);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '\u2191\u2193  Ride Elevator  |  \u2190 \u2192  Walk  |  SPACE  Flip', {
      fontFamily: 'monospace', fontSize: '13px', color: '#556677',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    this.elevatorButtons = new ElevatorButtons(this, 56);
  }

  /* ---- helpers ---- */
  private getFloorYPositions(): Record<number, number> {
    return {
      [FLOORS.LOBBY]: HubScene.WORLD_HEIGHT - 350,
      [FLOORS.PLATFORM_TEAM]: HubScene.WORLD_HEIGHT - 880,
      [FLOORS.CLOUD_TEAM]: HubScene.WORLD_HEIGHT - 1410,
    };
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const inputMgr = this.player.getInputManager();
    const infoPressed = inputMgr.isInfoJustPressed();

    if (this.dialogs.isOpen) return;

    this.player.update(delta);
    this.hud.update();

    if (this.elevatorCtrl.isOnElevator && this.zones.showElevatorInfoOnFirstRide) {
      this.zones.showElevatorInfoOnFirstRide = false;
      this.dialogs.open(ELEVATOR_INFO_ID);
      return;
    }

    // Emit zone:enter / zone:exit events; HubZones' subscribers react.
    this.zoneManager.update();

    // Keyboard info shortcut: synchronous zone query.
    const activeZone = this.zoneManager.getActiveZone();
    if (infoPressed && activeZone && !this.dialogs.isOpen) {
      this.dialogs.open(activeZone);
      return;
    }

    const input = inputMgr.getState();
    const btnState = this.elevatorButtons?.getState();
    this.elevatorCtrl.update(
      { up: input.up, down: input.down },
      btnState ? { up: btnState.up, down: btnState.down } : undefined,
    );

    this.checkFloorEntry();
    this.checkFloor0Transition();
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

      const walkingSurface = floorY + HubScene.FLOOR_H;
      if (Math.abs(bodyBottom - walkingSurface) < HubScene.FLOOR_DETECTION_TOLERANCE) {
        if (this.progression.isFloorUnlocked(fId)) {
          this.enterFloor(fId);
          return;
        }
      }
    }
  }

  /** At lobby level, walking to the far left/right opens the Floor 0 test scene. */
  private checkFloor0Transition(): void {
    if (this.elevatorCtrl.isOnElevator) return;

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (!(body.blocked.down || body.touching.down)) return;

    const positions = this.getFloorYPositions();
    const lobbyY = positions[FLOORS.LOBBY];
    const lobbySurface = lobbyY + HubScene.FLOOR_H;
    if (Math.abs(body.bottom - lobbySurface) >= HubScene.FLOOR_DETECTION_TOLERANCE) return;

    const px = this.player.sprite.x;
    if (px <= HubScene.FLOOR0_EDGE_TRIGGER_X || px >= GAME_WIDTH - HubScene.FLOOR0_EDGE_TRIGGER_X) {
      this.enterFloor0Test();
    }
  }

  private enterFloor(floorId: FloorId): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(floorId);
    const fd = LEVEL_DATA[floorId];
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(fd.sceneKey));
  }

  private enterFloor0Test(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(FLOOR0_TEST_SCENE_KEY));
  }
}
