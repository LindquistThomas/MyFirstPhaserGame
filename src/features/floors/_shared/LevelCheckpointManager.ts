import type * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, type FloorId } from '../../../config/gameConfig';
import type { Player } from '../../../entities/Player';
import { Checkpoint } from '../../../entities/Checkpoint';
import type { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { FloorHitState } from '../../../systems/FloorHitState';
import { eventBus } from '../../../systems/EventBus';
import { isReducedMotion } from '../../../systems/MotionPreference';
import type { LevelConfig } from './LevelConfig';

export interface CheckpointManagerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  progression: ProgressionSystem;
  getIsTransitioning: () => boolean;
  /** Returns the authored `playerStart` from the resolved level config. */
  getPlayerStart: () => { x: number; y: number };
}

/**
 * Owns hit tracking, checkpoints, player respawn, and the danger-zone
 * vignette + heartbeat SFX.
 *
 *   - `createDangerVignette()` — build the red edge-band overlay.
 *   - `spawn(config)` — place `Checkpoint` entities and wire overlaps.
 *   - `onPlayerHit()` — record a hit; triggers respawn at 3 hits.
 *   - `triggerRespawn()` — teleport player to last checkpoint / playerStart.
 *   - `updateDangerState(delta)` — show/hide vignette, pace heartbeat SFX.
 */
export class LevelCheckpointManager {
  /** Per-visit hit / checkpoint tracking. */
  readonly floorHazard = new FloorHitState();

  private dangerVignette?: Phaser.GameObjects.Graphics;
  private heartbeatElapsed = 0;
  private static readonly HEARTBEAT_INTERVAL_MS = 850;

  /** Set after `createPlayer()` via {@link setPlayer}. */
  private player?: Player;

  constructor(private readonly deps: CheckpointManagerDeps) {}

  /**
   * Inject the player reference once it has been constructed.
   * Called from `LevelScene.create()` immediately after `createPlayer()`.
   */
  setPlayer(player: Player): void {
    this.player = player;
  }

  // ---- danger vignette -----------------------------------------------------------

  /**
   * Build the red screen-edge vignette shown when the player is in the
   * danger zone.  Must be called once during `LevelScene.create()`.
   */
  createDangerVignette(): void {
    this.dangerVignette = this.deps.scene.add.graphics()
      .setDepth(98)
      .setScrollFactor(0)
      .setVisible(false);
    const g = this.dangerVignette;
    const alpha = 0.35;
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;
    const band = 80;
    g.fillStyle(0xff2222, alpha);
    g.fillRect(0,       0,       w,    band); // top
    g.fillRect(0,       h - band, w,   band); // bottom
    g.fillRect(0,       0,       band, h);    // left
    g.fillRect(w - band, 0,      band, h);    // right
  }

  // ---- checkpoint spawning -------------------------------------------------------

  /**
   * Place `Checkpoint` entities from `config.checkpoints` and wire overlap
   * with the player sprite.  Called from `LevelScene.create()`.
   */
  spawn(config: LevelConfig): void {
    if (!config.checkpoints?.length) return;
    const { scene } = this.deps;
    if (!this.player) {
      throw new Error('LevelCheckpointManager.spawn() called before setPlayer()');
    }
    const player = this.player;
    const total = config.checkpoints.length;
    for (const [index, cp] of config.checkpoints.entries()) {
      const checkpoint = new Checkpoint(
        scene,
        cp.x,
        cp.y,
        cp.id,
        () => {
          this.floorHazard.registerCheckpoint(cp.x, cp.y);
          eventBus.emit('checkpoint:activate', cp.id);
          eventBus.emit('checkpoint:reached', { index: index + 1, total });
        },
      );
      checkpoint.wireOverlap(scene.physics, player.sprite);
    }
  }

  // ---- hit / respawn -------------------------------------------------------------

  /**
   * Record one player hit.  If three hits have accumulated, triggers respawn.
   * Passed as the `onPlayerHit` callback to `LevelEnemySpawner`.
   */
  onPlayerHit(): void {
    const shouldRespawn = this.floorHazard.recordHit();
    if (shouldRespawn) {
      this.triggerRespawn();
    }
  }

  /**
   * Teleport the player to the most recent checkpoint (or `playerStart` if
   * none has been activated) with a brief camera flash.
   * Called from `LevelScene.triggerRespawn()` (protected stub).
   */
  triggerRespawn(): void {
    if (this.deps.getIsTransitioning()) return;

    const cp = this.floorHazard.getCheckpointPos();
    const target = cp ?? this.deps.getPlayerStart();

    this.floorHazard.reset();
    this.heartbeatElapsed = 0;
    this.dangerVignette?.setVisible(false);

    if (!isReducedMotion()) {
      this.deps.scene.cameras.main.flash(180, 255, 255, 255, true);
    }
    this.player?.setPosition(target.x, target.y);
  }

  // ---- per-frame update ----------------------------------------------------------

  /**
   * Show/hide the danger vignette and pace heartbeat SFX.
   * Called from `LevelScene.update()`.
   */
  updateDangerState(delta: number): void {
    const inDanger = this.floorHazard.isDangerZone()
      && this.deps.progression.getFloorAU(this.deps.floorId) <= 1;

    if (this.dangerVignette) {
      this.dangerVignette.setVisible(inDanger && !isReducedMotion());
    }

    if (inDanger) {
      this.heartbeatElapsed += delta;
      if (this.heartbeatElapsed >= LevelCheckpointManager.HEARTBEAT_INTERVAL_MS) {
        this.heartbeatElapsed = 0;
        eventBus.emit('sfx:heartbeat');
      }
    } else {
      this.heartbeatElapsed = 0;
    }
  }
}
