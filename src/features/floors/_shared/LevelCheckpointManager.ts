import * as Phaser from 'phaser';
import { Checkpoint } from '../../../entities/Checkpoint';
import type { FloorId } from '../../../config/gameConfig';
import type { ProgressionSystem } from '../../../systems/ProgressionSystem';
import type { FloorHitState } from '../../../systems/FloorHitState';
import { eventBus } from '../../../systems/EventBus';
import type { LevelConfig } from './LevelConfig';

export interface LevelCheckpointManagerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  progression: ProgressionSystem;
  floorHazard: FloorHitState;
}

export class LevelCheckpointManager {
  constructor(private readonly deps: LevelCheckpointManagerDeps) {}

  init(
    cfg: LevelConfig,
    physics: Phaser.Physics.Arcade.ArcadePhysics,
    playerSprite: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (!cfg.checkpoints?.length) return;

    const activated = new Set(this.deps.progression.getActivatedCheckpointIds(this.deps.floorId));
    const latestActivatedId = this.deps.progression.getLatestActivatedCheckpointId(this.deps.floorId);

    for (const cp of cfg.checkpoints) {
      const isActivated = activated.has(cp.id);
      const checkpoint = new Checkpoint(
        this.deps.scene,
        cp.x,
        cp.y,
        cp.id,
        () => {
          this.deps.floorHazard.registerCheckpoint(cp.x, cp.y);
          this.deps.progression.activateCheckpoint(this.deps.floorId, cp.id);
          eventBus.emit('checkpoint:activate', cp.id);
        },
        isActivated,
      );

      if (cp.id === latestActivatedId) {
        this.deps.floorHazard.registerCheckpoint(cp.x, cp.y);
      }

      checkpoint.wireOverlap(physics, playerSprite);
    }
  }

  resolveEntrySpawn(cfg: LevelConfig): { x: number; y: number } {
    const latestCheckpointId = this.deps.progression.getLatestActivatedCheckpointId(this.deps.floorId);
    if (!latestCheckpointId) return cfg.playerStart;

    const checkpoint = cfg.checkpoints?.find((cp) => cp.id === latestCheckpointId);
    if (!checkpoint) {
      this.deps.progression.clearActivatedCheckpoints(this.deps.floorId);
      return cfg.playerStart;
    }

    return { x: checkpoint.x, y: checkpoint.y };
  }

  resolveRespawnTarget(playerStart: { x: number; y: number }): { x: number; y: number } {
    return this.deps.floorHazard.getCheckpointPos() ?? playerStart;
  }

  update(): void {
    // Checkpoints are overlap-driven; no per-frame polling needed.
  }

  shutdown(): void {
    // Checkpoints are scene-owned game objects; scene shutdown handles destruction.
  }
}
