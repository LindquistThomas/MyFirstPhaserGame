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

import { isTouchPrimary } from './VirtualGamepad';
import * as TouchHintStore from '../systems/TouchHintStore';

const HINT_DURATION_MS = 6_000;

const PULSE_CLASS = 'vpad-hint-pulse';
const OVERLAY_ID = 'touch-hint-overlay';

/**
 * Show the first-run hint overlay if:
 *  - `isTouchPrimary()` is true, AND
 *  - the hint has not yet been seen (flag not set in localStorage).
 *
 * @param padEl  The mounted `#virtual-pad` element.  Pulse classes are added
 *               to buttons inside it; the overlay is appended to `document.body`.
 */
export function showTouchHintIfNeeded(padEl: HTMLElement): void {
  if (!isTouchPrimary()) return;
  if (TouchHintStore.hasSeen()) return;
  // Guard against double-mount (e.g. HMR or repeated initVirtualGamepad).
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

  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;

    // Mark seen before removing DOM so repeated rapid taps can't re-trigger.
    TouchHintStore.markSeen();

    overlay.classList.add('touch-hint-fadeout');

    const afterFade = (): void => {
      overlay.remove();
    };
    overlay.addEventListener('animationend', afterFade, { once: true });
    // Fallback: remove immediately if the animation never fires (e.g. jsdom).
    setTimeout(() => { if (overlay.isConnected) overlay.remove(); }, 600);

    for (const el of pulsed) el.classList.remove(PULSE_CLASS);
  };

  // Dismiss on any virtual-pad button press.
  const onButtonTouch = (): void => dismiss();
  padEl.querySelectorAll('.vpad-btn').forEach((btn) => {
    btn.addEventListener('touchstart', onButtonTouch, { once: true, passive: true });
  });

  // Auto-dismiss after HINT_DURATION_MS.
  const timer = setTimeout(dismiss, HINT_DURATION_MS);

  // Clean up the timer if dismiss was triggered by a button press first.
  overlay.addEventListener('animationend', () => clearTimeout(timer), { once: true });
}
