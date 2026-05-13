import * as Phaser from 'phaser';
import type { FloorId } from '../../../config/gameConfig';
import type { FloorHitState } from '../../../systems/FloorHitState';
import type { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { eventBus } from '../../../systems/EventBus';
import { isReducedMotion } from '../../../systems/MotionPreference';

const HEARTBEAT_INTERVAL_MS = 850;

export interface LevelHeartbeatSfxDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  progression: ProgressionSystem;
  floorHazard: FloorHitState;
}

export class LevelHeartbeatSfx {
  private dangerVignette?: Phaser.GameObjects.Graphics;
  private heartbeatElapsed = 0;

  constructor(private readonly deps: LevelHeartbeatSfxDeps) {}

  init(): void {
    const g = this.deps.scene.add.graphics()
      .setDepth(98)
      .setScrollFactor(0)
      .setVisible(false);

    const alpha = 0.35;
    const w = this.deps.scene.scale.width;
    const h = this.deps.scene.scale.height;
    const band = 80;
    g.fillStyle(0xff2222, alpha);
    g.fillRect(0, 0, w, band);
    g.fillRect(0, h - band, w, band);
    g.fillRect(0, 0, band, h);
    g.fillRect(w - band, 0, band, h);

    this.dangerVignette = g;
  }

  update(delta: number): void {
    const inDanger = this.deps.floorHazard.isDangerZone()
      && this.deps.progression.getFloorAU(this.deps.floorId) <= 1;

    if (this.dangerVignette) {
      this.dangerVignette.setVisible(inDanger && !isReducedMotion());
    }

    if (inDanger) {
      this.heartbeatElapsed += delta;
      if (this.heartbeatElapsed >= HEARTBEAT_INTERVAL_MS) {
        this.heartbeatElapsed = 0;
        eventBus.emit('sfx:heartbeat');
      }
    } else {
      this.heartbeatElapsed = 0;
    }
  }

  reset(): void {
    this.heartbeatElapsed = 0;
    this.dangerVignette?.setVisible(false);
  }

  shutdown(): void {
    this.dangerVignette?.destroy();
    this.dangerVignette = undefined;
    this.heartbeatElapsed = 0;
  }
}
