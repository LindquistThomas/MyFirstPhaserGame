import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, ELEVATOR_SPEED, FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA, FloorData } from '../config/levelData';
import { Player } from '../entities/Player';
import { Token } from '../entities/Token';
import { HUD } from '../ui/HUD';
import { ProgressionSystem } from '../systems/ProgressionSystem';

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
  protected tokenGroup!: Phaser.Physics.Arcade.Group;
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
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.floorData.theme.backgroundColor);

    // Single-screen — no scrolling
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.createBackground();
    this.createPlatforms();
    this.createRoomElevators();
    this.createTokens();
    this.createExit();
    this.createPlayer();
    this.createUI();

    // Fixed camera (no follow, no scroll)
    this.cameras.main.setScroll(0, 0);

    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.physics.add.overlap(
      this.player.sprite,
      this.tokenGroup,
      this.onAUCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Colliders for each room elevator
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
    // Room walls
    const g = this.add.graphics().setDepth(0);

    // Fill background
    g.fillStyle(this.floorData.theme.backgroundColor);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Wall texture (subtle grid)
    g.lineStyle(1, this.floorData.theme.wallColor, 0.15);
    for (let x = 0; x < GAME_WIDTH; x += 64) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 64) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Room border (bright, Impossible-Mission-style)
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
        const t = this.platformGroup.create(
          plat.x + i * TILE_SIZE + TILE_SIZE / 2, plat.y, tileKey,
        ) as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }
    }
  }

  /* ---- in-room elevators ---- */
  protected createRoomElevators(): void {
    const config = this.getLevelConfig();
    for (const re of config.roomElevators) {
      // Shaft background
      const shaft = this.add.graphics().setDepth(1);
      const shaftW = 80;
      shaft.fillStyle(0x060610, 0.85);
      shaft.fillRect(re.x - shaftW / 2, re.minY, shaftW, re.maxY - re.minY + 16);
      // Shaft rails
      shaft.lineStyle(2, 0x00aaff, 0.5);
      shaft.lineBetween(re.x - shaftW / 2, re.minY, re.x - shaftW / 2, re.maxY + 16);
      shaft.lineBetween(re.x + shaftW / 2, re.minY, re.x + shaftW / 2, re.maxY + 16);

      // Elevator platform
      const plat = this.physics.add.image(re.x, re.startY, 'room_elevator_platform');
      plat.setImmovable(true);
      (plat.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      plat.setDepth(3);

      this.roomLifts.push({ platform: plat, shaft, minY: re.minY, maxY: re.maxY });
    }
  }

  /* ---- tokens ---- */
  protected createTokens(): void {
    this.tokenGroup = this.physics.add.group({ allowGravity: false });
    const config = this.getLevelConfig();
    const tokenKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';
    for (const pos of config.tokens) {
      this.tokenGroup.add(new Token(this, pos.x, pos.y, tokenKey));
    }
  }

  /* ---- exit ---- */
  protected createExit(): void {
    const c = this.getLevelConfig();
    this.exitDoor = this.add.image(c.exitPosition.x, c.exitPosition.y, 'door_exit').setDepth(4);
    this.add.text(c.exitPosition.x, c.exitPosition.y - 70, '← ELEVATOR', {
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
    token.collect();
    this.progression.collectAU(this.floorId);
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

    this.player.update(delta);
    this.hud.update();
    this.updateRoomElevators();
    this.checkExitProximity();
  }

  /* ---- ride in-room elevators ---- */
  private updateRoomElevators(): void {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    // Determine which lift (if any) the player is standing on right now.
    // The collider callback sets activeRoomLift, but we verify proximity
    // and ground contact each frame to avoid stale references.
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

    if (!onLift) {
      this.activeRoomLift = -1;
      // Stop all lifts
      for (const lift of this.roomLifts) {
        lift.platform.setVelocityY(0);
      }
      return;
    }

    // Ride the active lift with Up/Down
    const input = this.player.getInputManager().getState();
    const lift = this.roomLifts[this.activeRoomLift];

    if (input.up) {
      lift.platform.setVelocityY(-ELEVATOR_SPEED);
    } else if (input.down) {
      lift.platform.setVelocityY(ELEVATOR_SPEED);
    } else {
      lift.platform.setVelocityY(0);
    }

    // Clamp to shaft bounds
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
      this.interactPrompt?.setText('Press E → Elevator').setPosition(
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
