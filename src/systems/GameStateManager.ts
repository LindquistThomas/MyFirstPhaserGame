import * as SaveManager from './SaveManager';
import * as QuizManager from './QuizManager';
import * as InfoDialogManager from './InfoDialogManager';
import { ProgressionSystem } from './ProgressionSystem';
import type { KVStorage } from './SaveManager';

/**
 * Single composition root for all persistent game state. Owns the
 * `ProgressionSystem` instance and exposes thin facades over the three
 * module-level stores (`SaveManager`, `QuizManager`, `InfoDialogManager`).
 *
 * Constructed once per game run in `BootScene.create()` and stashed in
 * `scene.registry` under the key `gameState`. Tests inject a fake
 * `KVStorage` to replace localStorage across all four managers atomically.
 */
export class GameStateManager {
  readonly progression: ProgressionSystem;

  private initialLoadApplied = false;

  constructor(storage?: KVStorage) {
    if (storage) {
      SaveManager.setStorage(storage);
      QuizManager.setStorage(storage);
      InfoDialogManager.setStorage(storage);
    }
    this.progression = new ProgressionSystem();
  }

  /**
   * Apply the one-shot new-game / continue decision from the main menu.
   * Called from `ElevatorScene.init(data)` with `data.loadSave`.
   * Subsequent calls are no-ops so re-entering the elevator doesn't wipe
   * progress mid-run.
   */
  applyInitialLoad(loadSave?: boolean): void {
    if (this.initialLoadApplied) return;
    this.initialLoadApplied = true;
    if (loadSave === true) this.progression.loadFromSave();
    else if (loadSave === false) this.progression.reset();
  }

  hasSave(): boolean { return SaveManager.hasSave(); }
  clearSave(): void { SaveManager.clear(); }

  isQuizPassed(id: string): boolean { return QuizManager.isQuizPassed(id); }

  hasBeenSeen(id: string): boolean { return InfoDialogManager.hasBeenSeen(id); }
  markSeen(id: string): void { InfoDialogManager.markSeen(id); }
}
