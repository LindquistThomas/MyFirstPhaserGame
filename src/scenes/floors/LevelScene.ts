import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, ELEVATOR_SPEED, FLOORS, FloorId } from '../../config/gameConfig';
import { LEVEL_DATA, FloorData } from '../../config/levelData';
import { Player } from '../../entities/Player';
import { Enemy } from '../../entities/Enemy';
import { DroppedAU } from '../../entities/DroppedAU';
import { HUD } from '../../ui/HUD';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { DialogController } from '../../ui/DialogController';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { allKeyLabels } from '../../input';
import type { NavigationContext } from '../NavigationContext';
import { LevelEnemySpawner } from './LevelEnemySpawner';
import { LevelTokenManager } from './LevelTokenManager';
import { LevelZoneSetup } from './LevelZoneSetup';
import { createLevelDialogs } from './LevelDialogBindings';

export interface RoomElevator {
  x: number;
  minY: number;
  maxY: number;
  startY: number;
}

export interface LevelConfig {
  floorId: FloorId;
  platforms: Array<{ x: number; y: number; width: number }>;
  /**
   * Tokens in the room. `index` overrides the default array-position
   * index used to key into the ProgressionSystem's collected-tokens
   * state. Useful when two scenes share the same floorId and need
   * disjoint token-index ranges.
   */
  tokens: Array<{ x: number; y: number; index?: number }>;
  exitPosition: { x: number; y: number };
  playerStart: { x: number; y: number };
  /** Small in-room elevators connecting platform tiers. */
  roomElevators: RoomElevator[];
  /**
   * Info zones placed in the level.
   * Each zone shows its icon and allows its dialog to open only when the
   * player is within the zone shape. Default: 120 px circle.
   *
   * Prefer `zone` for precise anchor-sized regions (e.g. a signpost or
   * monitoring wall). `zoneRadius` is kept for simple back-compat.
   */
  infoPoints?: Array<{
    x: number;
    y: number;
    contentId: string;
    zoneRadius?: number;
    zone?:
      | { shape: 'circle'; radius: number }
      | { shape: 'rect'; width: number; height: number; offsetY?: number };
  }>;
  /**
   * Enemies placed in the level. Each entry is spawned in `createEnemies()`.
   * Enemies are scene-local: they have no persistence, respawn on scene re-entry.
   * `minX` / `maxX` default to ±radius around `x`.
   */
  enemies?: Array<{
    type: 'slime' | 'bot';
    x: number;
    y: number;
    minX?: number;
    maxX?: number;
    speed?: number;
  }>;
}

/**
 * Impossible-Mission-style single-screen room.
 *
 * - Fixed camera (no scrolling) — the room fits GAME_WIDTH × GAME_HEIGHT.
 * - Multiple platforms at different heights.
 * - Small in-room elevators the player rides with Up/Down.
 * - Exit door returns to the elevator shaft.
 *
 * Concerns are split across focused helpers:
 *   - {@link LevelEnemySpawner}  — spawn, physics, stomp/damage rules.
 *   - {@link LevelTokenManager}  — token group + dropped-AU recovery.
 *   - {@link LevelZoneSetup}     — info-point → proximity zone + icons.
 *   - {@link createLevelDialogs} — wiring the shared DialogController.
 */
export class LevelScene extends Phaser.Scene {
  protected player!: Player;
  protected hud!: HUD;
  protected progression!: ProgressionSystem;
  protected platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected exitDoor!: Phaser.GameObjects.Image;
  protected floorData!: FloorData;
  protected floorId!: FloorId;
  protected isTransitioning = false;
  protected interactPrompt?: Phaser.GameObjects.Text;

  /**
   * Which side of the elevator shaft this room sits on.
   * Used to place the player on return so they re-enter the elevator
   * on the same side they stepped off — default 'left'.
   */
  protected returnSide: 'left' | 'right' = 'left';

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
  protected dialogs!: DialogController;

  private enemySpawner!: LevelEnemySpawner;
  private tokenMgr!: LevelTokenManager;
  private zones!: LevelZoneSetup;

  constructor(key: string, floorId: FloorId) {
    super({ key });
    this.floorId = floorId;
  }

  /** Read-only view of spawned enemies (kept for subclass compat). */
  protected get enemies(): readonly Enemy[] {
    return this.enemySpawner?.enemies ?? [];
  }

  /** AU collected this visit (kept for subclass compat). */
  protected get auCollected(): number {
    return this.tokenMgr?.auCollected ?? 0;
  }

