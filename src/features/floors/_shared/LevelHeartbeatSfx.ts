import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../config/gameConfig';
import type { FloorId } from '../../../config/gameConfig';
import type { FloorHitState } from '../../../systems/FloorHitState';
import type { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { eventBus } from '../../../systems/EventBus';
import { isReducedMotion } from '../../../systems/MotionPreference';

const HEARTBEAT_INTERVAL_MS = 850;
const VIGNETTE_ALPHA = 0.35;
const VIGNETTE_BAND_WIDTH = 80;
const VIGNETTE_COLOR = 0xff2222;
const VIGNETTE_DEPTH = 98;

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
      .setDepth(VIGNETTE_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    g.fillStyle(VIGNETTE_COLOR, VIGNETTE_ALPHA);
    g.fillRect(0, 0, GAME_WIDTH, VIGNETTE_BAND_WIDTH);
    g.fillRect(0, GAME_HEIGHT - VIGNETTE_BAND_WIDTH, GAME_WIDTH, VIGNETTE_BAND_WIDTH);
    g.fillRect(0, 0, VIGNETTE_BAND_WIDTH, GAME_HEIGHT);
    g.fillRect(GAME_WIDTH - VIGNETTE_BAND_WIDTH, 0, VIGNETTE_BAND_WIDTH, GAME_HEIGHT);

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
