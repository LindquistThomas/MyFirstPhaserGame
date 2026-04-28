import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameStateManager } from './GameStateManager';
import { setPlayerSlot, KVStorage } from './SaveManager';
import { FLOORS } from '../config/gameConfig';
import { QUIZ_PASS_THRESHOLD } from '../config/quiz';
import { saveQuizResult } from './QuizManager';
import { eventBus } from './EventBus';

function memoryStorage(): KVStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('GameStateManager', () => {
  beforeEach(() => {
    setPlayerSlot('test');
  });

  it('wires the injected KVStorage across all managed stores', () => {
    const storage = memoryStorage();
    const state = new GameStateManager(storage);

    state.progression.addAU(FLOORS.LOBBY, 3);
    saveQuizResult('info-x', QUIZ_PASS_THRESHOLD);
    state.markSeen('info-x');

    // All three stores should have written into the SAME injected storage
    // (proving setStorage was propagated to every underlying manager).
    const keys = [...storage.store.keys()];
    expect(keys).toContain('architect_test_v1');      // SaveManager
    expect(keys).toContain('architect_quiz_v1');      // QuizManager
    expect(keys).toContain('architect_info_seen_v1'); // InfoDialogManager
  });

  it('exposes a ProgressionSystem starting at defaults', () => {
    const state = new GameStateManager(memoryStorage());
    expect(state.progression.getTotalAU()).toBe(0);
    expect(state.progression.getCurrentFloor()).toBe(FLOORS.LOBBY);
  });

  it('applyInitialLoad(true) restores from save on first call only', () => {
    const storage = memoryStorage();
    // Pre-seed a save via one GameStateManager instance.
    const pre = new GameStateManager(storage);
    pre.progression.addAU(FLOORS.LOBBY, 5);

    // A fresh instance on the same storage starts empty until we apply load.
    const state = new GameStateManager(storage);
    expect(state.progression.getTotalAU()).toBe(0);

    state.applyInitialLoad(true);
    expect(state.progression.getTotalAU()).toBe(5);

    // Second call is a no-op — even if we ask to reset.
    state.applyInitialLoad(false);
    expect(state.progression.getTotalAU()).toBe(5);
  });

  it('resetLoadState() allows applyInitialLoad to run again', () => {
    const storage = memoryStorage();
    const pre = new GameStateManager(storage);
    pre.progression.addAU(FLOORS.LOBBY, 7);

    const state = new GameStateManager(storage);
    state.applyInitialLoad(true);
    expect(state.progression.getTotalAU()).toBe(7);

    // Simulate deleting the save then starting fresh on the same slot.
    state.resetLoadState();
    state.applyInitialLoad(false);
    expect(state.progression.getTotalAU()).toBe(0);
    expect(state.hasSave()).toBe(false);
  });

  it('resetAll() resets load state so applyInitialLoad runs again', () => {
    const storage = memoryStorage();
    const pre = new GameStateManager(storage);
    pre.progression.addAU(FLOORS.LOBBY, 7);

    const state = new GameStateManager(storage);
    state.applyInitialLoad(true);
    expect(state.progression.getTotalAU()).toBe(7);

    state.resetAll();
    // After resetAll the guard should be cleared — re-applying does nothing
    // because progression was already wiped, but the call must not be skipped.
    state.applyInitialLoad(false);
    expect(state.progression.getTotalAU()).toBe(0);
  });

  it('applyInitialLoad(false) wipes persisted state on first call', () => {
    const storage = memoryStorage();
    const pre = new GameStateManager(storage);
    pre.progression.addAU(FLOORS.LOBBY, 5);
    saveQuizResult('info-x', QUIZ_PASS_THRESHOLD);
    pre.markSeen('info-x');

    const state = new GameStateManager(storage);
    state.applyInitialLoad(false);

    expect(state.progression.getTotalAU()).toBe(0);
    expect(state.isQuizPassed('info-x')).toBe(false);
    expect(state.hasBeenSeen('info-x')).toBe(false);
    expect(state.hasSave()).toBe(false);
  });

  it('applyInitialLoad(undefined) neither loads nor resets', () => {
    const storage = memoryStorage();
    const pre = new GameStateManager(storage);
    pre.progression.addAU(FLOORS.LOBBY, 5);

    const state = new GameStateManager(storage);
    state.applyInitialLoad(undefined);
    expect(state.progression.getTotalAU()).toBe(0);
    expect(state.hasSave()).toBe(true);
  });

  it('facade methods delegate to the underlying managers', () => {
    const state = new GameStateManager(memoryStorage());

    expect(state.hasSave()).toBe(false);
    state.progression.addAU(FLOORS.LOBBY, 1); // triggers SaveManager.save
    expect(state.hasSave()).toBe(true);

    expect(state.hasBeenSeen('foo')).toBe(false);
    state.markSeen('foo');
    expect(state.hasBeenSeen('foo')).toBe(true);

    expect(state.isQuizPassed('q1')).toBe(false);
    saveQuizResult('q1', QUIZ_PASS_THRESHOLD);
    expect(state.isQuizPassed('q1')).toBe(true);

    state.clearSave();
    expect(state.hasSave()).toBe(false);
  });

  it('wires AchievementManager storage alongside other stores', () => {
    const storage = memoryStorage();
    const state = new GameStateManager(storage);

    // Trigger the au-5 achievement by adding AU.
    state.progression.addAU(FLOORS.LOBBY, 5);
    state.checkAchievements();

    expect(storage.store.has('architect_achievements_v1')).toBe(true);
    expect(state.isAchievementUnlocked('au-5')).toBe(true);
  });
});

