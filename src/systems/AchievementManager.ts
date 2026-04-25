/**
 * Achievement state persistence and unlock checking.
 *
 * Backed by the shared `PersistedStore<T>` factory (same pattern as
 * QuizManager / InfoDialogManager). Persists a list of unlocked achievement
 * IDs and emits `achievement:unlocked` via the EventBus when a new one is
 * granted.
 *
 * Call `checkAll(state)` at any mutation point (token collect, quiz pass,
 * floor enter, info read). Newly unlocked achievements are stored and
 * broadcast; subsequent calls with the same state are no-ops.
 */

import type { KVStorage } from './SaveManager';
import { createPersistedStore } from './PersistedStore';
import { eventBus } from './EventBus';
import { ACHIEVEMENT_DEFS, type AchievementCheckState, type AchievementDef } from '../config/achievements';

const STORAGE_KEY = 'architect_achievements_v1';

const store = createPersistedStore<string[]>({
  key: STORAGE_KEY,
  defaultValue: () => [],
  parse: (raw) => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []),
});

export function setStorage(s: KVStorage): void { store.setStorage(s); }

/** Returns true if the achievement with the given id has been unlocked. */
export function isUnlocked(id: string): boolean {
  return store.read().includes(id);
}

/** Returns the ids of all unlocked achievements. */
export function getUnlockedIds(): string[] {
  return store.read();
}

/** Returns all achievement definitions in display order. */
export function getAllDefs(): AchievementDef[] {
  return ACHIEVEMENT_DEFS;
}

/**
 * Check every achievement against the supplied state snapshot.
 * Unlocks (and broadcasts) any achievement whose condition is newly met.
 * Already-unlocked achievements are skipped — this is safe to call often.
 */
export function checkAll(state: AchievementCheckState): void {
  for (const def of ACHIEVEMENT_DEFS) {
    if (!isUnlocked(def.id) && def.check(state)) {
      store.update((prev) => [...prev, def.id]);
      eventBus.emit('achievement:unlocked', def.id);
    }
  }
}

export function resetAll(): void {
  store.clear();
}
