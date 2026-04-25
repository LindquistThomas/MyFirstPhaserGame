import * as SaveManager from './SaveManager';
import * as QuizManager from './QuizManager';
import * as InfoDialogManager from './InfoDialogManager';
import * as AchievementManager from './AchievementManager';
import { ProgressionSystem } from './ProgressionSystem';
import type { KVStorage } from './SaveManager';
import { QUIZ_DATA } from '../config/quiz';
import { FloorId } from '../config/gameConfig';

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
      AchievementManager.setStorage(storage);
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
    if (loadSave === true) {
      this.progression.loadFromSave();
      // Re-evaluate achievements against the loaded state so returning
      // players don't miss notifications for goals they've already met.
      this.checkAchievements();
    } else if (loadSave === false) {
      this.progression.reset();
      AchievementManager.resetAll();
    }
  }

  hasSave(): boolean { return SaveManager.hasSave(); }
  clearSave(): void { SaveManager.clear(); }

  isQuizPassed(id: string): boolean { return QuizManager.isQuizPassed(id); }

  hasBeenSeen(id: string): boolean { return InfoDialogManager.hasBeenSeen(id); }
  hasSeenAnyInfo(): boolean { return InfoDialogManager.hasSeenAny(); }

  markSeen(id: string): void {
    InfoDialogManager.markSeen(id);
    this.checkAchievements();
  }

  /**
   * Record a quiz result and check for newly unlocked achievements.
   * Delegates to QuizManager for persistence; achievement check runs after.
   */
  saveQuizResult(infoId: string, score: number): void {
    QuizManager.saveQuizResult(infoId, score);
    this.checkAchievements();
  }

  /**
   * Check all achievements against the current game state and unlock any
   * that are newly met. Safe to call at any time; repeated calls with the
   * same state are no-ops.
   */
  checkAchievements(): void {
    const p = this.progression;
    AchievementManager.checkAll({
      totalAU: p.getTotalAU(),
      visitedFloors: new Set(p.getVisitedFloors()) as Set<FloorId>,
      collectedTokens: p.getCollectedTokens(),
      passedQuizIds: Object.keys(QUIZ_DATA).filter((id) => QuizManager.isQuizPassed(id)),
      seenInfoIds: InfoDialogManager.getSeenIds(),
    });
  }

  getUnlockedAchievementIds(): string[] {
    return AchievementManager.getUnlockedIds();
  }
}
