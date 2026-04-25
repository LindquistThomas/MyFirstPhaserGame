/**
 * Reduced-motion preference helper.
 *
 * Reads `prefers-reduced-motion: reduce` from the system media query and
 * allows a user-level override persisted in localStorage. The override
 * takes precedence over the system preference so the game can expose a
 * "Reduce motion" toggle in Settings independently of the OS setting.
 *
 * Usage:
 *   import { isReducedMotion } from '../systems/MotionPreference';
 *   if (!isReducedMotion()) emitter.explode(10);
 */

import { createPersistedStore } from './PersistedStore';
import type { KVStorage } from './SaveManager';

const STORAGE_KEY = 'architect_reduce_motion_v1';

/**
 * Persisted user override.
 * `null`  = follow the system `prefers-reduced-motion` media query.
 * `true`  = always reduce motion (even if the system query is `no-preference`).
 * `false` = never reduce motion (even if the system query is `reduce`).
 */
const overrideStore = createPersistedStore<boolean | null>({
  key: STORAGE_KEY,
  defaultValue: () => null,
  parse: (raw) => {
    if (raw === true || raw === false) return raw;
    return null;
  },
  serialise: (v) => v,
});

/** Returns true when the system `prefers-reduced-motion: reduce` query matches. */
function systemPrefersReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Returns true when reduced motion is active.
 *
 * Priority: user override (if set) > system media query.
 */
export function isReducedMotion(): boolean {
  const override = overrideStore.read();
  if (override !== null) return override;
  return systemPrefersReduced();
}

/** Set a persistent user override. Pass `null` to revert to the system preference. */
export function setReducedMotionOverride(val: boolean | null): void {
  overrideStore.write(val);
}

/** Returns the current persistent user override (`null` = following system). */
export function getReducedMotionOverride(): boolean | null {
  return overrideStore.read();
}

/** Test seam — replace the underlying storage without touching localStorage. */
export function _setMotionStorageForTest(s: KVStorage): void {
  overrideStore.setStorage(s);
}
