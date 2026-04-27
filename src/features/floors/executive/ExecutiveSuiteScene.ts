import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { allKeyLabels } from '../../../input';
import { theme } from '../../../style/theme';
import { FinanceTeamScene } from '../finance/FinanceTeamScene';
import { InteractiveDoor } from '../../../ui/InteractiveDoor';
import { loadDeferredMusic } from '../../../config/audioConfig';
import { MissionItem, MissionItemId } from '../../../entities/MissionItem';
import { TerroristCommander } from '../../../entities/enemies/TerroristCommander';
import { eventBus } from '../../../systems/EventBus';

/** Scene-local state for the hostage rescue scenario. Reset on every create(). */
interface RescueState {
  collected: Set<MissionItemId>;
  bombDisarmed: boolean;
  bossDefeated: boolean;
  leadershipFreed: boolean;
}

/**
 * Floor 4 — Executive Suite (penthouse).
 *
 * The top of the elevator shaft in Hohpe's metaphor: strategy, vision,
 * and organizational direction.
 *
 * **Die Hard mode:** An external threat has taken the C-suite leadership
 * hostage. The player must collect 3 mission items (Pistol, Security Key
 * Card, Bomb Deactivation Code), disarm a bomb, defeat the Terrorist
 * Commander, and unlock the inner sanctum to free the leadership.
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

  // ---- Die Hard hostage rescue state ----
  private rescue!: RescueState;
  private missionItems: MissionItem[] = [];
  private bombSprite?: Phaser.GameObjects.Image;
  private bombLight?: Phaser.GameObjects.Image;
  private sanctumDoor?: InteractiveDoor;
  private sanctumPrompt?: Phaser.GameObjects.Text;
  private bombPrompt?: Phaser.GameObjects.Text;
  private commanderRef?: TerroristCommander;
  private hudIcons: Phaser.GameObjects.Image[] = [];
  private bombStatusIcon?: Phaser.GameObjects.Image;

  /** Position of the inner sanctum door (far right). */
  private static readonly SANCTUM_X = 1200;
  /** Position of the bomb device. */
  private static readonly BOMB_X = 1000;
  /** Position of the terrorist commander's patrol center. */
  private static readonly COMMANDER_X = 900;
  /**
   * Delay before the debrief info dialog appears after the celebration banner.
   * Must exceed banner fade: 3000 ms delay + 500 ms fade = 3500 ms total.
   */
  private static readonly DEBRIEF_DIALOG_DELAY_MS = 3600;

  constructor() {
    super('ExecutiveSuiteScene', FLOORS.EXECUTIVE);
  }

  preload(): void {
    loadDeferredMusic(this, 'music_executive');
  }

  override init(data?: { fromDoor?: string }): void {
    super.init();
    this.spawnNearDoor = data?.fromDoor;
    this.rescue = {
      collected: new Set(),
      bombDisarmed: false,
      bossDefeated: false,
      leadershipFreed: false,
    };
    this.missionItems = [];
    this.hudIcons = [];
  }

  override create(): void {
    super.create();

    // Stagger-desync alpha pulse on tokens.
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

    this.createMissionItems();
    this.createBombDevice();
    this.createSanctumDoor();
    this.createMissionHUD();
    this.findCommanderRef();
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

    let spawnX = 100;
    if (this.spawnNearDoor) {
      const door = ExecutiveSuiteScene.DOORS.find((d) => d.doorId === this.spawnNearDoor);
      if (door) spawnX = door.x - 70;
    }

    return {
      floorId: FLOORS.EXECUTIVE,
      playerStart: { x: spawnX, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
        { x: 384, y: T1, width: 4 },
      ],

      catwalks: [
        // High catwalk for the pistol pickup — forces a jump challenge.
        { x: 500, y: T1 - 140, width: 180 },
      ],

      roomElevators: [
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

      enemies: [
        {
          type: 'terrorist' as const,
          x: ExecutiveSuiteScene.COMMANDER_X,
          y: G - 60,
          minX: 800,
          maxX: 1100,
          speed: 100,
        },
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

  // ---- Mission items ----

  private createMissionItems(): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 240;

    const items: Array<{ x: number; y: number; texture: string; id: MissionItemId }> = [
      // Pistol on the high catwalk (hard to reach).
      { x: 580, y: T1 - 180, texture: 'item_pistol', id: 'pistol' },
      // Key Card near the commander's patrol zone (risky).
      { x: 850, y: G - 40, texture: 'item_keycard', id: 'keycard' },
      // Bomb Code on the mezzanine.
      { x: 500, y: T1 - 40, texture: 'item_bomb_code', id: 'bomb_code' },
    ];

    for (const item of items) {
      const mi = new MissionItem(this, item.x, item.y, item.texture, item.id);
      this.missionItems.push(mi);
      this.physics.add.overlap(
        this.player.sprite,
        mi,
        () => this.collectMissionItem(mi),
        undefined,
        this,
      );
    }
  }

  private collectMissionItem(item: MissionItem): void {
    if (!item.collect()) return;
    this.rescue.collected.add(item.itemId);
    eventBus.emit('sfx:item_pickup');
    this.updateMissionHUD();

    // Collecting the pistol enables stomping the commander.
    if (item.itemId === 'pistol' && this.commanderRef && !this.commanderRef.defeated) {
      this.commanderRef.canBeStomped = true;
    }
  }

  // ---- Bomb Device ----

  private createBombDevice(): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const bx = ExecutiveSuiteScene.BOMB_X;

    this.bombSprite = this.add.image(bx, G - 20, 'bomb_device').setDepth(5);

    // Pulsing red warning light.
    this.bombLight = this.add.image(bx + 12, G - 36, 'bomb_device').setDepth(5)
      .setAlpha(0).setScale(0.3).setTint(0xff0000);
    this.tweens.add({
      targets: this.bombLight,
      alpha: { from: 0.3, to: 0.8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.add.text(bx, G - 60, '\u26A0 BOMB', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff3333',
      fontStyle: 'bold', backgroundColor: '#1a0000',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);

    this.bombPrompt = this.add.text(bx, G - 80, '', {
      fontFamily: 'monospace', fontSize: '14px',
      color: theme.color.css.textWarn, backgroundColor: theme.color.css.bgDialog,
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  // ---- Sanctum Door ----

  private createSanctumDoor(): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const sx = ExecutiveSuiteScene.SANCTUM_X;

    this.sanctumDoor = new InteractiveDoor(this, sx, G - 56, 'door_locked', 'door_open');

    this.add.text(sx, G - 110, '\uD83D\uDD12 SANCTUM', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ff6666',
      fontStyle: 'bold', backgroundColor: '#1a0808',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);

    this.sanctumPrompt = this.add.text(sx, G - 140, '', {
      fontFamily: 'monospace', fontSize: '14px',
      color: theme.color.css.textWarn, backgroundColor: theme.color.css.bgDialog,
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  // ---- Mission HUD ----

  private createMissionHUD(): void {
    const startX = GAME_WIDTH - 120;
    const y = 30;
    const iconKeys: Array<{ id: MissionItemId; texture: string }> = [
      { id: 'pistol', texture: 'item_pistol' },
      { id: 'keycard', texture: 'item_keycard' },
      { id: 'bomb_code', texture: 'item_bomb_code' },
    ];

    this.add.text(startX + 30, y - 16, 'MISSION', {
      fontFamily: 'monospace', fontSize: '10px', color: theme.color.css.textPale,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    for (let i = 0; i < iconKeys.length; i++) {
      const entry = iconKeys[i]!;
      const icon = this.add.image(startX + i * 28, y + 8, entry.texture)
        .setDepth(50).setScrollFactor(0).setScale(1.2).setAlpha(0.3).setTint(0x555555);
      this.hudIcons.push(icon);
    }

    this.bombStatusIcon = this.add.image(startX + 3 * 28, y + 8, 'bomb_device')
      .setDepth(50).setScrollFactor(0).setScale(0.8).setAlpha(0.3).setTint(0xff3333);
  }

  private updateMissionHUD(): void {
    const ids: MissionItemId[] = ['pistol', 'keycard', 'bomb_code'];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      if (this.rescue.collected.has(id)) {
        this.hudIcons[i]?.setAlpha(1).clearTint();
      }
    }
    if (this.rescue.bombDisarmed) {
      this.bombStatusIcon?.setAlpha(1).setTint(0x33ff33);
    }
  }

  // ---- Commander reference ----

  private findCommanderRef(): void {
    for (const enemy of this.enemies) {
      if (enemy instanceof TerroristCommander) {
        this.commanderRef = enemy;
        break;
      }
    }
  }

  // ---- Update: bomb/sanctum/boss proximity ----

  override update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.isTransitioning) return;

    // Detect boss defeat (player stomped while armed with pistol).
    if (this.commanderRef?.defeated && !this.rescue.bossDefeated) {
      this.rescue.bossDefeated = true;
      eventBus.emit('sfx:boss_defeated');
    }

    this.checkBombProximity();
    this.checkSanctumProximity();
  }

  private checkBombProximity(): void {
    if (this.rescue.bombDisarmed || !this.bombSprite) return;

    const near = Math.abs(this.player.sprite.x - ExecutiveSuiteScene.BOMB_X) < 60;

    if (near && this.rescue.collected.has('bomb_code')) {
      this.bombPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 Disarm Bomb`).setVisible(true);
      if (this.inputs.justPressed('Interact')) this.disarmBomb();
    } else if (near) {
      this.bombPrompt?.setText('Need Deactivation Code').setVisible(true);
    } else {
      this.bombPrompt?.setVisible(false);
    }
  }

  private disarmBomb(): void {
    this.rescue.bombDisarmed = true;
    eventBus.emit('sfx:bomb_disarm');
    this.bombPrompt?.setVisible(false);

    if (this.bombLight) {
      this.tweens.killTweensOf(this.bombLight);
      this.bombLight.setAlpha(0);
    }
    this.bombSprite?.setTint(0x333333);

    const confirm = this.add.text(ExecutiveSuiteScene.BOMB_X, GAME_HEIGHT - TILE_SIZE - 80,
      '\u2713 DISARMED', {
        fontFamily: 'monospace', fontSize: '16px', color: '#33ff33',
        fontStyle: 'bold', backgroundColor: '#0a1a0a',
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: confirm, alpha: 0, y: confirm.y - 30,
      duration: 2000, delay: 1000,
      onComplete: () => confirm.destroy(),
    });

    this.updateMissionHUD();
  }

  private checkSanctumProximity(): void {
    if (this.rescue.leadershipFreed || !this.sanctumDoor) return;

    const near = Math.abs(this.player.sprite.x - ExecutiveSuiteScene.SANCTUM_X) < 60;
    const ready = this.isRescueReady();

    this.sanctumDoor.setOpen(near && ready);

    if (near && ready) {
      this.sanctumPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 Free Leadership`).setVisible(true);
      if (this.inputs.justPressed('Interact')) this.freeLeadership();
    } else if (near) {
      const missing: string[] = [];
      if (!this.rescue.collected.has('pistol')) missing.push('Pistol');
      if (!this.rescue.collected.has('keycard')) missing.push('Key Card');
      if (!this.rescue.collected.has('bomb_code')) missing.push('Bomb Code');
      if (!this.rescue.bombDisarmed) missing.push('Disarm Bomb');
      if (!this.rescue.bossDefeated) missing.push('Defeat Threat');
      this.sanctumPrompt?.setText(`Need: ${missing.join(', ')}`).setVisible(true);
    } else {
      this.sanctumPrompt?.setVisible(false);
    }
  }

  private isRescueReady(): boolean {
    return this.rescue.collected.size === 3
      && this.rescue.bombDisarmed
      && this.rescue.bossDefeated;
  }

  private freeLeadership(): void {
    if (this.rescue.leadershipFreed) return;
    this.rescue.leadershipFreed = true;
    eventBus.emit('sfx:hostage_freed');
    this.sanctumPrompt?.setVisible(false);

    this.progression.addAU(this.floorId, 5);
    this.gameState.checkAchievements();

    // Unlock the secret Die Hard achievement.
    this.gameState.unlockAchievement('hostage-rescue');

    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100,
      '\uD83C\uDFC6 LEADERSHIP FREED!', {
        fontFamily: 'monospace', fontSize: '32px', color: '#ffd700', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(100);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50,
      '+5 AU  \u2022  The C-suite is safe.', {
        fontFamily: 'monospace', fontSize: '18px', color: theme.color.css.textSecondary,
      }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: [banner, sub], alpha: 0, duration: 500, delay: 3000,
      onComplete: () => { banner.destroy(); sub.destroy(); },
    });

    // Open the mission-debrief info card after the celebration banner fades.
    this.time.delayedCall(ExecutiveSuiteScene.DEBRIEF_DIALOG_DELAY_MS, () => {
      this.dialogs.open('executive-hostage-rescued');
    });
  }

  // ---- Existing door/exit logic ----

  /**
   * Layer door-entry detection on top of the base elevator-exit check.
   * The Finance door sits far to the right of the elevator exit door, so
   * the two prompts never collide.
   */
  protected override checkExitProximity(): void {
    super.checkExitProximity();

    if (this.isTransitioning) return;

    const px = this.player.sprite.x;
    const G = GAME_HEIGHT - TILE_SIZE;
    const playerOnGround = this.player.sprite.y > G - 200;

    // Find the door the player is currently close to (if any) so we can
    // swap its sprite to the open texture and show the prompt.
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

  private enterSuiteRoom(door: { sceneKey: string }): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(door.sceneKey));
  }
}
