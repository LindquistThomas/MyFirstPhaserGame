import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { allKeyLabels } from '../../../input';
import { theme } from '../../../style/theme';
import { FinanceTeamScene } from '../finance/FinanceTeamScene';
import { InteractiveDoor } from '../../../ui/InteractiveDoor';
import { loadDeferredMusic } from '../../../config/audioConfig';
import { MissionItem, MissionItemId } from '../../../entities/MissionItem';
import { TerroristCommander } from '../../../entities/enemies/TerroristCommander';
import { PistolProjectile } from '../../../entities/PistolProjectile';
import { eventBus } from '../../../systems/EventBus';

/**
 * Floor 4 — Executive Suite (penthouse).
 *
 * The top of the elevator shaft in Hohpe's metaphor: strategy, vision,
 * and organizational direction. Lighter on platforms than the engine-room
 * floors below, with a single info point exploring the penthouse role.
 *
 * Visuals: uses the shared `sceneBackdrop` pipeline for parity with other
 * floors — terrazzo pattern + arched-window silhouette with moon halo
 * (see `floorPatterns.ts` / `floorAccents.ts`). Rim-lit platform tiles
 * and a staggered alpha-pulse on tokens keep the penthouse feel.
 */
export class ExecutiveSuiteScene extends LevelScene {
  /** Doors inside the Executive Suite that open into content-only rooms. */
  private static readonly DOORS: Array<{ x: number; label: string; doorId: string; sceneKey: string }> = [
    { x: 1080, label: 'Finance', doorId: FinanceTeamScene.DOOR_ID, sceneKey: 'FinanceTeamScene' },
  ];

  /** Track each door's sprite so we can swap it to the open texture on approach. */
  private doorSprites: Array<{ cfg: (typeof ExecutiveSuiteScene.DOORS)[number]; sprite: InteractiveDoor }> = [];

  /** Position of Geir Harald on the ground — left side of the suite. */
  private static readonly GEIR_X = 200;

  /** Set when arriving from a suite room — used to spawn next to that door. */
  private spawnNearDoor?: string;

  // ---- Hostage rescue state (scene-local, resets on re-entry) ----
  private rescueState = {
    collected: new Set<MissionItemId>(),
    bombDisarmed: false,
    commanderDefeated: false,
    leadershipFreed: false,
  };
  private missionItems: MissionItem[] = [];
  private commander?: TerroristCommander;
  private sanctumDoor?: Phaser.GameObjects.Image;
  private bombSprite?: Phaser.GameObjects.Image;
  private missionHUD?: Phaser.GameObjects.Container;
  private missionIconSlots: Phaser.GameObjects.Text[] = [];
  private bombIndicator?: Phaser.GameObjects.Text;

  // ---- Pistol projectile group ----
  private pistolGroup?: Phaser.Physics.Arcade.Group;

  // ---- Bomb mini-game state ----
  private bombMinigameActive = false;
  private bombCursorX = 0;
  private bombCursorSpeed = 0.4;
  private bombSuccessAccum = 0;
  private bombBar?: Phaser.GameObjects.Container;
  private bombPromptText?: Phaser.GameObjects.Text;

  constructor() {
    super('ExecutiveSuiteScene', FLOORS.EXECUTIVE);
  }

  preload(): void {
    // Pre-load the boss track during this scene's preload phase so it is
    // ready by the time create() runs (avoids a brief silence on first
    // entry). MusicPlugin's lazy-loading is the fallback for scenes without
    // an explicit preload step.
    loadDeferredMusic(this, 'music_executive');
  }

  override init(data?: { fromDoor?: string }): void {
    super.init();
    this.spawnNearDoor = data?.fromDoor;
  }

  override create(): void {
    super.create();

    // Stagger-desync alpha pulse on tokens so they don't all breathe in
    // lockstep. Token already owns a y-bob + scale pulse; this is a
    // scene-local additional cadence so Token.ts stays untouched.
    const tokens = this.tokenGroup.getChildren();
    tokens.forEach((t, i) => {
      this.tweens.add({
        targets: t,
        alpha: 0.85,
        duration: 2000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: i * 150,
      });
    });

    this.setupRescue();
    this.showMissionBrief();
  }

