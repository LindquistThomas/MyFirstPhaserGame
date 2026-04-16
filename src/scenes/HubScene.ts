import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, TILE_SIZE, COLORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import { INFO_POINTS } from '../config/infoContent';
import { QUIZ_DATA } from '../config/quizData';
import { Player } from '../entities/Player';
import { Elevator } from '../entities/Elevator';
import { HUD } from '../ui/HUD';
import { ElevatorButtons } from '../ui/ElevatorButtons';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { InfoDialog } from '../ui/InfoDialog';
import { QuizDialog } from '../ui/QuizDialog';
import { InfoIcon } from '../ui/InfoIcon';
import { ZoneManager } from '../systems/ZoneManager';
import { eventBus } from '../systems/EventBus';
import { hasBeenSeen, markSeen } from '../systems/InfoDialogManager';
import { isQuizPassed, canRetryQuiz, getCooldownRemaining } from '../systems/QuizManager';

const ELEVATOR_INFO_ID = 'architecture-elevator';
const FLOOR0_TEST_SCENE_KEY = 'Floor0Scene';

/**
 * Hub / Elevator-shaft scene — Impossible-Mission style.
 *
 * The player rides the elevator up and down using Up/Down controls.
 * At each floor there is an opening; walking off the elevator onto
 * the floor platform triggers a scene transition to that floor's level.
 */
export class HubScene extends Phaser.Scene {
  private player!: Player;
  private elevator!: Elevator;
  private hud!: HUD;
  private progression!: ProgressionSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;

  /** Is the player currently standing on the elevator? */
  private playerOnElevator = false;

  /** Was the elevator moving last frame? Used to detect start/stop for music. */
  private wasElevatorMoving = false;

  /** On-screen elevator buttons — shown/hidden by zone events. */
  private elevatorButtons?: ElevatorButtons;

  /**
   * Info icon for the elevator zone — created lazily after the first dialog
   * is closed, then shown/hidden by the same zone events as elevatorButtons.
   */
  private infoIcon?: InfoIcon;

  private showElevatorInfoOnFirstRide = false;
  private dialogOpen = false;
  private activeDialog?: InfoDialog;
  private activeQuiz?: QuizDialog;

  private zoneManager = new ZoneManager();