describe('GameStateManager.checkAchievements', () => {
  let storage: KVStorage & { store: Map<string, string> };
  let state: GameStateManager;

  beforeEach(() => {
    setPlayerSlot('ach-test');
    storage = memoryStorage();
    state = new GameStateManager(storage);
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('emits achievement:unlocked when AU threshold is crossed', () => {
    const unlocked: string[] = [];
    eventBus.on('achievement:unlocked', (id) => unlocked.push(id));

    state.progression.addAU(FLOORS.LOBBY, 5);
    state.checkAchievements();

    expect(unlocked).toContain('au-5');
    expect(state.isAchievementUnlocked('au-5')).toBe(true);
  });

  it('does not emit achievement:unlocked on repeated checks (idempotent)', () => {
    state.progression.addAU(FLOORS.LOBBY, 5);
    state.checkAchievements();

    const spy = vi.fn();
    eventBus.on('achievement:unlocked', spy);
    state.checkAchievements();

    expect(spy).not.toHaveBeenCalled();
  });

  it('unlocks floor-exploration achievements when floors are visited', () => {
    const allFloors = [FLOORS.LOBBY, FLOORS.PLATFORM_TEAM, FLOORS.BUSINESS];
    for (const f of allFloors) state.progression.markFloorVisited(f);
    state.checkAchievements();

    expect(state.isAchievementUnlocked('floors-3')).toBe(true);
    expect(state.isAchievementUnlocked('floors-all')).toBe(false);
  });

  it('unlocks info achievements when info panels are seen', () => {
    state.markSeen('info-a');
    state.checkAchievements();

    expect(state.isAchievementUnlocked('info-1')).toBe(true);
    expect(state.isAchievementUnlocked('info-5')).toBe(false);
  });

  it('unlocks quiz achievements when quizzes are passed', () => {
    saveQuizResult('q1', QUIZ_PASS_THRESHOLD);
    state.checkAchievements();

    expect(state.isAchievementUnlocked('quiz-1')).toBe(true);
  });

  it('getUnlockedAchievementCount returns correct count', () => {
    expect(state.getUnlockedAchievementCount()).toBe(0);
    state.progression.addAU(FLOORS.LOBBY, 5);
    state.checkAchievements();
    expect(state.getUnlockedAchievementCount()).toBe(1);
  });
});
