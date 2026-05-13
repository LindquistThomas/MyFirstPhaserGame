export const TOUCH_PRIMARY_OVERRIDE_KEY = 'architect_touch_override_v1';
export const TOUCH_PRIMARY_OVERRIDE_CHANGED_EVENT = 'input:touch-override-changed';

export type TouchPrimaryOverride = boolean | null;

/** Read persisted touch-primary override (`true`, `false`, or unset). */
export function readTouchPrimaryOverride(): TouchPrimaryOverride {
  const override = localStorage.getItem(TOUCH_PRIMARY_OVERRIDE_KEY);
  if (override === 'true') return true;
  if (override === 'false') return false;
  return null;
}

/**
 * Persist touch-primary override and dispatch a same-tab change event.
 * `null` clears the override and returns to auto-detection.
 */
export function setTouchPrimaryOverride(override: TouchPrimaryOverride): void {
  if (override === null) {
    localStorage.removeItem(TOUCH_PRIMARY_OVERRIDE_KEY);
  } else {
    localStorage.setItem(TOUCH_PRIMARY_OVERRIDE_KEY, String(override));
  }
  window.dispatchEvent(new Event(TOUCH_PRIMARY_OVERRIDE_CHANGED_EVENT));
}

/**
 * Touch-primary detection helper.
 *
 * Extracted as its own module so both `VirtualGamepad` and `TouchHintOverlay`
 * can import it without creating a circular dependency.
 *
 * Returns `true` when the current device is touch-primary (i.e. a phone or
 * tablet with no precision pointer). The result can be overridden by the user
 * via `localStorage` under the key `architect_touch_override_v1`:
 *   - `"true"`  → always show the virtual pad
 *   - `"false"` → never show the virtual pad
 */
export function isTouchPrimary(): boolean {
  const override = readTouchPrimaryOverride();
  if (override !== null) return override;
  return 'ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches;
}
