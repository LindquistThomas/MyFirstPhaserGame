import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager } from './GameStateManager';
import { setPlayerSlot, KVStorage } from './SaveManager';
import { FLOORS } from '../config/gameConfig';
import { QUIZ_PASS_THRESHOLD } from '../config/quiz';
import { saveQuizResult } from './QuizManager';

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
});
