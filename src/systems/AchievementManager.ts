/**
 * Achievement state persistence — tracks which achievements have been unlocked.
 *
 * Backed by the shared `PersistedStore<T>` factory; see PersistedStore.ts.
 * Storage key: `architect_achievements_v1`.
 */

import type { KVStorage } from './SaveManager';
import { createPersistedStore } from './PersistedStore';
import type { AchievementId } from '../config/achievements';

const STORAGE_KEY = 'architect_achievements_v1';

const store = createPersistedStore<AchievementId[]>({
  key: STORAGE_KEY,
  defaultValue: () => [],
  parse: (raw) => (
    Array.isArray(raw)
      ? raw.filter((x): x is AchievementId => typeof x === 'string')
      : []
  ),
});

export function setStorage(s: KVStorage): void { store.setStorage(s); }

export function isUnlocked(id: AchievementId): boolean {
  return store.read().includes(id);
}

/**
 * Mark an achievement as unlocked.
 * Returns `true` if this was a new unlock, `false` if already unlocked.
 */
export function unlock(id: AchievementId): boolean {
  const current = store.read();
  if (current.includes(id)) return false;
  store.write([...current, id]);
  return true;
}

/** All currently unlocked achievement ids. */
export function getUnlocked(): AchievementId[] {
  return store.read();
}

/** Number of unlocked achievements. */
export function getUnlockedCount(): number {
  return store.read().length;
}

export function resetAll(): void {
  store.clear();
}
