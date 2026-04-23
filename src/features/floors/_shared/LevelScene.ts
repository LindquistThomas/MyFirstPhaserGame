import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, ELEVATOR_SPEED, FLOORS, FloorId } from '../../../config/gameConfig';
import { LEVEL_DATA, FloorData } from '../../../config/levelData';
import { Player } from '../../../entities/Player';
import { Enemy } from '../../../entities/Enemy';
import { DroppedAU } from '../../../entities/DroppedAU';
import { HUD } from '../../../ui/HUD';
import { ElevatorButtons } from '../../../ui/ElevatorButtons';
import { DialogController } from '../../../ui/DialogController';
import { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { GameStateManager } from '../../../systems/GameStateManager';
import { allKeyLabels } from '../../../input';
import type { NavigationContext } from '../../../scenes/NavigationContext';
import { LevelEnemySpawner } from './LevelEnemySpawner';
import { LevelTokenManager } from './LevelTokenManager';
import { LevelCoffeeManager } from './LevelCoffeeManager';
import { LevelZoneSetup } from './LevelZoneSetup';
import { createLevelDialogs } from './LevelDialogBindings';
import { drawSceneBackdrop, type FloorPatternId } from './sceneBackdrop';
import { drawFloorAccents } from './floorAccents';
import { theme } from '../../../style/theme';

/**
 * Decorative background pattern assignment per floor. Each motif echoes
 * the floor's identity without clashing with decor (see `floorPatterns.ts`).
 * Floors not listed fall back to the quiet default grid.
 */
const FLOOR_PATTERNS: Partial<Record<FloorId, FloorPatternId>> = {
  [FLOORS.LOBBY]: 'grid',
  [FLOORS.PLATFORM_TEAM]: 'blueprint',
  [FLOORS.BUSINESS]: 'wood',
  [FLOORS.EXECUTIVE]: 'terrazzo',
  [FLOORS.PRODUCTS]: 'dots',
};

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
   * Thin catwalks / walkways.
   *
   * Unlike `platforms` (which use the 128×128 floor tile as both visual
   * and physics body — great for the ground, terrible for mezzanines
   * because the tile body extends 128 px downward and crushes the
   * headroom beneath), catwalks are a ~20 px thin rectangle with a
   * matching graphic on top. Use these for any floating walkway.
   *
   * `x`, `y` = top-left of the walking surface (same semantics as
   * `platforms.y` — the top of the slab, not its centre). `width` is in
   * pixels. `thickness` defaults to 20.
   */
  catwalks?: Array<{ x: number; y: number; width: number; thickness?: number }>;
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
  /**
   * Consumable coffee pickups. Applying a caffeine buff on collection —
   * faster ground speed + a slightly higher jump for a few seconds.
   * Not persisted; respawns every scene entry.
   */
  coffees?: Array<{ x: number; y: number }>;
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
  protected gameState!: GameStateManager;
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
  private coffeeMgr!: LevelCoffeeManager;
  private zones!: LevelZoneSetup;

  /** Grounding shadow tracked to the player each frame. */
  private playerShadow?: Phaser.GameObjects.Image;
  /** Shadows tracked to each spawned enemy (same index as enemies[]). */
  private enemyShadows: Array<Phaser.GameObjects.Image | undefined> = [];

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
    this.gameState = this.registry.get('gameState') as GameStateManager;
    this.progression = this.gameState.progression;
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
    this.coffeeMgr = new LevelCoffeeManager({
      scene: this,
      player: this.player,
    });
    this.zones = new LevelZoneSetup({
      scene: this,
      player: this.player,
      dialogs: this.buildDialogs(),
      gameState: this.gameState,
    });

    const cfg = this.getLevelConfig();
    this.tokenMgr.spawn(cfg);
    this.enemySpawner.spawn(cfg);
    this.coffeeMgr.spawn(cfg);
    this.zones.create(cfg);

    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.tokenMgr.wireColliders();
    this.enemySpawner.wireColliders();
    this.coffeeMgr.wireColliders();

    for (let i = 0; i < this.roomLifts.length; i++) {
      const idx = i;
      this.physics.add.collider(this.player.sprite, this.roomLifts[i].platform, () => {
        this.activeRoomLift = idx;
      });
    }

    this.cameras.main.setScroll(0, 0);
    this.showFloorBanner();
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.createAtmosphericFx();
  }

  /**
   * Atmospheric layer added on top of the backdrop but behind gameplay:
   *   - Per-floor color grading overlay (very low alpha, theme-tinted).
   *   - Ambient floating motes (6–10 drifting particles).
   *   - Drop shadow tracked to the player.
   *   - Drop shadows tracked to each spawned enemy.
   */
  private createAtmosphericFx(): void {
    // 1. Color grading overlay — full-screen rect tinted with the floor's
    // token color (which reads as the floor's brand color) at 0.05 alpha.
    // Placed above backdrop (depth 0) and tiles (depth 2) but below the
    // player (depth 10) so platforms + decor stay legible.
    const gradeOverlay = this.add.graphics().setDepth(5.5).setScrollFactor(0);
    gradeOverlay.fillStyle(this.floorData.theme.tokenColor, 0.05);
    gradeOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 2. Ambient motes — slow-drifting tinted particles.
    if (this.textures.exists('particle')) {
      const motes = this.add.particles(0, 0, 'particle', {
        x: { min: 0, max: GAME_WIDTH },
        y: { min: 0, max: GAME_HEIGHT - 64 },
        speedY: { min: -12, max: -4 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.35, end: 0.1 },
        alpha: { start: 0.18, end: 0 },
        lifespan: { min: 6000, max: 11000 },
        frequency: 1200,
        quantity: 1,
        tint: this.floorData.theme.tokenColor,
      });
      motes.setDepth(1.5);
    }

    // 3. Player drop shadow — a dark ellipse tracked each frame so it
    // shrinks while airborne for height cueing.
    if (this.textures.exists('shadow_blob')) {
      this.playerShadow = this.add
        .image(this.player.sprite.x, this.player.sprite.y + 70, 'shadow_blob')
        .setDepth(9.5);
    }

    // 4. Enemy drop shadows, one per enemy, parented-by-index.
    for (const enemy of this.enemySpawner.enemies) {
      if (!this.textures.exists('shadow_blob')) break;
      const sh = this.add.image(enemy.x, enemy.y + 28, 'shadow_blob').setDepth(5.5).setScale(0.7);
      this.enemyShadows.push(sh);
    }
  }

  private updateAtmosphericFx(): void {
    // Player shadow: follow x, lock to ~feet y when grounded, otherwise
    // project down to the nearest surface below with a height-faded scale.
    if (this.playerShadow) {
      const p = this.player.sprite;
      const body = p.body as Phaser.Physics.Arcade.Body;
      const onGround = body.blocked.down || body.touching.down;
      this.playerShadow.setPosition(p.x, p.y + 70);
      if (onGround) {
        this.playerShadow.setAlpha(1).setScale(1);
      } else {
        // Fade + shrink with upward velocity for an airborne cue.
        const vy = body.velocity.y;
        const fade = Phaser.Math.Clamp(1 - Math.abs(vy) / 600, 0.3, 1);
        this.playerShadow.setAlpha(fade * 0.85).setScale(fade);
      }
    }

    // Enemy shadows: follow x, pin y to the body's bottom with a small
    // fixed offset. If an enemy has been destroyed, drop its shadow too.
    const enemies = this.enemySpawner.enemies;
    for (let i = 0; i < this.enemyShadows.length; i++) {
      const sh = this.enemyShadows[i];
      if (!sh) continue;
      const en = enemies[i];
      if (!en || en.defeated || !en.active) {
        sh.destroy();
        this.enemyShadows[i] = undefined;
        continue;
      }
      const body = en.body as Phaser.Physics.Arcade.Body | null;
      const footY = body ? body.bottom : en.y + 28;
      sh.setPosition(en.x, footY + 2);
    }
  }

  /** Construct the DialogController and stash it on this.dialogs. */
  private buildDialogs(): DialogController {
    this.dialogs = createLevelDialogs(this, {
      gameState: this.gameState,
      getIcon: (id) => this.zones.iconsByContentId.get(id),
    });
    return this.dialogs;
  }

  /* ---- background ---- */
  protected createBackground(): void {
    drawSceneBackdrop(this, {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      theme: {
        backgroundColor: this.floorData.theme.backgroundColor,
        wallColor: this.floorData.theme.wallColor,
        platformColor: this.floorData.theme.platformColor,
      },
      pattern: this.getBackgroundPattern(),
      patternSeed: this.floorId,
      drawAccents: (g) => this.drawBackgroundAccents(g),
    });
  }

  /**
   * Per-floor decorative pattern id. Default picks a motif matching the
   * floor's identity; subclasses can override to use a different pattern
   * or fall back to the quiet legacy grid.
   */
  protected getBackgroundPattern(): FloorPatternId {
    return FLOOR_PATTERNS[this.floorId] ?? 'grid';
  }

  /**
   * Subclass hook for per-floor silhouettes / prints painted on top of
   * the layered backdrop. Default behaviour dispatches to the per-floor
   * accent painter in `floorAccents.ts` (server racks, bar chart, arched
   * window, etc.) including one ambient tween per floor. Subclasses may
   * override to suppress or replace the motif.
   */
  protected drawBackgroundAccents(g: Phaser.GameObjects.Graphics): void {
    drawFloorAccents(this.floorId, {
      scene: this,
      g,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      theme: {
        backgroundColor: this.floorData.theme.backgroundColor,
        wallColor: this.floorData.theme.wallColor,
        platformColor: this.floorData.theme.platformColor,
        tokenColor: this.floorData.theme.tokenColor,
      },
    });
  }

  /* ---- platforms ---- */
  protected createPlatforms(): void {
    this.platformGroup = this.physics.add.staticGroup();
    const config = this.getLevelConfig();
    this.buildPlatforms(config);
    this.buildCatwalks(config);
  }

  protected buildPlatforms(config: LevelConfig): void {
    const tileKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'platform_floor1' : 'platform_floor2';
    for (const plat of config.platforms) {
      for (let i = 0; i < plat.width; i++) {
        // plat.y is the walking surface; shift tile center down so tile top = plat.y
        const tx = plat.x + i * TILE_SIZE + TILE_SIZE / 2;
        const ty = plat.y + TILE_SIZE / 2;
        const t = this.platformGroup.create(tx, ty, tileKey) as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
        // Deterministic scuff overlay on ~25% of placed tiles — picks the
        // same tiles across reloads so layout reads as authored, not random.
        // Hash: mix floor id + grid coords so every floor gets its own pattern.
        const hash = ((plat.x + i * 7) * 31 + plat.y * 17 + this.floorId * 53) & 0xff;
        if (hash < 64 && this.textures.exists('tile_detail_overlay')) {
          this.add.image(tx, ty, 'tile_detail_overlay').setDepth(2.5);
        }
      }
    }
  }

  /**
   * Thin floating walkways. A ~20 px rectangle with a static physics body is
   * added to the same platformGroup the ground tiles use, so every existing
   * collider (player, enemies, dropped AU, etc.) just works. On top, a small
   * graphic draws the slab face, a top rim, and subtle rivets so the catwalk
   * reads as a metal grating rather than a floating block.
   *
   * Using a thin body — rather than re-using the 128 px ground tile — keeps
   * headroom clear under mezzanines, which is the whole point of the primitive.
   */
  protected buildCatwalks(config: LevelConfig): void {
    if (!config.catwalks?.length) return;
    for (const c of config.catwalks) {
      const thickness = c.thickness ?? 20;
      const cx = c.x + c.width / 2;
      const cy = c.y + thickness / 2;

      // Physics body (invisible rectangle, added to platformGroup).
      const body = this.add.rectangle(cx, cy, c.width, thickness, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.platformGroup.add(body);

      // One-way: only collide from above, so the player can jump up
      // through a catwalk and land on top of it. Without this, the thin
      // body blocks a rising head even when there's plenty of room to
      // land on top (the classic platformer "jump-through" behaviour).
      const pbody = body.body as Phaser.Physics.Arcade.StaticBody;
      pbody.checkCollision.down = false;
      pbody.checkCollision.left = false;
      pbody.checkCollision.right = false;

      // Decorative face. Depth sits just above ground tiles (2) but below
      // props (3) so desks/diagrams in front still overlap correctly.
      const g = this.add.graphics().setDepth(2.2);
      const x = c.x, y = c.y, w = c.width, h = thickness;
      // Slab.
      g.fillStyle(0x4a5560, 1).fillRect(x, y, w, h);
      // Top rim — lighter stripe to read as a walking surface.
      g.fillStyle(0x8fa0b3, 1).fillRect(x, y, w, 3);
      // Bottom shadow edge.
      g.fillStyle(0x2a323c, 1).fillRect(x, y + h - 2, w, 2);
      // Rivets every ~32 px.
      g.fillStyle(0x1a2028, 1);
      for (let rx = x + 10; rx < x + w - 6; rx += 32) {
        g.fillRect(rx, y + 6, 2, 2);
        g.fillRect(rx, y + h - 8, 2, 2);
      }
      // Side caps so the end of the walkway reads as a thick edge piece.
      g.fillStyle(0x2a323c, 1);
      g.fillRect(x, y, 2, h);
      g.fillRect(x + w - 2, y, 2, h);
    }
  }

  /* ---- in-room elevators ---- */
  protected createRoomElevators(): void {
    const config = this.getLevelConfig();
    for (const re of config.roomElevators) {
      const shaft = this.add.graphics().setDepth(1);
      const shaftW = 80;
      shaft.fillStyle(theme.color.bg.overlay, 0.85);
      shaft.fillRect(re.x - shaftW / 2, re.minY, shaftW, re.maxY - re.minY + 16);
      shaft.lineStyle(2, theme.color.ui.border, 0.5);
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

  /**
   * Shared decoration helpers used by most floor scenes. Ambient plants and
   * the entry-signpost follow the same visual contract across rooms, so
   * they're centralized here and called from subclasses' `createDecorations`.
   */
  protected addAmbientPlants(
    plants: Array<{ x: number; kind: 'tall' | 'small'; depth?: number }>,
  ): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    for (const p of plants) {
      const yOff = p.kind === 'tall' ? 40 : 32;
      const depth = p.depth ?? (p.kind === 'tall' ? 3 : 11);
      this.add.image(p.x, G - yOff, `plant_${p.kind}`).setDepth(depth);
    }
  }

  protected addSignpost(opts: {
    x: number;
    label: string;
    color: string;
    fontSize?: number;
  }): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const fontSize = opts.fontSize ?? 13;
    this.add.image(opts.x, G - 60, 'info_board').setDepth(3);
    this.add.text(opts.x, G - 130, opts.label, {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: opts.color,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(4);
  }

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
      fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textPanel,
    }).setOrigin(0.5).setDepth(5);
  }

  /**
   * Swap the exit door between the closed ({@code door_exit}) and open
   * ({@code door_exit_open}) textures. Called by {@link checkExitProximity}
   * and by subclass overrides so the door visually opens while the player
   * is standing in the interaction zone.
   */
  protected setExitDoorOpen(open: boolean): void {
    const key = open ? 'door_exit_open' : 'door_exit';
    if (this.exitDoor.texture.key !== key) this.exitDoor.setTexture(key);
  }

  /* ---- player ---- */
  protected createPlayer(): void {
    const c = this.getLevelConfig();
    this.player = new Player(this, c.playerStart.x, c.playerStart.y);
    this.player.sprite.setCollideWorldBounds(true);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: theme.color.css.textWarn, backgroundColor: theme.color.css.bgDialog,
      padding: { x: theme.space.sm, y: theme.space.xs },
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
      fontFamily: 'monospace', fontSize: '48px', color: theme.color.css.textWhite, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, this.getBannerDescription(), {
      fontFamily: 'monospace', fontSize: '18px', color: theme.color.css.textSecondary,
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

    // Keep the Player ticking while a dialog is open so it can react to
    // the `modal` input context (zeroing velocity, switching to `idle`).
    // Other gameplay systems (enemies, room-lifts, zones, exit-proximity)
    // intentionally pause — the player is just reading the dialog.
    if (this.dialogs.isOpen) {
      this.player.update(delta);
      this.hud.update();
      this.updateAtmosphericFx();
      return;
    }

    this.player.update(delta);
    this.hud.update();
    this.updateRoomElevators();
    this.enemySpawner.update(_time, delta);
    this.updateAtmosphericFx();

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

  /** Debug overlay hook: expose spatial zones for DebugPlugin to render. */
  getDebugZones(): import('./LevelZoneSetup').DebugZone[] {
    return this.zones?.getDebugZones() ?? [];
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

    // Only clamp when moving out of bounds — otherwise starting at a
    // boundary (startY === maxY) would zero velocity every frame and
    // block motion back into range. Same tripwire as src/entities/Elevator.ts.
    const vy = (lift.platform.body as Phaser.Physics.Arcade.Body).velocity.y;
    if (lift.platform.y <= lift.minY && vy < 0) {
      lift.platform.y = lift.minY;
      lift.platform.setVelocityY(0);
    }
    if (lift.platform.y >= lift.maxY && vy > 0) {
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
    const near = d < 90;
    this.setExitDoorOpen(near);
    if (near) {
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
