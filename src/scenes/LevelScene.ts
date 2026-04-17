import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, ELEVATOR_SPEED, FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA, FloorData } from '../config/levelData';
import { QUIZ_DATA } from '../config/quizData';
import { Player } from '../entities/Player';
import { Token } from '../entities/Token';
import { HUD } from '../ui/HUD';
import { ElevatorButtons } from '../ui/ElevatorButtons';
import { InfoIcon } from '../ui/InfoIcon';
import { DialogController } from '../ui/DialogController';
import { ZoneManager } from '../systems/ZoneManager';
import { eventBus } from '../systems/EventBus';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { markSeen } from '../systems/InfoDialogManager';
import { isQuizPassed } from '../systems/QuizManager';

export interface RoomElevator {
  x: number;
  minY: number;
  maxY: number;
  startY: number;
}

export interface LevelConfig {
  floorId: FloorId;
  platforms: Array<{ x: number; y: number; width: number }>;
  tokens: Array<{ x: number; y: number }>;
  exitPosition: { x: number; y: number };
  playerStart: { x: number; y: number };
  /** Small in-room elevators connecting platform tiers. */
  roomElevators: RoomElevator[];
  /**
   * Info zones placed in the level.
   * Each zone shows its icon and allows its dialog to open only when the
   * player is within zoneRadius pixels of (x, y). Default radius: 250.
   */
  infoPoints?: Array<{ x: number; y: number; contentId: string; zoneRadius?: number }>;
}

/**
 * Impossible-Mission-style single-screen room.
 *
 * - Fixed camera (no scrolling) — the room fits GAME_WIDTH × GAME_HEIGHT.
 * - Multiple platforms at different heights.
 * - Small in-room elevators the player rides with Up/Down.
 * - Exit door returns to the hub elevator shaft.
 */
export class LevelScene extends Phaser.Scene {
  protected player!: Player;
  protected hud!: HUD;
  protected progression!: ProgressionSystem;
  protected platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected tokenGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected exitDoor!: Phaser.GameObjects.Image;
  protected floorData!: FloorData;
  protected floorId!: FloorId;
  protected isTransitioning = false;
  protected interactPrompt?: Phaser.GameObjects.Text;
  protected auCollected = 0;

  /** In-room elevator platforms + their shaft graphics. */
  private roomLifts: Array<{
    platform: Phaser.Physics.Arcade.Image;
    shaft: Phaser.GameObjects.Graphics;
    minY: number;
    maxY: number;
  }> = [];

  /** Which room-lift is the player currently riding? (-1 = none) */
  private activeRoomLift = -1;

  /**
   * On-screen lift buttons for in-room elevators.
   * These are a gameplay mechanic (not content-zone gated) so visibility
   * is set directly based on physics state — not via zone events.
   */
  private liftButtons?: ElevatorButtons;

  /** Info + quiz dialog orchestration. */
  private dialogs!: DialogController;

  /**
   * Zone manager: each info point in the level config becomes a proximity
   * zone. ZoneManager emits zone:enter / zone:exit on the eventBus; the
   * subscribers wired in createInfoZones() show/hide icons in response.
   */
  private zoneManager = new ZoneManager();

  /**
   * InfoIcon instances keyed by their zone/content ID.
   * Kept here for direct badge refresh after quiz completion.
   */
  private infoIconsByZone = new Map<string, InfoIcon>();

  constructor(key: string, floorId: FloorId) {
    super({ key });
    this.floorId = floorId;
  }

  init(): void {
    this.progression = this.registry.get('progression') as ProgressionSystem;
    this.floorData = LEVEL_DATA[this.floorId];
    this.isTransitioning = false;
    this.auCollected = 0;
    this.roomLifts = [];
    this.activeRoomLift = -1;
    this.zoneManager.clear();
    this.infoIconsByZone.clear();
    this.dialogs = new DialogController(this, {
      progression: this.progression,
      getIconForContent: (id) => this.infoIconsByZone.get(id),
      onOpen: (id) => markSeen(id),
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.floorData.theme.backgroundColor);

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.createBackground();
    this.createPlatforms();
    this.createRoomElevators();
    this.createDecorations();
    this.createTokens();
    this.createExit();
    this.createPlayer();
    this.createUI();
    this.createInfoZones();

    this.cameras.main.setScroll(0, 0);

    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.physics.add.overlap(
      this.player.sprite,
      this.tokenGroup,
      this.onAUCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    for (let i = 0; i < this.roomLifts.length; i++) {
      const idx = i;
      this.physics.add.collider(this.player.sprite, this.roomLifts[i].platform, () => {
        this.activeRoomLift = idx;
      });
    }

    this.showFloorBanner();
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /* ---- background ---- */
  protected createBackground(): void {
    const g = this.add.graphics().setDepth(0);

    g.fillStyle(this.floorData.theme.backgroundColor);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    g.lineStyle(1, this.floorData.theme.wallColor, 0.15);
    for (let x = 0; x < GAME_WIDTH; x += 64) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 64) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }

    g.lineStyle(4, this.floorData.theme.platformColor, 0.8);
    g.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);
  }

