import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, type FloorId } from '../../../config/gameConfig';
import type { FloorData } from '../../../config/levelData';
import type { Player } from '../../../entities/Player';
import type { Enemy } from '../../../entities/Enemy';
import { isReducedMotion } from '../../../systems/MotionPreference';
import { createSceneLifecycle } from '../../../systems/sceneLifecycle';
import { drawSceneBackdrop, type FloorPatternId } from './sceneBackdrop';
import { drawFloorAccents } from './floorAccents';
import type { LevelConfig } from './LevelConfig';

export interface DecorationsManagerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  floorData: FloorData;
}

/**
 * Owns all visual-layer concerns that do not affect gameplay physics:
 *   - Backdrop + wall pattern (via {@link drawSceneBackdrop}).
 *   - Per-floor accent silhouettes (via {@link drawFloorAccents}).
 *   - Shared decoration helpers: ambient plants, entry signposts.
 *   - Atmospheric FX: color-grade overlay, ambient motes, drop shadows.
 *   - Floor-unlock particle celebration.
 *   - Thin catwalk geometry + visuals.
 */
export class LevelDecorationsManager {
  private playerShadow?: Phaser.GameObjects.Image;
  private readonly enemyShadows: Array<Phaser.GameObjects.Image | undefined> = [];

  constructor(private readonly deps: DecorationsManagerDeps) {}

  // ---- background ----------------------------------------------------------------

  /**
   * Draw the layered backdrop.  Called from `LevelScene.createBackground()` so
   * subclass overrides that call `super.createBackground()` still work.
   */
  createBackground(
    pattern: FloorPatternId,
    drawAccents: (g: Phaser.GameObjects.Graphics) => void,
  ): void {
    const { scene, floorData, floorId } = this.deps;
    drawSceneBackdrop(scene, {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      theme: {
        backgroundColor: floorData.theme.backgroundColor,
        wallColor: floorData.theme.wallColor,
        platformColor: floorData.theme.platformColor,
      },
      pattern,
      patternSeed: floorId,
      drawAccents,
    });
  }

  /**
   * Default per-floor accent painter.  Invoked by
   * `LevelScene.drawBackgroundAccents()`; subclasses may override that hook
   * to suppress or replace the motif.
   */
  drawBackgroundAccents(g: Phaser.GameObjects.Graphics): void {
    const { scene, floorId, floorData } = this.deps;
    drawFloorAccents(floorId, {
      scene,
      g,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      theme: {
        backgroundColor: floorData.theme.backgroundColor,
        wallColor: floorData.theme.wallColor,
        platformColor: floorData.theme.platformColor,
        tokenColor: floorData.theme.tokenColor,
      },
    });
  }

  // ---- decoration helpers --------------------------------------------------------

  /**
   * Place ambient plant sprites along the floor edge.
   * Called from `LevelScene.addAmbientPlants()` so subclass `createDecorations`
   * overrides that call `this.addAmbientPlants(...)` continue to work.
   */
  addAmbientPlants(
    plants: Array<{ x: number; kind: 'tall' | 'small'; depth?: number }>,
  ): void {
    const scene = this.deps.scene;
    const G = GAME_HEIGHT - TILE_SIZE;
    for (const p of plants) {
      const yOff = p.kind === 'tall' ? 40 : 32;
      const depth = p.depth ?? (p.kind === 'tall' ? 3 : 11);
      scene.add.image(p.x, G - yOff, `plant_${p.kind}`).setDepth(depth);
    }
  }

