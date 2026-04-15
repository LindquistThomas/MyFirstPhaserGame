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
import { hasBeenSeen, markSeen } from '../systems/InfoDialogManager';
import { isQuizPassed, canRetryQuiz, getCooldownRemaining } from '../systems/QuizManager';

const ELEVATOR_INFO_ID = 'architecture-elevator';

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

  /** On-screen elevator buttons (shared component). */
  private elevatorButtons?: ElevatorButtons;

  private showElevatorInfoOnFirstRide = false;
  private dialogOpen = false;
  private activeDialog?: InfoDialog;
  private activeQuiz?: QuizDialog;

  /**
   * Zone manager controls which info icon is visible based on where the
   * player is. Each zone defines its own check() and contentId.
   */
  private zoneManager = new ZoneManager();

  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;

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
    this.playerOnElevator = false;
    this.dialogOpen = false;
    this.cameras.main.setBackgroundColor(COLORS.background);

    const worldHeight = 1600;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, worldHeight);

    this.createShaftBackground(worldHeight);
    this.createPlatforms(worldHeight);
    this.createPlayer(worldHeight);
    this.createElevator(worldHeight);
    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, worldHeight);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.setupElevatorInfo();
  }

  /* ---- background ---- */
  private createShaftBackground(worldHeight: number): void {
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;

    for (let y = 0; y < worldHeight; y += TILE_SIZE) {
      this.add.tileSprite(cx, y, sw, TILE_SIZE, 'elevator_shaft').setDepth(0);
    }

    // Bright rails on each side (Impossible Mission style)
    const rail = this.add.graphics();
    rail.fillStyle(0x00aaff, 0.6);
    rail.fillRect(cx - sw / 2 - 8, 0, 8, worldHeight);
    rail.fillRect(cx + sw / 2, 0, 8, worldHeight);
    rail.lineStyle(2, 0x005588, 0.4);
    rail.lineBetween(cx - sw / 2 + 20, 0, cx - sw / 2 + 20, worldHeight);
    rail.lineBetween(cx + sw / 2 - 20, 0, cx + sw / 2 - 20, worldHeight);
    rail.setDepth(1);

    // Horizontal cross-beams every 200px
    const beams = this.add.graphics();
    beams.lineStyle(1, 0x003355, 0.3);
    for (let y = 0; y < worldHeight; y += 200) {
      beams.lineBetween(cx - sw / 2, y, cx + sw / 2, y);
    }
    beams.setDepth(1);
  }

  /* ---- platforms ---- */
  private createPlatforms(worldHeight: number): void {
    this.platforms = this.physics.add.staticGroup();
    const positions = this.getFloorYPositions(worldHeight);
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;

    for (const [floorId, y] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      const fd = LEVEL_DATA[fId];
      const unlocked = this.progression.isFloorUnlocked(fId);

      for (let x = 0; x < cx - sw / 2; x += TILE_SIZE) {
        const t = this.platforms.create(x + TILE_SIZE / 2, y, 'platform_tile') as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }
      for (let x = cx + sw / 2; x < GAME_WIDTH; x += TILE_SIZE) {
        const t = this.platforms.create(x + TILE_SIZE / 2, y, 'platform_tile') as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }

      this.add.text(20, y - 60, `F${fId}`, {
        fontFamily: 'monospace', fontSize: '28px',
        color: COLORS.hudText, fontStyle: 'bold',
      }).setDepth(5);

      if (fd) {
        const nameColor = unlocked ? '#8899bb' : '#664444';
        this.add.text(80, y - 56, fd.name, {
          fontFamily: 'monospace', fontSize: '18px', color: nameColor,
        }).setDepth(5);
      }

      if (fId !== FLOORS.LOBBY) {
        const arrowColor = unlocked ? '#00ff88' : '#ff4444';
        const label = unlocked ? '\u2192 ENTER' : `LOCKED: ${this.progression.getAUNeededForFloor(fId)} AU`;
        this.add.text(cx + sw / 2 + 20, y - 50, label, {
          fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
        }).setDepth(5);
      }
    }
  }

  /* ---- elevator ---- */
  private createElevator(worldHeight: number): void {
    const positions = this.getFloorYPositions(worldHeight);
    const cx = GAME_WIDTH / 2;
    const startY = positions[this.progression.getCurrentFloor()] - 8;

    this.elevator = new Elevator(this, cx, startY);

    for (const [id, y] of Object.entries(positions)) {
      this.elevator.addFloor(Number(id), y - 8);
    }

    this.physics.add.collider(this.player.sprite, this.elevator.platform, () => {
      this.playerOnElevator = true;
    });
  }

  /* ---- player ---- */
  private createPlayer(worldHeight: number): void {
    const positions = this.getFloorYPositions(worldHeight);
    const y = positions[this.progression.getCurrentFloor()] - 80;

    this.player = new Player(this, GAME_WIDTH / 2, y);
    this.physics.add.collider(this.player.sprite, this.platforms);
  }

  /* ---- UI ---- */
  private createUI(): void {
    this.hud = new HUD(this, this.progression);

    // Instruction text (scroll-fixed)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '\u2191\u2193  Ride Elevator  |  \u2190 \u2192  Walk  |  SPACE  Flip', {
      fontFamily: 'monospace', fontSize: '13px', color: '#556677',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    this.elevatorButtons = new ElevatorButtons(this, 56);
  }

  /* ---- helpers ---- */
  private getFloorYPositions(worldHeight: number): Record<number, number> {
    return {
      [FLOORS.LOBBY]: worldHeight - 128,
      [FLOORS.PLATFORM_TEAM]: worldHeight - 600,
      [FLOORS.CLOUD_TEAM]: worldHeight - 1072,
    };
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const inputMgr = this.player.getInputManager();
    const infoPressed = inputMgr.isInfoJustPressed();

    if (this.dialogOpen) return;

    this.player.update(delta);
    this.hud.update();

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const onElevator = body.blocked.down && this.isOverElevator();

    this.playerOnElevator = onElevator;

    if (this.playerOnElevator && this.showElevatorInfoOnFirstRide) {
      this.showElevatorInfoOnFirstRide = false;
      this.openInfoDialog(ELEVATOR_INFO_ID);
      return;
    }

    // Each zone's icon visibility is updated here. activeZone is the
    // contentId of whichever zone the player is currently inside, or null.
    const activeZone = this.zoneManager.update();

    if (infoPressed && activeZone && !this.dialogOpen) {
      this.openInfoDialog(activeZone);
      return;
    }

    // Show / hide elevator buttons (resets pressed state when hiding)
    this.elevatorButtons?.setVisible(this.playerOnElevator);

    // Ride elevator with Up/Down keys or on-screen buttons when standing on it
    if (this.playerOnElevator) {
      const input = inputMgr.getState();
      const btnState = this.elevatorButtons?.getState();
      const up = input.up || (btnState?.up ?? false);
      const down = input.down || (btnState?.down ?? false);
      this.elevator.ride(up, down);
    } else {
      this.elevator.ride(false, false);
    }

    this.elevator.updateVisuals();
    this.checkFloorEntry();
  }

  /** Is the player horizontally within the elevator shaft? */
  private isOverElevator(): boolean {
    const px = this.player.sprite.x;
    const ex = this.elevator.platform.x;
    return Math.abs(px - ex) < 90;
  }

  /** Detect player stepping onto a floor platform (not elevator, not lobby). */
  private checkFloorEntry(): void {
    if (this.playerOnElevator) return;

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down) return;

    // Player is on solid ground (platform, not elevator) — check which floor
    const py = this.player.sprite.y;
    const px = this.player.sprite.x;
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;

    // Player must be outside the shaft
    if (px > cx - sw / 2 + 20 && px < cx + sw / 2 - 20) return;

    const worldHeight = 1600;
    const positions = this.getFloorYPositions(worldHeight);

    for (const [floorId, floorY] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue;

      if (Math.abs(py - (floorY - 64)) < 40) {
        if (this.progression.isFloorUnlocked(fId)) {
          this.enterFloor(fId);
          return;
        }
      }
    }
  }

  /* ---- info zone setup ---- */

  private setupElevatorInfo(): void {
    if (hasBeenSeen(ELEVATOR_INFO_ID)) {
      this.showElevatorInfoOnFirstRide = false;
      this.registerElevatorZone();
    } else {
      // Zone icon registered after the first dialog is closed (see openInfoDialog).
      this.showElevatorInfoOnFirstRide = true;
    }
  }

  /**
   * Register the elevator as a named zone.
   * The zone is active whenever the player is standing on the elevator cab.
   * Extend this pattern to add more hub zones: each gets its own check()
   * lambda, contentId, and icon position.
   */
  private registerElevatorZone(): void {
    const icon = new InfoIcon(
      this,
      GAME_WIDTH / 2 + 310,
      GAME_HEIGHT - 30,
      () => this.openInfoDialog(ELEVATOR_INFO_ID),
    );

    this.zoneManager.register(
      {
        contentId: ELEVATOR_INFO_ID,
        check: () => this.playerOnElevator,
      },
      icon,
    );

    this.zoneManager.refreshBadge(this, ELEVATOR_INFO_ID);
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

        // First time closing: mark seen and register the zone so the icon
        // appears on subsequent elevator rides.
        if (!hasBeenSeen(infoId)) {
          markSeen(infoId);
          this.registerElevatorZone();
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
        this.zoneManager.refreshBadge(this, infoId);
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
}