  /* ---- platforms ---- */
  protected createPlatforms(): void {
    this.platformGroup = this.physics.add.staticGroup();
    this.buildPlatforms(this.getLevelConfig());
  }

  protected buildPlatforms(config: LevelConfig): void {
    const tileKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'platform_floor1' : 'platform_floor2';
    for (const plat of config.platforms) {
      for (let i = 0; i < plat.width; i++) {
        // plat.y is the walking surface; shift tile center down so tile top = plat.y
        const t = this.platformGroup.create(
          plat.x + i * TILE_SIZE + TILE_SIZE / 2, plat.y + TILE_SIZE / 2, tileKey,
        ) as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }
    }
  }

  /* ---- in-room elevators ---- */
  protected createRoomElevators(): void {
    const config = this.getLevelConfig();
    for (const re of config.roomElevators) {
      const shaft = this.add.graphics().setDepth(1);
      const shaftW = 80;
      shaft.fillStyle(0x060610, 0.85);
      shaft.fillRect(re.x - shaftW / 2, re.minY, shaftW, re.maxY - re.minY + 16);
      shaft.lineStyle(2, 0x00aaff, 0.5);
      shaft.lineBetween(re.x - shaftW / 2, re.minY, re.x - shaftW / 2, re.maxY + 16);
      shaft.lineBetween(re.x + shaftW / 2, re.minY, re.x + shaftW / 2, re.maxY + 16);

      const plat = this.physics.add.image(re.x, re.startY, 'room_elevator_platform');
      plat.setImmovable(true);
      (plat.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      plat.setDepth(3);

      this.roomLifts.push({ platform: plat, shaft, minY: re.minY, maxY: re.maxY });
    }
  }

  /* ---- decorations (override in subclass to add floor-specific props) ---- */
  protected createDecorations(): void { /* no-op by default */ }

  /* ---- tokens ---- */
  protected createTokens(): void {
    this.tokenGroup = this.physics.add.staticGroup();
    const config = this.getLevelConfig();
    const tokenKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';
    for (let i = 0; i < config.tokens.length; i++) {
      if (this.progression.isTokenCollected(this.floorId, i)) continue;
      const token = new Token(this, config.tokens[i].x, config.tokens[i].y, tokenKey);
      token.setData('tokenIndex', i);
      this.tokenGroup.add(token);
    }
  }

  /* ---- exit ---- */
  protected createExit(): void {
    const c = this.getLevelConfig();
    this.exitDoor = this.add.image(c.exitPosition.x, c.exitPosition.y, 'door_exit').setDepth(4);
    this.add.text(c.exitPosition.x, c.exitPosition.y - 70, '\u2190 ELEVATOR', {
      fontFamily: 'monospace', fontSize: '14px', color: '#aaddff',
    }).setOrigin(0.5).setDepth(5);
  }

  /* ---- player ---- */
  protected createPlayer(): void {
    const c = this.getLevelConfig();
    this.player = new Player(this, c.playerStart.x, c.playerStart.y);
    this.player.sprite.setCollideWorldBounds(true);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#ffdd44', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setDepth(20).setVisible(false);
  }

  /* ---- UI ---- */
  protected createUI(): void {
    this.hud = new HUD(this, this.progression);
    this.liftButtons = new ElevatorButtons(this, 48);
  }

  /* ---- info zones ---- */

  /**
   * Register each info point from the level config as a proximity zone.
   *
   * Zone events from ZoneManager drive icon visibility — the update loop
   * does not call setVisible() on icons. To use a non-circular zone shape,
   * override this method in a subclass and provide a custom check() lambda.
   *
   * A single pair of eventBus listeners handles all zones in this scene.
   * They are removed on scene shutdown to prevent listener accumulation.
   */
  protected createInfoZones(): void {
    const config = this.getLevelConfig();
    if (!config.infoPoints?.length) return;

    const DEFAULT_ZONE_RADIUS = 250;

    // One subscriber pair for all zones in this scene — routes by zoneId.
    const onEnter = (...args: unknown[]) => {
      this.infoIconsByZone.get(args[0] as string)?.setVisible(true);
    };
    const onExit = (...args: unknown[]) => {
      this.infoIconsByZone.get(args[0] as string)?.setVisible(false);
    };

    eventBus.on('zone:enter', onEnter);
    eventBus.on('zone:exit', onExit);

    this.events.once('shutdown', () => {
      eventBus.off('zone:enter', onEnter);
      eventBus.off('zone:exit', onExit);
    });

    for (const ip of config.infoPoints) {
      const radius = ip.zoneRadius ?? DEFAULT_ZONE_RADIUS;

      const icon = new InfoIcon(this, ip.x, ip.y - 40, () => {
        this.dialogs.open(ip.contentId);
      });
      // Hidden by default — zone:enter will reveal it when the player enters
      // the zone. ZoneManager starts zones inactive and never emits an initial
      // zone:exit, so we must explicitly set the starting state here.
      icon.setVisible(false);
      // Direct call: initial badge state is scene-internal, not a cross-system event.
      if (QUIZ_DATA[ip.contentId]) {
        icon.setQuizBadge(this, isQuizPassed(ip.contentId));
      }

      this.infoIconsByZone.set(ip.contentId, icon);
      this.zoneManager.register(
        ip.contentId,
        () => Phaser.Math.Distance.Between(
          this.player.sprite.x, this.player.sprite.y,
          ip.x, ip.y,
        ) < radius,
      );
    }
  }

  /* ---- banner ---- */
  protected showFloorBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, this.floorData.name, {
      fontFamily: 'monospace', fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, this.floorData.description, {
      fontFamily: 'monospace', fontSize: '18px', color: '#aabbcc',
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: [banner, sub], alpha: 0, duration: 500, delay: 2000,
      onComplete: () => { banner.destroy(); sub.destroy(); },
    });
  }

