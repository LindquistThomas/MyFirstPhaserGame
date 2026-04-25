import * as SaveManager from './SaveManager';
import * as QuizManager from './QuizManager';
import * as InfoDialogManager from './InfoDialogManager';
import * as AchievementManager from './AchievementManager';
import { ProgressionSystem } from './ProgressionSystem';
import type { KVStorage } from './SaveManager';
import { eventBus } from './EventBus';
import { NON_SECRET_IDS, ACHIEVEMENT_MAP } from '../config/achievements';
import { INFO_POINTS } from '../config/info';
import { QUIZ_DATA } from '../config/quiz';
import { FLOORS } from '../config/gameConfig';

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
    if (loadSave === true) this.progression.loadFromSave();
    else if (loadSave === false) this.progression.reset();
  }

  hasSave(): boolean { return SaveManager.hasSave(); }
  clearSave(): void { SaveManager.clear(); }

  isQuizPassed(id: string): boolean { return QuizManager.isQuizPassed(id); }

  hasBeenSeen(id: string): boolean { return InfoDialogManager.hasBeenSeen(id); }
  hasSeenAnyInfo(): boolean { return InfoDialogManager.hasSeenAny(); }
  markSeen(id: string): void { InfoDialogManager.markSeen(id); }

  isAchievementUnlocked(id: string): boolean {
    return AchievementManager.isUnlocked(id as Parameters<typeof AchievementManager.isUnlocked>[0]);
  }

  getUnlockedAchievementCount(): number {
    return AchievementManager.getUnlockedCount();
  }

  /**
   * Check all achievement conditions against the current game state and
   * emit `achievement:unlocked` for each newly satisfied achievement.
   *
   * Call this after any state mutation that could trigger an achievement:
   * token collection, info dialog opened, quiz passed, floor entered.
   */
  checkAchievements(): void {
    const totalAU = this.progression.getTotalAU();
    const visitedFloors = this.progression.getVisitedFloorCount();
    const seenInfo = InfoDialogManager.getSeenCount();
    const passedQuizzes = QuizManager.getPassedCount();
    const collectedTokens = this.progression.getTotalCollectedTokens();

    const totalFloors = Object.values(FLOORS).length;
    const totalInfoPoints = Object.keys(INFO_POINTS).length;
    const totalQuizzes = Object.keys(QUIZ_DATA).length;

    const conditions: Record<string, boolean> = {
      'au-5':        totalAU >= 5,
      'au-15':       totalAU >= 15,
      'au-30':       totalAU >= 30,
      'au-50':       totalAU >= 50,
      'floors-3':    visitedFloors >= 3,
      'floors-all':  visitedFloors >= totalFloors,
      'info-1':      seenInfo >= 1,
      'info-5':      seenInfo >= 5,
      'info-all':    seenInfo >= totalInfoPoints,
      'quiz-1':      passedQuizzes >= 1,
      'quiz-5':      passedQuizzes >= 5,
      'quiz-all':    passedQuizzes >= totalQuizzes,
      'tokens-10':   collectedTokens >= 10,
      'tokens-25':   collectedTokens >= 25,
    };

    const newlyUnlocked: string[] = [];
    for (const id of NON_SECRET_IDS) {
      if (conditions[id] && AchievementManager.unlock(id)) {
        newlyUnlocked.push(id);
      }
    }

    // Grand Architect: all non-secret achievements unlocked.
    const allNonSecretDone = NON_SECRET_IDS.every((id) => AchievementManager.isUnlocked(id));
    if (allNonSecretDone && AchievementManager.unlock('grand-architect')) {
      newlyUnlocked.push('grand-architect');
    }

    for (const id of newlyUnlocked) {
      const def = ACHIEVEMENT_MAP.get(id as Parameters<typeof ACHIEVEMENT_MAP.get>[0]);
      if (def) eventBus.emit('achievement:unlocked', id, def.label);
    }
  }

  /** Reset ALL persistent state including achievements. */
  resetAll(): void {
    this.progression.reset();
    AchievementManager.resetAll();
  }
}
