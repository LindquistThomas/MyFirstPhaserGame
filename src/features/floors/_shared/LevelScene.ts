import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FLOORS, FloorId } from '../../../config/gameConfig';
import { LEVEL_DATA, FloorData } from '../../../config/levelData';
import { Player } from '../../../entities/Player';
import { Enemy } from '../../../entities/Enemy';
import { HUD } from '../../../ui/HUD';
import { DialogController } from '../../../ui/DialogController';
import { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { GameStateManager } from '../../../systems/GameStateManager';
import { MovingPlatform } from '../../../entities/MovingPlatform';
import { LevelEnemySpawner } from './LevelEnemySpawner';
import { LevelTokenManager } from './LevelTokenManager';
import { LevelCoffeeManager } from './LevelCoffeeManager';
import { LevelFridgeManager } from './LevelFridgeManager';
import { LevelZoneSetup } from './LevelZoneSetup';
import { LevelRoomElevators } from './LevelRoomElevators';
import { createLevelDialogs } from './LevelDialogBindings';
import { type FloorPatternId } from './sceneBackdrop';
import { theme } from '../../../style/theme';
import { createSceneLifecycle } from '../../../systems/sceneLifecycle';
import { CallElevatorButton } from '../../../ui/CallElevatorButton';
import { eventBus } from '../../../systems/EventBus';
import { settingsStore } from '../../../systems/SettingsStore';
import { getCoachHint } from './coachHints';
import { preloadQuizFor } from '../../../config/quiz';
import { preloadInfoFor } from '../../../config/info';
import { applyDailyChallengeLayout } from './dailyChallengeLayout';
import { getDailyState } from '../../../systems/DailyChallenge';
import { LevelDecorationsManager } from './LevelDecorationsManager';
import { LevelExitManager } from './LevelExitManager';
import { LevelCheckpointManager } from './LevelCheckpointManager';
import type { LevelConfig } from './LevelConfig';

/** Delay (ms) after floor entry before the first-visit coaching toast appears. */
const COACH_HINT_DELAY_MS = 3_000;
/** How long (ms) the first-visit coaching toast stays visible. */
const COACH_HINT_DURATION_MS = 6_000;

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

// Re-export for back-compat: all callers use `import { LevelConfig } from './LevelScene'`.
export type { LevelConfig, RoomElevator } from './LevelConfig';

/**
 * Composition root for single-screen floor scenes.
 *
 * Concerns are split across focused managers/helpers:
 *   - {@link LevelDecorationsManager} — background, atmospheric FX, helpers.
 *   - {@link LevelExitManager}        — exit door, proximity, transition.
 *   - {@link LevelCheckpointManager}  — hit tracking, respawn, danger state.
 *   - {@link LevelEnemySpawner}       — spawn, physics, stomp/damage.
 *   - {@link LevelTokenManager}       — token group + dropped-AU recovery.
 *   - {@link LevelZoneSetup}          — info-point → proximity zone + icons.
 *   - {@link createLevelDialogs}      — wiring the shared DialogController.
 */
export class LevelScene extends Phaser.Scene {
  protected player!: Player;
  protected hud!: HUD;
  protected gameState!: GameStateManager;
  protected progression!: ProgressionSystem;
  protected platformGroup!: Phaser.Physics.Arcade.StaticGroup;
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

  /** Auto-moving floating platforms (bounce or tween). */
  private movingPlatforms: MovingPlatform[] = [];

  /** In-room elevator manager (shafts, platforms, input, rider-pin). */
  private roomElevators!: LevelRoomElevators;

  /** On-screen "CALL LIFT" button — touch/pointer shortcut for returnToElevator(). */
  private callElevatorButton!: CallElevatorButton;

  /** Info + quiz dialog orchestration. */
  protected dialogs!: DialogController;

  private enemySpawner!: LevelEnemySpawner;
  private tokenMgr!: LevelTokenManager;
  private coffeeMgr!: LevelCoffeeManager;
  private fridgeMgr!: LevelFridgeManager;
  private zones!: LevelZoneSetup;
  private decorationsMgr!: LevelDecorationsManager;
  private exitMgr!: LevelExitManager;
  private checkpointMgr!: LevelCheckpointManager;

  /** Tracks dialog open state across frames so we can pause/resume the playtime tracker. */
  private wasDialogOpen = false;
  /** Immutable per-scene level config (daily overrides resolved once in create()). */
  private resolvedLevelConfig?: LevelConfig;

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

  /**
   * The exit-door image.  Subclass overrides of `checkExitProximity` and
   * `returnToElevator` may read `.x` / `.y` from this getter.
   */
  protected get exitDoor(): Phaser.GameObjects.Image {
    return this.exitMgr.exitDoor;
  }

  init(): void {
    this.gameState = this.registry.get('gameState') as GameStateManager;
    this.progression = this.gameState.progression;
    this.floorData = LEVEL_DATA[this.floorId];
    this.isTransitioning = false;
    this.movingPlatforms = [];
    this.resolvedLevelConfig = undefined;
    // Kick off lazy-load of this floor's quiz and info content so the data is
    // available by the time the player walks to an info icon.  Fire-and-forget:
    // Phaser's create() runs synchronously immediately after init(), but the
    // player still needs several seconds to walk to any interactive element.
    preloadQuizFor(this.floorId).catch(() => { /* non-fatal; player will see no quiz badge */ });
    preloadInfoFor(this.floorId).catch(() => { /* non-fatal; info icon will be absent */ });
    // Analytics: track floor visits (fires on every entry, including revisits).
    eventBus.emit('progression:floor_entered', this.floorId);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.floorData.theme.backgroundColor);
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Decorations manager — owns background, atmospheric FX, decoration helpers.
    this.decorationsMgr = new LevelDecorationsManager({
      scene: this,
      floorId: this.floorId,
      floorData: this.floorData,
    });

    // Exit manager — constructed early (before player) because createExit() places the door.
    // Player/UI refs are accessed lazily via callbacks.
    this.exitMgr = new LevelExitManager({
      scene: this,
      floorId: this.floorId,
      gameState: this.gameState,
      getPlayer: () => this.player,
      getInteractPrompt: () => this.interactPrompt,
      getIsTransitioning: () => this.isTransitioning,
      setIsTransitioning: (v) => { this.isTransitioning = v; },
      getReturnSide: () => this.returnSide,
      getCallElevBtn: () => this.callElevatorButton,
    });

    this.createBackground();
    this.createPlatforms();
    this.createMovingPlatforms();
    this.createDecorations();
    this.createExit();
    this.createPlayer();
    this.createUI();

    // Checkpoint manager — owns hit tracking, checkpoints, respawn, danger state.
    this.checkpointMgr = new LevelCheckpointManager({
      scene: this,
      player: this.player,
      floorId: this.floorId,
      progression: this.progression,
      getIsTransitioning: () => this.isTransitioning,
      getPlayerStart: () => this.getResolvedLevelConfig().playerStart,
    });
    this.checkpointMgr.createDangerVignette();

    // Now that the player exists, instantiate the content managers.
    this.tokenMgr = new LevelTokenManager({
      scene: this,
      floorId: this.floorId,
      floorData: this.floorData,
      progression: this.progression,
      player: this.player,
      platformGroup: this.platformGroup,
      camera: this.cameras.main,
      gameState: this.gameState,
    });
    this.enemySpawner = new LevelEnemySpawner({
      scene: this,
      floorId: this.floorId,
      progression: this.progression,
      player: this.player,
      platformGroup: this.platformGroup,
      droppedAUGroup: this.tokenMgr.droppedAUGroup,
      camera: this.cameras.main,
      onPlayerHit: () => this.checkpointMgr.onPlayerHit(),
    });
    this.coffeeMgr = new LevelCoffeeManager({
      scene: this,
      player: this.player,
    });
    this.fridgeMgr = new LevelFridgeManager({
      scene: this,
      player: this.player,
    });
    this.zones = new LevelZoneSetup({
      scene: this,
      player: this.player,
      dialogs: this.buildDialogs(),
      gameState: this.gameState,
    });

    const cfg = this.getResolvedLevelConfig();
    this.tokenMgr.spawn(cfg);
    this.enemySpawner.spawn(cfg);
    this.coffeeMgr.spawn(cfg);
    this.fridgeMgr.spawn(cfg);
    this.zones.create(cfg);
    this.checkpointMgr.spawn(cfg);

    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.tokenMgr.wireColliders();
    this.enemySpawner.wireColliders();
    this.coffeeMgr.wireColliders();

    const solidEnemies = this.enemySpawner.enemies.filter((e) => e.collidesWithLevel);
    for (const mp of this.movingPlatforms) {
      this.physics.add.collider(this.player.sprite, mp);
      if (solidEnemies.length > 0) this.physics.add.collider(solidEnemies, mp);
      this.physics.add.collider(this.tokenMgr.droppedAUGroup, mp);
    }

    // Room elevators: build shafts + platforms, then wire player colliders.
    // Constructed after zones so this.dialogs is available for the rider-pin.
    this.roomElevators = new LevelRoomElevators({
      scene: this,
      player: this.player,
      dialogs: this.dialogs,
    });
    this.roomElevators.build(cfg);
    this.roomElevators.wireColliders();

    this.cameras.main.setScroll(0, 0);

    // Snapshot first-visit status before marking the floor as visited.
    const firstVisit = this.progression.isFirstVisit(this.floorId);

    // Record the floor visit and check for floor-exploration achievements.
    this.progression.markFloorVisited(this.floorId);
    this.gameState.checkAchievements();

    this.showFloorBanner();
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Show a coaching toast on first visit, after the floor banner fades out.
    const hint = getCoachHint(this.floorId, firstVisit, settingsStore.read().hideTutorials);
    if (hint) {
      this.time.delayedCall(COACH_HINT_DELAY_MS, () => {
        this.hud.showToast(hint, COACH_HINT_DURATION_MS);
      });
    }

    this.decorationsMgr.createAtmosphericFx(this.player, this.enemySpawner.enemies);
    this.decorationsMgr.setupFloorUnlockCelebration(this.player);
    this.setupPause();

    // Start playtime tracking for this floor.
    const tracker = this.gameState.playtime;
    tracker.setFloor(this.floorId);
    tracker.resume();
    // Phaser automatically removes scene-event listeners added via `this.events.on`
    // when the scene shuts down, so PAUSE and RESUME do not need explicit teardown.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => tracker.pause(), this);
    this.events.on(Phaser.Scenes.Events.RESUME, () => tracker.resume(), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      tracker.pause();
      tracker.flush();
    }, this);
  }

  /** Wire Pause action + auto-pause on tab-hide / blur. */
  private setupPause(): void {
    const lc = createSceneLifecycle(this);

    lc.bindInput('Pause', () => {
      if (!this.isTransitioning && !this.dialogs.isOpen) {
        this.scene.launch('PauseScene', { parentKey: this.sys.settings.key });
      }
    });

    const launchPauseIfRunning = (): void => {
      if (!this.isTransitioning && !this.dialogs.isOpen
          && !this.scene.isActive('PauseScene')
          && this.scene.isActive(this.sys.settings.key)) {
        this.scene.launch('PauseScene', { parentKey: this.sys.settings.key });
      }
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') launchPauseIfRunning();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    lc.add(() => document.removeEventListener('visibilitychange', onVisibilityChange));

    window.addEventListener('blur', launchPauseIfRunning);
    lc.add(() => window.removeEventListener('blur', launchPauseIfRunning));
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
    this.decorationsMgr.createBackground(
      this.getBackgroundPattern(),
      (g) => this.drawBackgroundAccents(g),
    );
  }

  /** Per-floor pattern id; subclasses may override. */
  protected getBackgroundPattern(): FloorPatternId {
    return FLOOR_PATTERNS[this.floorId] ?? 'grid';
  }

  /**
   * Per-floor accent painter; delegates to {@link LevelDecorationsManager}.
   * Subclasses may override to suppress or replace the motif.
   */
  protected drawBackgroundAccents(g: Phaser.GameObjects.Graphics): void {
    this.decorationsMgr.drawBackgroundAccents(g);
  }

  /* ---- platforms ---- */
  protected createPlatforms(): void {
    this.platformGroup = this.physics.add.staticGroup();
    const config = this.getResolvedLevelConfig();
    this.buildPlatforms(config);
    this.decorationsMgr.buildCatwalks(config, this.platformGroup);
  }

  protected buildPlatforms(config: LevelConfig): void {
    const tileKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'platform_floor1' : 'platform_floor2';
    for (const plat of config.platforms) {
      for (let i = 0; i < plat.width; i++) {
        const tx = plat.x + i * TILE_SIZE + TILE_SIZE / 2;
        const ty = plat.y + TILE_SIZE / 2; // plat.y = walking surface top
        const t = this.platformGroup.create(tx, ty, tileKey) as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
        // Deterministic ~25% scuff overlay (same tiles across reloads).
        const hash = ((plat.x + i * 7) * 31 + plat.y * 17 + this.floorId * 53) & 0xff;
        if (hash < 64 && this.textures.exists('tile_detail_overlay')) {
          this.add.image(tx, ty, 'tile_detail_overlay').setDepth(2.5);
        }
      }
    }
  }

  /* ---- moving platforms ---- */
  protected createMovingPlatforms(): void {
    const config = this.getResolvedLevelConfig();
    if (!config.movingPlatforms?.length) return;
    for (const cfg of config.movingPlatforms) {
      this.movingPlatforms.push(new MovingPlatform(this, cfg));
    }
  }

  /* ---- decorations ---- */
  protected createDecorations(): void { /* no-op by default */ }

  /** Place ambient plant sprites. Called from subclass `createDecorations`. */
  protected addAmbientPlants(
    plants: Array<{ x: number; kind: 'tall' | 'small'; depth?: number }>,
  ): void {
    this.decorationsMgr.addAmbientPlants(plants);
  }

  /** Place an info-board signpost. Called from subclass `createDecorations`. */
  protected addSignpost(opts: {
    x: number;
    label: string;
    color: string;
    fontSize?: number;
  }): void {
    this.decorationsMgr.addSignpost(opts);
  }

  /* ---- exit ---- */
  protected createExit(): void {
    this.exitMgr.create(this.getResolvedLevelConfig());
  }

  /** Swap exit door texture; delegates to {@link LevelExitManager}. */
  protected setExitDoorOpen(open: boolean): void {
    this.exitMgr.setDoorOpen(open);
  }

  /* ---- player ---- */
  protected createPlayer(): void {
    const c = this.getResolvedLevelConfig();
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
    this.hud = new HUD(this, this.progression, this.gameState.playtime);
    this.callElevatorButton = new CallElevatorButton(this, () => this.returnToElevator());
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

  protected getResolvedLevelConfig(): LevelConfig {
    if (this.resolvedLevelConfig) return this.resolvedLevelConfig;
    const authored = this.getLevelConfig();
    const daily = getDailyState(this.registry);
    if (!daily) {
      this.resolvedLevelConfig = authored;
      return authored;
    }
    // Mix the global day seed with floorId using the 32-bit golden-ratio hash
    // constant so each floor gets a distinct deterministic stream.
    const seed = (daily.seed ^ (this.floorId * 0x9e3779b1)) >>> 0;
    this.resolvedLevelConfig = applyDailyChallengeLayout(authored, seed);
    return this.resolvedLevelConfig;
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    // Fall detection: if physics somehow places the player below the world
    // boundary (e.g. high-velocity physics edge-case), trigger respawn.
    if (this.player.sprite.y > GAME_HEIGHT + 40) {
      this.triggerRespawn();
      return;
    }

    const infoPressed = this.inputs.justPressed('ToggleInfo');

    // Pause/resume playtime tracker when dialogs open or close.
    const dialogNowOpen = this.dialogs.isOpen;
    if (dialogNowOpen !== this.wasDialogOpen) {
      this.wasDialogOpen = dialogNowOpen;
      if (dialogNowOpen) {
        this.gameState.playtime.pause();
      } else {
        this.gameState.playtime.resume();
      }
    }

    // Keep the Player ticking while a dialog is open so it can react to
    // the `modal` input context (zeroing velocity, switching to `idle`).
    // Other gameplay systems (enemies, room-lifts, zones, exit-proximity)
    // intentionally pause — the player is just reading the dialog.
    if (this.dialogs.isOpen) {
      for (const mp of this.movingPlatforms) mp.pause();
      this.player.update(delta);
      this.hud.update();
      this.decorationsMgr.updateAtmosphericFx(this.player, this.enemySpawner.enemies);
      return;
    }
    for (const mp of this.movingPlatforms) mp.resume();

    this.player.update(delta);
    this.hud.update();
    this.roomElevators.update();
    for (const mp of this.movingPlatforms) mp.update();
    this.enemySpawner.update(_time, delta);
    this.decorationsMgr.updateAtmosphericFx(this.player, this.enemySpawner.enemies);
    this.checkpointMgr.updateDangerState(delta);

    // Call playtime tracker update (throttled persist).
    this.gameState.playtime.update();

    // Emit zone:enter / zone:exit events when player crosses zone boundaries.
    this.zones.update();

    // Fridge proximity + interact (runs after zones so Interact isn't
    // double-consumed by an info-dialog open on the same frame).
    this.fridgeMgr.update();

    // I key opens the info dialog for the currently-active content zone.
    // `ArrowUp` is bound to both `MoveUp` and `ToggleInfo`; suppress the
    // info-open path when the player is driving movement this frame so
    // pressing Up to ride a lift never also pops an info card. Enter and
    // I still open dialogs normally.
    const movingThisFrame = this.inputs.justPressed('MoveUp')
      || this.inputs.justPressed('MoveDown');
    const activeZone = this.zones.getActiveZone();
    if (infoPressed && activeZone && !this.dialogs.isOpen && !movingThisFrame) {
      this.dialogs.open(activeZone);
      return;
    }

    this.checkExitProximity();
  }

  /** Debug overlay hook: expose spatial zones for DebugPlugin to render. */
  getDebugZones(): import('./LevelZoneSetup').DebugZone[] {
    return this.zones?.getDebugZones() ?? [];
  }

  /* ---- exit check ---- */
  protected checkExitProximity(): void {
    this.exitMgr.checkExitProximity();
  }

  protected returnToElevator(): void {
    this.exitMgr.returnToElevator();
  }

  /**
   * Teleport the player to the most recent checkpoint (or `playerStart` if
   * none has been activated) with a brief camera flash.
   * Delegates to {@link LevelCheckpointManager.triggerRespawn}.
   */
  protected triggerRespawn(): void {
    this.checkpointMgr.triggerRespawn();
  }
}
