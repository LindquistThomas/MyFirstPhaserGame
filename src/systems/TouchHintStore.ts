/**
 * Persistent flag that tracks whether the virtual-gamepad first-run hint has
 * been shown to this user.
 *
 * Storage key: `architect_touch_hint_seen_v1`.
 * Reset via `clearSeen()` when the player resets their progress so the hint
 * appears again for the next new playthrough.
 */

import { createPersistedStore } from './PersistedStore';
import type { KVStorage } from './SaveManager';

const STORAGE_KEY = 'architect_touch_hint_seen_v1';

const store = createPersistedStore<boolean>({
  key: STORAGE_KEY,
  defaultValue: () => false,
  parse: (raw) => raw === true,
});

/** Test seam — replace the underlying storage and invalidate the cache. */
export function setStorage(s: KVStorage): void {
  store.setStorage(s);
}

/** Returns `true` when the hint has already been shown in a prior session. */
export function hasSeen(): boolean {
  return store.read();
}

/** Marks the hint as seen so it won't appear again. */
export function markSeen(): void {
  store.write(true);
}

/**
 * Clears the seen flag so the hint will appear again on the next touch-primary
 * session.  Called from `GameStateManager.resetAll()` when the player resets
 * progress, ensuring fresh playthroughs start with the hint.
 */
export function clearSeen(): void {
  store.clear();
}