  /** Total scrollable world height for the hub shaft. */
  private static readonly WORLD_HEIGHT = 1700;
  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;
  /** Number of tile rows stacked per floor slab. */
  private static readonly FLOOR_TILE_ROWS = 2;
  /** Pixel height of one floor slab. */
  private static readonly FLOOR_H = HubScene.FLOOR_TILE_ROWS * TILE_SIZE; // 256
  private static readonly ELEVATOR_STEP_OUT_X_MARGIN = 12;
  private static readonly FLOOR0_EDGE_TRIGGER_X = 36;
  private static readonly PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y = 56;
  private static readonly ELEVATOR_STAND_X_TOLERANCE = 96;
  private static readonly ELEVATOR_STAND_Y_MIN = -16;
  private static readonly ELEVATOR_STAND_Y_MAX = 24;
  private static readonly FLOOR_DETECTION_TOLERANCE = 18;
  private static readonly ELEVATOR_CAB_HALF_WIDTH = 70;

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
    this.infoIcon = undefined;
  }

  create(): void {
    this.isTransitioning = false;
    this.playerOnElevator = false;
    this.wasElevatorMoving = false;
    this.dialogOpen = false;
    this.cameras.main.setBackgroundColor(COLORS.background);

    const wh = HubScene.WORLD_HEIGHT;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, wh);

    this.createShaftBackground(wh);
    this.createPlatforms();
    this.createPlayer();
    this.createElevator();
    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, wh);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.registerZones();
    this.setupElevatorInfo();
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

      // Thin walking surface at slab bottom
      const walkY = y + floorH;
      const addWalkSurface = (rx: number, rw: number) => {
        const rect = this.add.rectangle(
          rx, walkY + WALK_H / 2, rw, WALK_H, 0x444466, 1,
        ).setDepth(2);
        this.physics.add.existing(rect, true);
        this.platforms.add(rect);
      };
      addWalkSurface(leftEdge / 2, leftEdge);
      addWalkSurface((rightEdge + GAME_WIDTH) / 2, GAME_WIDTH - rightEdge);

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
  }

  /* ---- elevator ---- */
  private createElevator(): void {
    const positions = this.getFloorYPositions();
    const cx = GAME_WIDTH / 2;
    const floorH = HubScene.FLOOR_H;
    // Elevator platform top aligns with the walking surface (slab bottom).
    const startY = positions[this.progression.getCurrentFloor()] + floorH + 8;

    this.elevator = new Elevator(this, cx, startY);

    for (const [id, y] of Object.entries(positions)) {
      this.elevator.addFloor(Number(id), y + floorH + 8);
    }

    this.physics.add.collider(this.player.sprite, this.elevator.platform, () => {
      this.playerOnElevator = true;
    });
  }

  /* ---- player ---- */
  private createPlayer(): void {
    const positions = this.getFloorYPositions();
    // Spawn with body-bottom near the walking surface (slab bottom).
    const y = positions[this.progression.getCurrentFloor()] + HubScene.FLOOR_H - HubScene.PLAYER_SPAWN_OFFSET_FROM_FLOOR_Y;

    this.player = new Player(this, GAME_WIDTH / 2, y);
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

  /* ---- zone registration ---- */

  /**
   * Register all hub zones and wire up zone event subscribers.
   *
   * Zones drive UI visibility via the eventBus — neither the scene update
   * loop nor any UI component calls setVisible() directly for zone-gated
   * elements. To add a new zone (e.g. a lobby kiosk), add a register()
   * call here and subscribe its icon / button in the onEnter/onExit handlers.
   *
   * Listeners are removed on scene shutdown to prevent accumulation across
   * scene restarts (EventBus is a singleton, scenes are not destroyed between
   * start/stop cycles).
   */
  private registerZones(): void {
    // --- Elevator zone ---
    // Active while the player is physically standing on the elevator cab.
    // The same zone gates both the ElevatorButtons (always) and the InfoIcon
    // (once it is created after the first dialog close).
    this.zoneManager.register(ELEVATOR_INFO_ID, () => this.playerOnElevator);

    const onEnter = (...args: unknown[]) => {
      const zoneId = args[0] as string;
      if (zoneId === ELEVATOR_INFO_ID) {
        this.elevatorButtons?.setVisible(true);
        this.infoIcon?.setVisible(true);
      }
    };

    const onExit = (...args: unknown[]) => {
      const zoneId = args[0] as string;
      if (zoneId === ELEVATOR_INFO_ID) {
        this.elevatorButtons?.setVisible(false);
        this.infoIcon?.setVisible(false);
      }
    };

    eventBus.on('zone:enter', onEnter);
    eventBus.on('zone:exit', onExit);

    // Unsubscribe when the scene stops so listeners don't pile up on restart.
    this.events.once('shutdown', () => {
      eventBus.off('zone:enter', onEnter);
      eventBus.off('zone:exit', onExit);
    });
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const inputMgr = this.player.getInputManager();
    const infoPressed = inputMgr.isInfoJustPressed();

    if (this.dialogOpen) return;

    this.player.update(delta);
    this.hud.update();

    const onElevator = this.isStandingOnElevator();
    this.playerOnElevator = onElevator;

    // Disable flips while riding the elevator to prevent escaping the cab
    this.player.setFlipEnabled(!onElevator);

    if (this.playerOnElevator && this.showElevatorInfoOnFirstRide) {
      this.showElevatorInfoOnFirstRide = false;
      this.openInfoDialog(ELEVATOR_INFO_ID);
      return;
    }

    // Emit zone:enter / zone:exit events when player crosses zone boundaries.
    // Subscribed handlers (registered in registerZones) react to these events
    // to show/hide ElevatorButtons and InfoIcon — no setVisible calls here.
    this.zoneManager.update();

    // Keyboard info shortcut: synchronous zone query avoids needing an event.
    const activeZone = this.zoneManager.getActiveZone();
    if (infoPressed && activeZone && !this.dialogOpen) {
      this.openInfoDialog(activeZone);
      return;
    }

    // Ride elevator with Up/Down keys or on-screen buttons when standing on it
    if (this.playerOnElevator) {
      const input = inputMgr.getState();
      const btnState = this.elevatorButtons?.getState();
      const up = input.up || (btnState?.up ?? false);
      const down = input.down || (btnState?.down ?? false);
      this.elevator.ride(up, down);
      this.constrainPlayerToElevatorCab();

      // Sync player Y velocity with the elevator for smooth riding
      const platBody = this.elevator.platform.body as Phaser.Physics.Arcade.Body;
      if (platBody.velocity.y !== 0) {
        (this.player.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(platBody.velocity.y);
      }
    } else {
      this.elevator.ride(false, false);
    }

    // Switch music when the elevator starts / stops moving
    const elevatorMoving = this.elevator.getIsMoving();
    if (elevatorMoving && !this.wasElevatorMoving) {
      eventBus.emit('music:play', 'music_elevator_ride');
    } else if (!elevatorMoving && this.wasElevatorMoving) {
      eventBus.emit('music:play', 'music_elevator_jazz');
    }
    this.wasElevatorMoving = elevatorMoving;

    this.elevator.updateVisuals();
    this.checkFloorEntry();
    this.checkFloor0Transition();
  }

  /** Is the player standing on the elevator platform this frame? */
  private isStandingOnElevator(): boolean {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (!onGround) return false;

    const dx = Math.abs(this.player.sprite.x - this.elevator.platform.x);
    // Distance from player's body-bottom (feet) to elevator platform center.
    const dy = body.bottom - this.elevator.platform.y;
    return (
      dx < HubScene.ELEVATOR_STAND_X_TOLERANCE
      && dy >= HubScene.ELEVATOR_STAND_Y_MIN
      && dy <= HubScene.ELEVATOR_STAND_Y_MAX
    );
  }

  /** Prevent stepping out of the cab while the elevator is between floors. */
  private constrainPlayerToElevatorCab(): void {
    if (this.elevator.getFloorAtCurrentPosition() !== null) return;

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const left = this.elevator.platform.x - HubScene.ELEVATOR_CAB_HALF_WIDTH + HubScene.ELEVATOR_STEP_OUT_X_MARGIN;
    const right = this.elevator.platform.x + HubScene.ELEVATOR_CAB_HALF_WIDTH - HubScene.ELEVATOR_STEP_OUT_X_MARGIN;
    const clampedX = Phaser.Math.Clamp(this.player.sprite.x, left, right);

    if (clampedX !== this.player.sprite.x) {
      this.player.sprite.setX(clampedX);
      body.setVelocityX(0);
    }
  }

  /** Detect player stepping onto a floor platform (not elevator, not lobby). */
  private checkFloorEntry(): void {
    if (this.playerOnElevator) return;

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down) return;

    // Player is on solid ground (platform, not elevator) — check which floor
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
    if (this.playerOnElevator) return;

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

  /* ---- info setup ---- */


  private setupElevatorInfo(): void {
    if (hasBeenSeen(ELEVATOR_INFO_ID)) {
      this.showElevatorInfoOnFirstRide = false;
      this.createInfoIcon();
    } else {
      // InfoIcon is created after the first dialog close (see openInfoDialog).
      this.showElevatorInfoOnFirstRide = true;
    }
  }

  /**
   * Create the InfoIcon for the elevator zone. The icon starts hidden;
   * zone:enter / zone:exit events (wired in registerZones) control its
   * visibility from this point on.
   */
  private createInfoIcon(): void {
    this.infoIcon = new InfoIcon(
      this,
      GAME_WIDTH / 2 + 310,
      GAME_HEIGHT - 30,
      () => this.openInfoDialog(ELEVATOR_INFO_ID),
    );
    // Hidden by default — zone:enter will reveal it when the player returns
    // to the elevator. ZoneManager starts zones inactive and never emits an
    // initial zone:exit, so we must explicitly set the starting state.
    this.infoIcon.setVisible(false);
    // Direct call: badge is scene-internal state, not a cross-system concern.
    if (QUIZ_DATA[ELEVATOR_INFO_ID]) {
      this.infoIcon.setQuizBadge(this, isQuizPassed(ELEVATOR_INFO_ID));
    }
  }

  /* ---- info / quiz dialogs ---- */

  private openInfoDialog(infoId: string): void {
    if (this.dialogOpen) return;
    this.dialogOpen = true;

    const infoDef = INFO_POINTS[infoId];
    if (!infoDef) { this.dialogOpen = false; return; }

    const hasQuiz = !!QUIZ_DATA[infoId];

    this.activeDialog = new InfoDialog(
      this,
      infoDef.content,
      () => {
        this.dialogOpen = false;
        this.activeDialog = undefined;

        if (!this.infoIcon) {
          markSeen(infoId);
          this.createInfoIcon();
        }
      },
      hasQuiz ? {
        onQuizStart: () => this.openQuizDialog(infoId),
        quizStatus: {
          passed: isQuizPassed(infoId),
          canRetry: canRetryQuiz(infoId),
          cooldownSeconds: Math.ceil(getCooldownRemaining(infoId) / 1000),
        },
      } : undefined,
    );
  }

  private openQuizDialog(infoId: string): void {
    if (this.dialogOpen) return;
    this.dialogOpen = true;

    const infoDef = INFO_POINTS[infoId];
    if (!infoDef) { this.dialogOpen = false; return; }

    this.activeQuiz = new QuizDialog(this, {
      infoId,
      floorId: infoDef.floorId,
      progression: this.progression,
      onClose: () => {
        this.dialogOpen = false;
        this.activeQuiz = undefined;
        // Direct call: badge refresh is parent-to-child, no cross-system event needed.
        if (this.infoIcon && QUIZ_DATA[infoId]) {
          this.infoIcon.setQuizBadge(this, isQuizPassed(infoId));
        }
      },
    });
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
