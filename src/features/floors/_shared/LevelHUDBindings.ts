import * as Phaser from 'phaser';
import { HUD } from '../../../ui/HUD';
import { eventBus } from '../../../systems/EventBus';
import type { ProgressionSystem } from '../../../systems/ProgressionSystem';
import type { PlaytimeTracker } from '../../../systems/PlaytimeTracker';

export interface LevelHUDBindingsDeps {
  scene: Phaser.Scene;
  progression: ProgressionSystem;
  playtime: PlaytimeTracker;
  getObjectiveText: () => string;
  isObjectiveHidden: () => boolean;
}

export class LevelHUDBindings {
  private hud?: HUD;
  private lastObjectiveText = '';

  constructor(private readonly deps: LevelHUDBindingsDeps) {}

  init(): void {
    this.lastObjectiveText = this.getObjectiveText();
    this.hud = new HUD(this.deps.scene, this.deps.progression, this.deps.playtime, {
      getObjectiveText: this.deps.getObjectiveText,
      isObjectiveHidden: this.deps.isObjectiveHidden,
    });
  }

  update(): void {
    const objectiveText = this.getObjectiveText();
    if (objectiveText !== this.lastObjectiveText) {
      this.lastObjectiveText = objectiveText;
      if (objectiveText.length > 0) {
        eventBus.emit('objective:updated', { text: objectiveText });
      }
    }
    this.hud?.update();
  }

  showToast(message: string, durationMs?: number): void {
    this.hud?.showToast(message, durationMs);
  }

  shutdown(): void {
    this.hud = undefined;
  }

  private getObjectiveText(): string {
    return this.deps.getObjectiveText().trim();
  }
}