  private showMissionBrief(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const W = 620;
    const H = 130;

    const bg = this.add.graphics()
      .fillStyle(0x0a0a1a, 0.92)
      .fillRect(-W / 2, -H / 2, W, H)
      .lineStyle(2, 0xffd700, 1)
      .strokeRect(-W / 2, -H / 2, W, H);

    const title = this.add.text(0, -H / 2 + 14, '⚠ MISSION BRIEF', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const body = this.add.text(0, -H / 2 + 36, [
      'ALERT: C-suite leadership has been taken hostage!',
      'Locate the pistol, keycard, and bomb code.',
      'Defeat the TerroristCommander and disarm the bomb.',
    ].join('\n'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#ccddff',
      wordWrap: { width: W - 40 }, align: 'center',
    }).setOrigin(0.5, 0);

    const hint = this.add.text(0, H / 2 - 18, 'Press Enter to continue', {
      fontFamily: 'monospace', fontSize: '11px', color: '#666677',
    }).setOrigin(0.5, 1);

    const container = this.add.container(cx, cy, [bg, title, body, hint])
      .setDepth(90)
      .setScrollFactor(0);

    const onEnter = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        window.removeEventListener('keydown', onEnter);
        container.destroy();
      }
    };
    window.addEventListener('keydown', onEnter);