  /**
   * Place an info-board signpost at `x`.
   * Called from `LevelScene.addSignpost()`.
   */
  addSignpost(opts: {
    x: number;
    label: string;
    color: string;
    fontSize?: number;
  }): void {
    const scene = this.deps.scene;
    const G = GAME_HEIGHT - TILE_SIZE;
    const fontSize = opts.fontSize ?? 13;
    scene.add.image(opts.x, G - 60, 'info_board').setDepth(3);
    scene.add.text(opts.x, G - 130, opts.label, {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: opts.color,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(4);
  }

  // ---- catwalks ------------------------------------------------------------------

  /**
   * Build thin floating walkways: static physics body + catwalk graphic.
   * Extracted from `LevelScene.buildCatwalks()`.
   */
  buildCatwalks(config: LevelConfig, platformGroup: Phaser.Physics.Arcade.StaticGroup): void {
    if (!config.catwalks?.length) return;
    const scene = this.deps.scene;
    for (const c of config.catwalks) {
      const thickness = c.thickness ?? 20;
      const cx = c.x + c.width / 2;
      const cy = c.y + thickness / 2;

      // Physics body (invisible rectangle, added to platformGroup).
      const body = scene.add.rectangle(cx, cy, c.width, thickness, 0x000000, 0);
      scene.physics.add.existing(body, true);
      platformGroup.add(body);

      // One-way: only collide from above (jump-through from below).
      const pbody = body.body as Phaser.Physics.Arcade.StaticBody;
      pbody.checkCollision.down = false;
      pbody.checkCollision.left = false;
      pbody.checkCollision.right = false;

      // Decorative face.
      const g = scene.add.graphics().setDepth(2.2);
      const x = c.x, y = c.y, w = c.width, h = thickness;
      g.fillStyle(0x4a5560, 1).fillRect(x, y, w, h);
      g.fillStyle(0x8fa0b3, 1).fillRect(x, y, w, 3);
      g.fillStyle(0x2a323c, 1).fillRect(x, y + h - 2, w, 2);
      g.fillStyle(0x1a2028, 1);
      for (let rx = x + 10; rx < x + w - 6; rx += 32) {
        g.fillRect(rx, y + 6, 2, 2);
        g.fillRect(rx, y + h - 8, 2, 2);
      }
      g.fillStyle(0x2a323c, 1);
      g.fillRect(x, y, 2, h);
      g.fillRect(x + w - 2, y, 2, h);
    }
  }

  // ---- atmospheric FX ------------------------------------------------------------

  /**
   * Add the per-frame atmospheric layer: color-grade overlay, ambient motes,
   * player drop shadow, and enemy drop shadows.
   * Called from `LevelScene.create()` after player + enemies are spawned.
   */
  createAtmosphericFx(player: Player, enemies: readonly Enemy[]): void {
    const { scene, floorData } = this.deps;

    // 1. Color grading overlay.
    const gradeOverlay = scene.add.graphics().setDepth(5.5).setScrollFactor(0);
    gradeOverlay.fillStyle(floorData.theme.tokenColor, 0.05);
    gradeOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 2. Ambient motes.
    if (!isReducedMotion() && scene.textures.exists('particle')) {
      const motes = scene.add.particles(0, 0, 'particle', {
        x: { min: 0, max: GAME_WIDTH },
        y: { min: 0, max: GAME_HEIGHT - 64 },
        speedY: { min: -12, max: -4 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.35, end: 0.1 },
        alpha: { start: 0.18, end: 0 },
        lifespan: { min: 6000, max: 11000 },
        frequency: 1200,
        quantity: 1,
        tint: floorData.theme.tokenColor,
      });
      motes.setDepth(1.5);
    }

    // 3. Player drop shadow.
    if (scene.textures.exists('shadow_blob')) {
      this.playerShadow = scene.add
        .image(player.sprite.x, player.sprite.y + 70, 'shadow_blob')
        .setDepth(9.5);
    }

    // 4. Enemy drop shadows.
    for (const enemy of enemies) {
      if (!scene.textures.exists('shadow_blob')) break;
      const sh = scene.add.image(enemy.x, enemy.y + 28, 'shadow_blob').setDepth(5.5).setScale(0.7);
      this.enemyShadows.push(sh);
    }
  }

  /**
   * Subscribe to `progression:floor_unlocked` for the camera-flash +
   * particle-burst celebration.  Called from `LevelScene.create()` after the
   * player is available.
   */
  setupFloorUnlockCelebration(player: Player): void {
    const { scene } = this.deps;
    const lc = createSceneLifecycle(scene);
    lc.bindEventBus('progression:floor_unlocked', () => {
      if (isReducedMotion()) return;
      const px = player.sprite.x;
      const py = player.sprite.y;
      scene.cameras.main.flash(350, 255, 200, 0, false);
      scene.cameras.main.shake(280, 0.006);
      this.spawnFloorUnlockParticles(px, py);
    });
  }

  private spawnFloorUnlockParticles(x: number, y: number): void {
    const scene = this.deps.scene;
    if (!scene.textures.exists('particle')) return;
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 80, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 900,
      gravityY: 100,
      tint: [0xffd700, 0xffed4a, 0xffa500, 0xffffff, 0xffcc00],
      emitting: false,
    });
    emitter.setDepth(12);
    emitter.explode(45);
    scene.time.delayedCall(1000, () => emitter.destroy());
  }

  // ---- per-frame update ----------------------------------------------------------

  /**
   * Track player + enemy drop shadows.  Called from `LevelScene.update()`.
   */
  updateAtmosphericFx(player: Player, enemies: readonly Enemy[]): void {
    if (this.playerShadow) {
      const p = player.sprite;
      const body = p.body as Phaser.Physics.Arcade.Body;
      const onGround = body.blocked.down || body.touching.down;
      this.playerShadow.setPosition(p.x, p.y + 70);
      if (onGround) {
        this.playerShadow.setAlpha(1).setScale(1);
      } else {
        const vy = body.velocity.y;
        const fade = Phaser.Math.Clamp(1 - Math.abs(vy) / 600, 0.3, 1);
        this.playerShadow.setAlpha(fade * 0.85).setScale(fade);
      }
    }

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
}
