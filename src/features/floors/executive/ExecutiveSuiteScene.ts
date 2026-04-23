import * as Phaser from 'phaser';
import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { allKeyLabels } from '../../../input';
import { theme } from '../../../style/theme';
import { FinanceTeamScene } from '../finance/FinanceTeamScene';
import { InteractiveDoor } from '../../../ui/InteractiveDoor';
import { loadDeferredMusic } from '../../../config/audioConfig';

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

  constructor() {
    super('ExecutiveSuiteScene', FLOORS.EXECUTIVE);
  }

  preload(): void {
    // Spy-theme MP3 is large (~6MB) — load on first suite entry instead
    // of during BootScene to keep initial startup lean. Phaser caches
    // by key, so subsequent visits skip the network round-trip.
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

      // An executive espresso on the strategy-lounge mezzanine — rewards
      // the detour up the in-room lift before strolling toward the doors.
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