    // Also clean up listener on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onEnter);
    });
  }

  private setupRescue(): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 240;

    // ---- Mission items ----
    const spawnItem = (x: number, y: number, id: MissionItemId): void => {
      const item = new MissionItem(this, x, y, id, (collected) => this.onItemCollected(collected));
      this.missionItems.push(item);
      this.physics.add.overlap(this.player.sprite, item, () => item.collect());
    };
    spawnItem(620, T1 - 30, 'pistol');        // on mezzanine
    spawnItem(940, G - 30, 'keycard');        // near patrol zone (risky)
    spawnItem(160, G - 30, 'bomb_code');      // behind exit side

    // ---- Terrorist Commander patrol ----
    this.commander = new TerroristCommander(this, 750, G - 56, {
      minX: 600, maxX: 1100, speed: 90,
    });
    this.physics.add.collider(this.commander, this.platformGroup);
    // Override stomp: use pistol defeat instead
    this.physics.add.overlap(
      this.player.sprite,
      this.commander,
      () => this.onCommanderOverlap(),
    );

    // Pistol projectile group
    this.pistolGroup = this.physics.add.group();

    // ---- Bomb device (right side, gated by bomb_code) ----
    this.bombSprite = this.add.image(1100, G - 40, 'bomb_device').setDepth(4);
    this.tweens.add({
      targets: this.bombSprite,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // ---- Sanctum door (blocks far-right area) ----
    this.sanctumDoor = this.add.image(1200, G - 48, 'door_sanctum_locked')
      .setDepth(4)
      .setVisible(true);

    // ---- Mission HUD overlay (top-right) ----
    this.buildMissionHUD();

    // ---- Shutdown cleanup ----
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // rescueState resets on next create() — nothing to persist
    });
  }

  private buildMissionHUD(): void {
    const icons: Phaser.GameObjects.Text[] = [];
    const labels = ['🔫', '🪪', '💣'];
    for (let i = 0; i < 3; i++) {
      const icon = this.add.text(GAME_WIDTH - 110 + i * 36, 16, labels[i]!, {
        fontFamily: 'monospace', fontSize: '20px', color: '#333344',
      }).setScrollFactor(0).setDepth(60);
      icons.push(icon);
    }
    this.missionIconSlots = icons;
    this.bombIndicator = this.add.text(GAME_WIDTH - 110, 42, '💥 ARMED', {
      fontFamily: 'monospace', fontSize: '11px', color: '#cc2222',
    }).setScrollFactor(0).setDepth(60);
  }

  private onItemCollected(id: MissionItemId): void {
    this.rescueState.collected.add(id);
    const idx = ['pistol', 'keycard', 'bomb_code'].indexOf(id);
    if (idx >= 0 && this.missionIconSlots[idx]) {
      this.missionIconSlots[idx]!.setColor('#ffd700');
    }
  }

  private onCommanderOverlap(): void {
    if (!this.commander || this.commander.defeated) return;
    if (!this.rescueState.collected.has('pistol')) {
      // No pistol — take damage normally (handled by LevelEnemySpawner for listed enemies,
      // but this commander is spawned outside the spawner config, so handle here)
      if (!this.player.isInvulnerable()) {
        this.player.takeHit(this.commander.knockbackX, this.commander.knockbackY);
        eventBus.emit('sfx:hit');
      }
      return;
    }
    // Pistol in hand — defeat the commander
    this.commander.defeat();
    this.rescueState.commanderDefeated = true;
    this.checkSanctumUnlock();
  }

  private checkBombDisarm(delta: number): void {
    if (this.rescueState.bombDisarmed) return;
    if (!this.rescueState.collected.has('bomb_code')) return;

    const px = this.player.sprite.x;
    const G = GAME_HEIGHT - TILE_SIZE;
    const nearBomb = Math.abs(px - 1100) < 80 && this.player.sprite.y > G - 200;

    if (!nearBomb) {
      // Player left zone — hide UI and reset
      if (this.bombMinigameActive || this.bombPromptText?.visible) {
        this.bombMinigameActive = false;
        this.bombCursorX = 0;
        this.bombSuccessAccum = 0;
        this.bombBar?.destroy();
        this.bombBar = undefined;
        this.bombPromptText?.setVisible(false);
      }
      return;
    }

    // Near bomb — show prompt if not active
    if (!this.bombPromptText) {
      this.bombPromptText = this.add.text(
        GAME_WIDTH / 2, GAME_HEIGHT - 148,
        'Hold [Interact] to disarm',
        { fontFamily: 'monospace', fontSize: '12px', color: '#ffd700' },
      ).setOrigin(0.5).setScrollFactor(0).setDepth(65).setVisible(false);
    }

    const holding = this.inputs.isDown('Interact');

    if (!holding) {
      // Not holding — show prompt, hide/reset bar
      this.bombPromptText.setVisible(true);
      if (this.bombMinigameActive) {
        this.bombMinigameActive = false;
        // Only penalize if player released well outside the green zone and
        // hadn't made significant progress (< 0.3s accumulated in zone).
        const outsideZone = this.bombCursorX < 0.35 || this.bombCursorX > 0.65;
        if (outsideZone && this.bombSuccessAccum < 0.3) {
          this.player.takeHit(40, -100);
        }
        this.bombSuccessAccum = 0;
        this.bombBar?.destroy();
        this.bombBar = undefined;
        this.bombCursorX = 0;
      }
      return;
    }

    // Holding Interact — run mini-game
    this.bombPromptText.setVisible(false);
    if (!this.bombMinigameActive) {
      this.bombMinigameActive = true;
      this.bombCursorX = 0;
      this.bombSuccessAccum = 0;
    }

    const dt = delta / 1000;
    this.bombCursorX = (this.bombCursorX + this.bombCursorSpeed * dt) % 1;
    const inGreen = this.bombCursorX >= 0.35 && this.bombCursorX <= 0.65;
    if (inGreen) {
      this.bombSuccessAccum += dt;
    } else {
      this.bombSuccessAccum = Math.max(0, this.bombSuccessAccum - dt * 0.5);
    }

    // Build/update bar UI
    if (!this.bombBar) {
      this.bombBar = this.buildBombBar();
    }
    this.updateBombBar(this.bombCursorX);

    if (this.bombSuccessAccum >= 0.8) {
      // Success!
      this.bombMinigameActive = false;
      this.rescueState.bombDisarmed = true;
      this.bombBar.destroy();
      this.bombBar = undefined;
      this.bombPromptText?.destroy();
      this.bombPromptText = undefined;
      this.bombSprite?.destroy();
      eventBus.emit('sfx:bomb_disarm');
      if (this.bombIndicator) {
        this.bombIndicator.setText('✓ DEFUSED').setColor('#44ff88');
      }
      this.checkSanctumUnlock();
    }
  }

  private buildBombBar(): Phaser.GameObjects.Container {
    const BAR_W = 300;
    const BAR_H = 18;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT - 120;

    const bg = this.add.graphics()
      .fillStyle(0x333333, 1)
      .fillRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H)
      .lineStyle(1, 0xffd700, 1)
      .strokeRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H);

    const greenZone = this.add.graphics()
      .fillStyle(0x00aa44, 0.6)
      .fillRect(-BAR_W / 2 + BAR_W * 0.35, -BAR_H / 2, BAR_W * 0.3, BAR_H);

    const cursor = this.add.graphics()
      .fillStyle(0xffffff, 1)
      .fillRect(-2, -BAR_H / 2, 4, BAR_H);
    cursor.setName('cursor');

    const container = this.add.container(cx, cy, [bg, greenZone, cursor])
      .setDepth(65).setScrollFactor(0);
    return container;
  }

  private updateBombBar(cursorX: number): void {
    if (!this.bombBar) return;
    const BAR_W = 300;
    const BAR_H = 18;
    const cursor = this.bombBar.getByName('cursor') as Phaser.GameObjects.Graphics;
    if (!cursor) return;
    cursor.clear();
    cursor.fillStyle(0xffffff, 1);
    const cx = -BAR_W / 2 + BAR_W * cursorX;
    cursor.fillRect(cx - 2, -BAR_H / 2, 4, BAR_H);
  }

  private checkSanctumUnlock(): void {
    if (this.rescueState.leadershipFreed) return;
    const { collected, bombDisarmed, commanderDefeated } = this.rescueState;
    if (
      collected.has('pistol') &&
      collected.has('keycard') &&
      collected.has('bomb_code') &&
      bombDisarmed &&
      commanderDefeated
    ) {
      this.openSanctum();
    }
  }

  private openSanctum(): void {
    this.rescueState.leadershipFreed = true;
    this.sanctumDoor?.setTexture('door_sanctum_open');
    eventBus.emit('sfx:hostage_freed');
    this.cameras.main.shake(150, 0.006);

    // Grant bonus AU
    this.progression.addAU(FLOORS.EXECUTIVE, 5);
    this.gameState.unlockHostageRescue();
    this.gameState.checkAchievements();

    // Open the rescue info dialog
    this.time.delayedCall(600, () => {
      if (this.dialogs) this.dialogs.open('executive-hostage-rescued');
    });
  }

  protected override buildPlatforms(config: LevelConfig): void {
    for (const plat of config.platforms) {
      for (let i = 0; i < plat.width; i++) {
        const t = this.platformGroup.create(
          plat.x + i * TILE_SIZE + TILE_SIZE / 2,
          plat.y + TILE_SIZE / 2,
          'platform_floor4_lit',
        ) as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }
    }
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    this.addAmbientPlants([
      { x: 110, kind: 'tall' },
      { x: 320, kind: 'small' },
      { x: 1180, kind: 'tall' },
    ]);

    this.addSignpost({ x: 420, label: 'EXECUTIVE\n   SUITE', color: '#ffd700' });

    // Strategy desk in the centre.
    this.add.image(720, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(880, G - 22, 'monitor_dash').setDepth(3);

    // Geir Harald — pacing the ground near the left signpost. Sprite origin
    // is bottom-center so his feet sit on the floor.
    const geir = this.add.sprite(ExecutiveSuiteScene.GEIR_X, G, 'npc_geir', 0)
      .setOrigin(0.5, 1)
      .setDepth(4);
    geir.play('geir_walk');
    // He paces a short range centred on GEIR_X so he stays inside the info
    // zone (width=120, so ±60 around GEIR_X is the widest he can roam).
    this.tweens.add({
      targets: geir,
      x: { from: ExecutiveSuiteScene.GEIR_X - 50, to: ExecutiveSuiteScene.GEIR_X + 50 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      onYoyo: () => geir.setFlipX(true),
      onRepeat: () => geir.setFlipX(false),
    });

    // Floating name label with a gentle yoyo bob; follows Geir horizontally.
    const labelY = G - 148;
    const nameLabel = this.add.text(ExecutiveSuiteScene.GEIR_X, labelY, 'Geir Harald', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: theme.color.css.textPale,
      fontStyle: 'bold',
      align: 'center',
      backgroundColor: theme.color.css.bgPanel,
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: nameLabel,
      y: labelY - 6,
      duration: 1600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      nameLabel.x = geir.x;
    });

    // Doors leading into content-only suite rooms (Finance, …).
    this.doorSprites = [];
    for (const door of ExecutiveSuiteScene.DOORS) {
      const sprite = new InteractiveDoor(this, door.x, G - 56, 'door_unlocked', 'door_open')
        .onPointerDown(() => this.enterSuiteRoom(door));
      this.add.text(door.x, G - 130, door.label, {
        fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textPale,
        fontStyle: 'bold', align: 'center',
        backgroundColor: theme.color.css.bgPanel, padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(4);
      this.doorSprites.push({ cfg: door, sprite });
    }
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 240;

    // Spawn next to the door the player just came back through, if any.
    // Default spawn is nudged left of Geir's info zone so the player
    // doesn't materialise inside it on scene entry.
    let spawnX = 100;
    if (this.spawnNearDoor) {
      const door = ExecutiveSuiteScene.DOORS.find((d) => d.doorId === this.spawnNearDoor);
      if (door) spawnX = door.x - 70; // step out to the left of the door
    }

    return {
      floorId: FLOORS.EXECUTIVE,
      playerStart: { x: spawnX, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        // Ground spans the whole room.
        { x: 0, y: G, width: 10 },
        // A single mezzanine for the strategy lounge.
        { x: 384, y: T1, width: 4 },
      ],

      roomElevators: [
        // One in-room lift up to the mezzanine.
        { x: 280, minY: T1 + 6, maxY: G + 6, startY: G + 6 },
      ],

      tokens: [
        { x: 500,  y: G - 40 },
        { x: 720,  y: G - 40 },
        { x: 920,  y: G - 40 },
        { x: 460,  y: T1 - 40 },
        { x: 600,  y: T1 - 40 },
        { x: 740,  y: T1 - 40 },
      ],

      coffees: [
        { x: 680, y: T1 - 40 },
      ],

      infoPoints: [
        {
          x: 380, y: G, contentId: 'executive-suite',
          zone: { shape: 'rect', width: 160, height: 220 },
        },
        {
          x: ExecutiveSuiteScene.GEIR_X, y: G, contentId: 'exec-geir-harald',
          zone: { shape: 'rect', width: 120, height: 220 },
        },
      ],
    };
  }

  /**
   * Layer door-entry detection on top of the base elevator-exit check.
   * The Finance door sits far to the right of the elevator exit door, so
   * the two prompts never collide.
   */
  protected override checkExitProximity(): void {
    // Handled by update() override via checkExitProximityWithDelta().
    // Intentionally empty — super call moved there to get delta.
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    this.checkExitProximityWithDelta(delta);
  }

  private checkExitProximityWithDelta(delta: number): void {
    // Base class elevator-exit check
    super.checkExitProximity();

    // Fire pistol with Attack action if pistol collected
    if (this.rescueState.collected.has('pistol') && this.inputs.justPressed('Attack')) {
      this.firePistol();
    }

    // Check bomb disarm each frame (proximity-gated, needs delta)
    this.checkBombDisarm(delta);

    // Commander update (not in LevelEnemySpawner — managed directly here)
    if (this.commander && !this.commander.defeated) {
      this.commander.update();
    }

    if (this.isTransitioning) return;

    const px = this.player.sprite.x;
    const G = GAME_HEIGHT - TILE_SIZE;
    const playerOnGround = this.player.sprite.y > G - 200;

    const near = playerOnGround
      ? ExecutiveSuiteScene.DOORS.find((d) => Math.abs(px - d.x) < 60)
      : undefined;

    for (const d of this.doorSprites) d.sprite.setOpen(d.cfg === near);

    if (!near) return;

    this.interactPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 ${near.label}`).setPosition(
      near.x - 100, G - 180,
    ).setVisible(true);
    if (this.inputs.justPressed('Interact')) {
      this.enterSuiteRoom(near);
    }
  }

  private firePistol(): void {
    if (!this.pistolGroup) return;
    const toRight = !this.player.sprite.flipX;
    const bullet = new PistolProjectile(
      this,
      this.player.sprite.x + (toRight ? 20 : -20),
      this.player.sprite.y - 10,
      toRight,
    );
    this.pistolGroup.add(bullet);
    eventBus.emit('sfx:pistol_shot');
    if (this.commander && !this.commander.defeated) {
      this.physics.add.overlap(bullet, this.commander, () => {
        if (!this.commander || this.commander.defeated) return;
        this.commander.defeat();
        this.rescueState.commanderDefeated = true;
        bullet.destroySelf();
        this.checkSanctumUnlock();
      });
    }
  }

  private enterSuiteRoom(door: { sceneKey: string }): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(door.sceneKey));
  }
}
