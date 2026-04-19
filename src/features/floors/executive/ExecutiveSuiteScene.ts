import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { createSceneLifecycle } from '../../../systems/sceneLifecycle';

/**
 * Floor 4 — Executive Suite (penthouse).
 *
 * The top of the elevator shaft in Hohpe's metaphor: strategy, vision,
 * and organizational direction. Lighter on platforms than the engine-room
 * floors below, with a single info point exploring the penthouse role.
 *
 * Visuals (Pass 3): full-scene vertical gradient sky behind everything,
 * three parallax cloud layers for atmospheric depth, rim-lit platform
 * tiles, and staggered alpha-pulse tokens.
 */
export class ExecutiveSuiteScene extends LevelScene {
  constructor() {
    super('ExecutiveSuiteScene', FLOORS.EXECUTIVE);
  }

  override create(): void {
    createSceneLifecycle(this);
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

  protected override createBackground(): void {
    this.buildGradientSky();
    this.buildParallaxClouds();
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

    // Penthouse plants flanking the executive lounge.
    this.add.image(110, G - 40, 'plant_tall').setDepth(3);
    this.add.image(220, G - 32, 'plant_small').setDepth(11);
    this.add.image(1180, G - 40, 'plant_tall').setDepth(3);
    this.add.image(1060, G - 32, 'plant_small').setDepth(11);

    // Executive signpost — greets the player on entry.
    this.add.image(380, G - 60, 'info_board').setDepth(3);
    this.add.text(380, G - 130, 'EXECUTIVE\n   SUITE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffd700',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // Strategy desk in the centre.
    this.add.image(720, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(880, G - 22, 'monitor_dash').setDepth(3);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 240;

    return {
      floorId: FLOORS.EXECUTIVE,
      playerStart: { x: 150, y: G - 100 },
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

      infoPoints: [
        {
          x: 380, y: G, contentId: 'executive-suite',
          zone: { shape: 'rect', width: 160, height: 220 },
        },
      ],
    };
  }

  /* ---- background helpers (Pass 3) ---- */

  /**
   * Draw a full-scene vertical gradient into a 1×GAME_HEIGHT texture and
   * stretch it across the scene. Bottom stop = theme.backgroundColor;
   * top stop = the same color pushed 15% toward white (rough HSL-lighten
   * effect done via per-channel linear interpolation toward #ffffff).
   */
  private buildGradientSky(): void {
    const bottom = this.floorData.theme.backgroundColor;
    const top = ExecutiveSuiteScene.lightenTowardWhite(bottom, 0.15);
    const [tr, tg, tb] = ExecutiveSuiteScene.hexToRgb(top);
    const [br, bg_, bb] = ExecutiveSuiteScene.hexToRgb(bottom);

    const key = 'floor4_sky_gradient';
    if (!this.textures.exists(key)) {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      for (let y = 0; y < GAME_HEIGHT; y++) {
        const t = y / (GAME_HEIGHT - 1);
        const r = Math.round(tr + (br - tr) * t);
        const g = Math.round(tg + (bg_ - tg) * t);
        const b = Math.round(tb + (bb - tb) * t);
        gfx.fillStyle((r << 16) | (g << 8) | b, 1);
        gfx.fillRect(0, y, 1, 1);
      }
      gfx.generateTexture(key, 1, GAME_HEIGHT);
      gfx.destroy();
    }

    this.add.image(0, 0, key)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(-100);
  }

  /**
   * Three parallax cloud layers (back/mid/front) drawn as soft rounded
   * white blobs. scrollFactors 0.2/0.4/0.6 follow the plan; the scene's
   * camera is currently fixed but the values are harmless and keep the
   * effect consistent if the scene ever gains a wider world.
   */
  private buildParallaxClouds(): void {
    const backKey = 'floor4_cloud_back';
    const midKey = 'floor4_cloud_mid';
    const frontKey = 'floor4_cloud_front';

    if (!this.textures.exists(backKey)) this.generateCloud(backKey, 360, 110, 0.22);
    if (!this.textures.exists(midKey))  this.generateCloud(midKey,  280,  90, 0.28);
    if (!this.textures.exists(frontKey))this.generateCloud(frontKey,220,  70, 0.34);

    // Back layer: highest, smallest feel (big textures, far away).
    this.add.image(260, 140, backKey).setScrollFactor(0.2).setDepth(-90).setAlpha(0.9);
    this.add.image(980, 110, backKey).setScrollFactor(0.2).setDepth(-90).setAlpha(0.9);

    // Mid layer.
    this.add.image(620, 210, midKey).setScrollFactor(0.4).setDepth(-75);
    this.add.image(1120, 250, midKey).setScrollFactor(0.4).setDepth(-75).setAlpha(0.85);

    // Front layer: closest, slightly lower in the sky.
    this.add.image(180, 300, frontKey).setScrollFactor(0.6).setDepth(-60);
    this.add.image(860, 340, frontKey).setScrollFactor(0.6).setDepth(-60).setAlpha(0.9);
  }

  /** Draw a soft, rounded cloud blob into a generated texture. */
  private generateCloud(key: string, w: number, h: number, alpha: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);
    // Soft halo (larger, more translucent).
    gfx.fillStyle(0xffffff, alpha * 0.5);
    gfx.fillCircle(w * 0.30, h * 0.55, h * 0.55);
    gfx.fillCircle(w * 0.55, h * 0.45, h * 0.62);
    gfx.fillCircle(w * 0.75, h * 0.55, h * 0.55);
    // Body.
    gfx.fillStyle(0xffffff, alpha);
    gfx.fillCircle(w * 0.25, h * 0.65, h * 0.40);
    gfx.fillCircle(w * 0.45, h * 0.45, h * 0.48);
    gfx.fillCircle(w * 0.65, h * 0.55, h * 0.44);
    gfx.fillCircle(w * 0.82, h * 0.68, h * 0.36);
    gfx.fillRoundedRect(w * 0.10, h * 0.55, w * 0.80, h * 0.35, h * 0.3);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private static hexToRgb(hex: number): [number, number, number] {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
  }

  /**
   * Linear-interpolate each RGB channel toward white by `amount` (0..1).
   * Produces a visibly lighter shade in the same hue family — close enough
   * to an HSL lightness bump for the backgrounds we use, without the extra
   * code for a round-trip HSL conversion.
   */
  private static lightenTowardWhite(hex: number, amount: number): number {
    const [r, g, b] = ExecutiveSuiteScene.hexToRgb(hex);
    const nr = Math.min(255, Math.round(r + (255 - r) * amount));
    const ng = Math.min(255, Math.round(g + (255 - g) * amount));
    const nb = Math.min(255, Math.round(b + (255 - b) * amount));
    return (nr << 16) | (ng << 8) | nb;
  }
}
