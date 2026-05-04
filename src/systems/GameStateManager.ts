import * as SaveManager from './SaveManager';
import * as QuizManager from './QuizManager';
import * as InfoDialogManager from './InfoDialogManager';
import * as AchievementManager from './AchievementManager';
import * as TouchHintStore from './TouchHintStore';
import { ProgressionSystem } from './ProgressionSystem';
import { PlaytimeTracker } from './PlaytimeTracker';
import type { KVStorage } from './SaveManager';
import { eventBus } from './EventBus';
import { NON_SECRET_IDS, ACHIEVEMENT_MAP } from '../config/achievements';
import type { AchievementId } from '../config/achievements';
import { INFO_POINTS } from '../config/info';
import { QUIZ_DATA } from '../config/quiz';
import { FLOORS } from '../config/gameConfig';

/**
 * Single composition root for all persistent game state. Owns the
 * `ProgressionSystem` instance and exposes thin facades over the five
 * module-level stores (`SaveManager`, `QuizManager`, `InfoDialogManager`,
 * `AchievementManager`, `TouchHintStore`).
 *
 * Constructed once per game run in `BootScene.create()` and stashed in
 * `scene.registry` under the key `gameState`. Tests inject a fake
 * `KVStorage` to replace localStorage across all five managers atomically.
 */
export class GameStateManager {
  readonly progression: ProgressionSystem;
  readonly playtime: PlaytimeTracker;

  private initialLoadApplied = false;

  constructor(storage?: KVStorage) {
    if (storage) {
      SaveManager.setStorage(storage);
      QuizManager.setStorage(storage);
      InfoDialogManager.setStorage(storage);
      AchievementManager.setStorage(storage);
      TouchHintStore.setStorage(storage);
    }
    this.progression = new ProgressionSystem();
    this.playtime = new PlaytimeTracker(SaveManager);
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
      this.playtime.loadFromSave();
    } else if (loadSave === false) {
      this.progression.reset();
      this.playtime.reset();
      // A fresh save has no run-in-progress; start one immediately so playtime
      // is tracked from the first moment the player enters the game world.
      this.playtime.startRun();
    }
  }

  hasSave(): boolean { return SaveManager.hasSave(); }
  clearSave(): void { SaveManager.clear(); }

  isQuizPassed(id: string): boolean { return QuizManager.isQuizPassed(id); }

  hasBeenSeen(id: string): boolean { return InfoDialogManager.hasBeenSeen(id); }
  hasSeenAnyInfo(): boolean { return InfoDialogManager.hasSeenAny(); }
  markSeen(id: string): void { InfoDialogManager.markSeen(id); }

  isOnboardingComplete(): boolean { return this.progression.isOnboardingComplete(); }
  completeOnboarding(): void { this.progression.completeOnboarding(); }
  resetOnboarding(): void { this.progression.resetOnboarding(); }
  resetVisitedFloors(): void { this.progression.resetVisitedFloors(); }

  isAchievementUnlocked(id: string): boolean {
    return AchievementManager.isUnlocked(id as Parameters<typeof AchievementManager.isUnlocked>[0]);
  }

  getUnlockedAchievementCount(): number {
    return AchievementManager.getUnlockedCount();
  }

  /**
   * Unlock a single achievement by id and emit `achievement:unlocked` if
   * it was a new unlock. Returns `true` on a new unlock, `false` if already
   * unlocked. Use this for secret/scenario achievements that are triggered
   * programmatically rather than through `checkAchievements()`.
   */
  unlockAchievement(id: AchievementId): boolean {
    if (AchievementManager.unlock(id)) {
      const def = ACHIEVEMENT_MAP.get(id);
      if (def) eventBus.emit('achievement:unlocked', id, def.label);
      return true;
    }
    return false;
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
    // Guard: if no content has been preloaded yet, 'complete all' achievements
    // must not fire (0 passed >= 0 loaded would always be true).  Infinity
    // ensures the condition stays false until at least some content is loaded.
    const loadedInfoCount = Object.keys(INFO_POINTS).length;
    const loadedQuizCount = Object.keys(QUIZ_DATA).length;
    const totalInfoPoints = loadedInfoCount > 0 ? loadedInfoCount : Infinity;
    const totalQuizzes = loadedQuizCount > 0 ? loadedQuizCount : Infinity;

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

  /**
   * Allow `applyInitialLoad` to run again on the next call.
   * Must be called whenever the player makes a new slot selection in
   * `SaveSlotScene` so that the correct save (or fresh state) is applied
   * when `ElevatorScene.init` fires.
   */
  resetLoadState(): void {
    this.initialLoadApplied = false;
  }

  /** Reset ALL persistent state including achievements and touch hint. */
  resetAll(): void {
    this.progression.reset();
    this.playtime.reset();
    AchievementManager.resetAll();
    TouchHintStore.clearSeen();
    this.resetLoadState();
  }

  /**
   * Called from BossArenaScene after the CEO fight ends.
   * Unlocks boss-specific achievements that depend on transient in-scene flags.
   */
  checkBossAchievements(defeated: boolean, noDamage: boolean): void {
    const newlyUnlocked: string[] = [];
    if (defeated && AchievementManager.unlock('boss-defeated' as Parameters<typeof AchievementManager.unlock>[0])) {
      newlyUnlocked.push('boss-defeated');
    }
    if (defeated && noDamage && AchievementManager.unlock('boss-no-damage' as Parameters<typeof AchievementManager.unlock>[0])) {
      newlyUnlocked.push('boss-no-damage');
    }
    for (const id of newlyUnlocked) {
      const def = ACHIEVEMENT_MAP.get(id as Parameters<typeof ACHIEVEMENT_MAP.get>[0]);
      if (def) eventBus.emit('achievement:unlocked', id, def.label);
    }
  }

  /**
   * Called from ExecutiveSuiteScene when leadership is freed.
   * Unlocks the hostage-rescue achievement.
   */
  unlockHostageRescue(): void {
    if (AchievementManager.unlock('hostage-rescue' as Parameters<typeof AchievementManager.unlock>[0])) {
      const def = ACHIEVEMENT_MAP.get('hostage-rescue' as Parameters<typeof ACHIEVEMENT_MAP.get>[0]);
      if (def) eventBus.emit('achievement:unlocked', 'hostage-rescue', def.label);
    }
  }
}