  /* ---- AU collection ---- */
  protected onAUCollect(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    tokenObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const token = tokenObj as Token;
    const tokenIndex = token.getData('tokenIndex') as number;
    token.collect();
    this.progression.collectAU(this.floorId, tokenIndex);
    this.auCollected++;
    this.cameras.main.flash(100, 255, 215, 0, false, undefined, this);
  }

  /* ---- default level config (overridden by subclasses) ---- */
  protected getLevelConfig(): LevelConfig {
    return {
      floorId: this.floorId,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 120, y: GAME_HEIGHT - 180 },
      playerStart: { x: 120, y: GAME_HEIGHT - 200 },
    };
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;
    if (this.dialogs.isOpen) return;

    this.player.update(delta);
    this.hud.update();
    this.updateRoomElevators();

    // Emit zone:enter / zone:exit events when player crosses zone boundaries.
    // Subscribed handlers (wired in createInfoZones) react to show/hide icons.
    this.zoneManager.update();

    this.checkExitProximity();
  }

  /* ---- ride in-room elevators ---- */
  private updateRoomElevators(): void {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    let onLift = false;
    if (onGround) {
      for (let i = 0; i < this.roomLifts.length; i++) {
        const lift = this.roomLifts[i];
        const dx = Math.abs(this.player.sprite.x - lift.platform.x);
        const dy = this.player.sprite.y + (body.halfHeight) - lift.platform.y;
        if (dx < 50 && dy >= -4 && dy <= 12) {
          this.activeRoomLift = i;
          onLift = true;
          break;
        }
      }
    }

    // Lift buttons are a gameplay mechanic (riding in-room lifts), not a
    // content zone, so visibility is set directly from physics state here.
    this.liftButtons?.setVisible(onLift);

    if (!onLift) {
      this.activeRoomLift = -1;
      for (const lift of this.roomLifts) {
        lift.platform.setVelocityY(0);
      }
      return;
    }

    const input = this.player.getInputManager().getState();
    const lift = this.roomLifts[this.activeRoomLift];
    const btnState = this.liftButtons?.getState();
    const up = input.up || (btnState?.up ?? false);
    const down = input.down || (btnState?.down ?? false);

    if (up) {
      lift.platform.setVelocityY(-ELEVATOR_SPEED);
    } else if (down) {
      lift.platform.setVelocityY(ELEVATOR_SPEED);
    } else {
      lift.platform.setVelocityY(0);
    }

    if (lift.platform.y <= lift.minY) {
      lift.platform.y = lift.minY;
      lift.platform.setVelocityY(0);
    }
    if (lift.platform.y >= lift.maxY) {
      lift.platform.y = lift.maxY;
      lift.platform.setVelocityY(0);
    }
  }

  /* ---- exit check ---- */
  private checkExitProximity(): void {
    const d = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y,
      this.exitDoor.x, this.exitDoor.y,
    );
    if (d < 90) {
      this.interactPrompt?.setText('Press E \u2192 Elevator').setPosition(
        this.exitDoor.x - 60, this.exitDoor.y - 90,
      ).setVisible(true);
      if (this.player.getInputManager().isInteractJustPressed()) this.returnToHub();
    } else {
      this.interactPrompt?.setVisible(false);
    }
  }

  protected returnToHub(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start('HubScene'));
  }
}
