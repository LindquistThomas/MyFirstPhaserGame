/**
 * First-run virtual-gamepad hint overlay.
 *
 * On the very first touch-primary session a brief DOM overlay is shown above
 * `#virtual-pad` with the text "Use the buttons below to move and jump."
 * The D-pad and the A (Jump) button are pulsed to draw the player's eye.
 *
 * The overlay dismisses when the player presses any virtual-pad button or
 * after {@link HINT_DURATION_MS} milliseconds, whichever comes first.
 *
 * A flag is persisted in localStorage (`architect_touch_hint_seen_v1`) so
 * the hint only appears once. Calling `clearSeen()` on `TouchHintStore`
 * (done by `GameStateManager.resetAll()`) resets the flag so new
 * playthroughs get the hint again.
 *
 * Implementation is intentionally Phaser-free so it works independently of
 * scene lifecycle and scene transitions.
 */

import { isTouchPrimary } from './touchPrimary';
import * as TouchHintStore from '../systems/TouchHintStore';

const HINT_DURATION_MS = 6_000;

const PULSE_CLASS = 'vpad-hint-pulse';
const OVERLAY_ID = 'touch-hint-overlay';

/**
 * Internal: mount and manage the hint overlay DOM, attaching dismissal logic.
 *
 * @param padEl      The mounted `#virtual-pad` element.
 * @param markOnDismiss  When true, `TouchHintStore.markSeen()` is called on
 *                       dismiss so the hint won't appear again in future
 *                       sessions. Pass `false` for mid-session re-shows that
 *                       should not overwrite the persisted flag.
 */
function mountHintOverlay(padEl: HTMLElement, markOnDismiss: boolean): void {
  // Guard against double-mount (e.g. HMR or repeated calls).
  if (document.getElementById(OVERLAY_ID)) return;

  // --- build overlay ---------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('role', 'status');

  const msg = document.createElement('p');
  msg.id = 'touch-hint-message';
  msg.textContent = 'Use the buttons below to move and jump.';
  overlay.appendChild(msg);

  document.body.appendChild(overlay);

  // --- pulse the D-pad and the A (Jump) button --------------------------------
  const dpad = padEl.querySelector<HTMLElement>('.vpad-dpad');
  const jumpBtn = padEl.querySelector<HTMLElement>('[data-actions~="Jump"]');
  const pulsed: Element[] = [];

  if (dpad) { dpad.classList.add(PULSE_CLASS); pulsed.push(dpad); }
  if (jumpBtn) { jumpBtn.classList.add(PULSE_CLASS); pulsed.push(jumpBtn); }

  // --- dismissal logic -------------------------------------------------------
  let dismissed = false;
  // Declared as null before dismiss() so there is no temporal dead zone when
  // dismiss() calls clearTimeout(timer) — even though the sync execution order
  // means timer is always assigned before dismiss() can ever be invoked.
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Single delegated touchstart handler on the pad element; stored so dismiss()
  // can remove it even when the timeout fires (not triggered by a button press).
  let onPadTouch: ((e: Event) => void) | null = null;

  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    // Cancel the auto-dismiss timer so it doesn't double-fire.
    if (timer !== null) { clearTimeout(timer); timer = null; }
    // Remove the delegated listener so it doesn't linger after the timeout path.
    if (onPadTouch !== null) {
      padEl.removeEventListener('touchstart', onPadTouch);
      onPadTouch = null;
    }

    // Mark seen before removing DOM so repeated rapid taps can't re-trigger.
    if (markOnDismiss) TouchHintStore.markSeen();

    overlay.classList.add('touch-hint-fadeout');

    const afterFade = (): void => {
      overlay.remove();
    };
    overlay.addEventListener('animationend', afterFade, { once: true });
    // Fallback: remove immediately if the animation never fires (e.g. jsdom).
    setTimeout(() => { if (overlay.isConnected) overlay.remove(); }, 600);

    for (const el of pulsed) el.classList.remove(PULSE_CLASS);
  };

  // Single delegated touchstart listener — one handler covers all buttons and
  // is removed in dismiss() so it never lingers after the overlay is gone.
  onPadTouch = (e: Event): void => {
    if ((e.target as Element | null)?.closest('.vpad-btn')) dismiss();
  };
  padEl.addEventListener('touchstart', onPadTouch, { passive: true });

  // Auto-dismiss after HINT_DURATION_MS.
  timer = setTimeout(dismiss, HINT_DURATION_MS);
}

/**
 * Show the first-run hint overlay if:
 *  - `isTouchPrimary()` is true, AND
 *  - the hint has not yet been seen (flag not set in localStorage).
 *
 * On dismiss, `TouchHintStore.markSeen()` is called so the hint won't
 * appear again in future sessions.
 *
 * @param padEl  The mounted `#virtual-pad` element.  Pulse classes are added
 *               to buttons inside it; the overlay is appended to `document.body`.
 */
export function showTouchHintIfNeeded(padEl: HTMLElement): void {
  if (!isTouchPrimary()) return;
  if (TouchHintStore.hasSeen()) return;
  mountHintOverlay(padEl, true);
}

/**
 * Show the hint overlay unconditionally, bypassing `isTouchPrimary()` and
 * `hasSeen()` checks.
 *
 * Does **not** update `TouchHintStore.hasSeen()` on dismiss — use this for
 * mid-session re-shows (e.g. reactive touch detection while in a level scene,
 * or when the user explicitly enables the pad from Settings on a non-touch
 * device) where the persisted flag must not be overwritten.
 *
 * @param padEl  The mounted `#virtual-pad` element.
 */
export function showTouchHintForced(padEl: HTMLElement): void {
  mountHintOverlay(padEl, false);
}