  protected get tokenGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.tokenMgr.tokenGroup;
  }

  protected get droppedAUGroup(): Phaser.Physics.Arcade.Group {
    return this.tokenMgr.droppedAUGroup;
  }

  init(): void {
    this.progression = this.registry.get('progression') as ProgressionSystem;
    this.floorData = LEVEL_DATA[this.floorId];
    this.isTransitioning = false;
    this.roomLifts = [];
    this.activeRoomLift = -1;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.floorData.theme.backgroundColor);
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.createBackground();
    this.createPlatforms();
    this.createRoomElevators();
    this.createDecorations();
    this.createExit();
    this.createPlayer();
    this.createUI();

    // Now that the player exists, instantiate the helper managers.
    this.tokenMgr = new LevelTokenManager({
      scene: this,
      floorId: this.floorId,
      floorData: this.floorData,
      progression: this.progression,
      player: this.player,
      platformGroup: this.platformGroup,
      camera: this.cameras.main,
    });
    this.enemySpawner = new LevelEnemySpawner({
      scene: this,
      floorId: this.floorId,
      progression: this.progression,
      player: this.player,
      platformGroup: this.platformGroup,
      droppedAUGroup: this.tokenMgr.droppedAUGroup,
      camera: this.cameras.main,
    });
    this.zones = new LevelZoneSetup({
      scene: this,
      player: this.player,
      dialogs: this.buildDialogs(),
    });

    const cfg = this.getLevelConfig();
    this.tokenMgr.spawn(cfg);
    this.enemySpawner.spawn(cfg);
    this.zones.create(cfg);

    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.tokenMgr.wireColliders();
    this.enemySpawner.wireColliders();

    for (let i = 0; i < this.roomLifts.length; i++) {
      const idx = i;
      this.physics.add.collider(this.player.sprite, this.roomLifts[i].platform, () => {
        this.activeRoomLift = idx;
      });
    }

    this.cameras.main.setScroll(0, 0);
    this.showFloorBanner();
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /** Construct the DialogController and stash it on this.dialogs. */
  private buildDialogs(): DialogController {
    this.dialogs = createLevelDialogs(this, {
      progression: this.progression,
      getIcon: (id) => this.zones.iconsByContentId.get(id),
    });
    return this.dialogs;
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

  /* ---- exit ---- */
  protected createExit(): void {
    const c = this.getLevelConfig();
    this.exitDoor = this.add.image(c.exitPosition.x, c.exitPosition.y, 'door_exit').setDepth(4);
    // Clickable/tappable — mouse and touch users can hit the door
    // directly instead of having to press Enter while standing next
    // to it. Dispatches the same Interact action a key press would.
    this.exitDoor.setInteractive({ useHandCursor: true });
    this.exitDoor.on('pointerdown', () => this.inputs.emit('Interact'));
    this.add.text(c.exitPosition.x, c.exitPosition.y - 70, '\u2190 ELEVATOR', {
      fontFamily: 'monospace', fontSize: '15px', color: '#aaddff',
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

  /* ---- banner ---- */
  /** Title shown in the floor-entry banner. Override in subclasses that
   *  share a floorId but represent a distinct room (e.g. Architecture Team
   *  on the Platform Team floor). */
  protected getBannerTitle(): string {
    return this.floorData.name;
  }

  /** Subtitle shown under the banner title. */
  protected getBannerDescription(): string {
    return this.floorData.description;
  }

  protected showFloorBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, this.getBannerTitle(), {
      fontFamily: 'monospace', fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, this.getBannerDescription(), {
      fontFamily: 'monospace', fontSize: '18px', color: '#aabbcc',
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: [banner, sub], alpha: 0, duration: 500, delay: 2000,
      onComplete: () => { banner.destroy(); sub.destroy(); },
    });
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

    const infoPressed = this.inputs.justPressed('ToggleInfo');

    if (this.dialogs.isOpen) return;

    this.player.update(delta);
    this.hud.update();
    this.updateRoomElevators();
    this.enemySpawner.update(_time, delta);

    // Emit zone:enter / zone:exit events when player crosses zone boundaries.
    this.zones.update();

    // I key opens the info dialog for the currently-active content zone.
    const activeZone = this.zones.getActiveZone();
    if (infoPressed && activeZone && !this.dialogs.isOpen) {
      this.dialogs.open(activeZone);
      return;
    }

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

    const inputs = this.inputs;
    const lift = this.roomLifts[this.activeRoomLift];
    const btnState = this.liftButtons?.getState();
    const up = inputs.isDown('MoveUp') || (btnState?.up ?? false);
    const down = inputs.isDown('MoveDown') || (btnState?.down ?? false);

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
  protected checkExitProximity(): void {
    const d = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y,
      this.exitDoor.x, this.exitDoor.y,
    );
    if (d < 90) {
      this.interactPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 Elevator`).setPosition(
        this.exitDoor.x - 60, this.exitDoor.y - 90,
      ).setVisible(true);
      if (this.inputs.justPressed('Interact')) this.returnToElevator();
    } else {
      this.interactPrompt?.setVisible(false);
    }
  }

  protected returnToElevator(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    const ctx: NavigationContext = {
      fromFloor: this.floorId,
      spawnSide: this.returnSide,
    };
    this.time.delayedCall(500, () => this.scene.start('ElevatorScene', ctx));
  }
}
