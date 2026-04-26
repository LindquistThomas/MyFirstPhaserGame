import { setVirtualButton } from '../input';
import type { GameAction } from '../input';
import { showTouchHintIfNeeded } from './TouchHintOverlay';

/**
 * Returns `true` when the current device is touch-primary (i.e. a phone or
 * tablet with no precision pointer). The result can be overridden by the user
 * via `localStorage` under the key `architect_touch_override_v1`:
 *   - `"true"`  → always show the virtual pad
 *   - `"false"` → never show the virtual pad
 */
export function isTouchPrimary(): boolean {
  const override = localStorage.getItem('architect_touch_override_v1');
  if (override === 'true') return true;
  if (override === 'false') return false;
  return 'ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches;
}

/**
 * Space-separated list of `GameAction` names stored on a button element.
 * All listed actions are set together when the button is pressed/released.
 */
function actionsOf(el: Element): GameAction[] {
  const raw = el.getAttribute('data-actions') ?? '';
  return raw.split(' ').filter(Boolean) as GameAction[];
}

function onTouchStart(e: TouchEvent): void {
  e.preventDefault();
  const btn = e.currentTarget as Element;
  for (const action of actionsOf(btn)) {
    setVirtualButton(action, true);
  }
}

function onTouchEnd(e: TouchEvent): void {
  e.preventDefault();
  const btn = e.currentTarget as Element;
  for (const action of actionsOf(btn)) {
    setVirtualButton(action, false);
  }
}

/**
 * Create and mount the on-screen virtual gamepad overlay.
 *
 * Does nothing when `isTouchPrimary()` returns `false`, so desktop players
 * are never affected. The pad is a DOM element rendered above `#game-container`
 * with `pointer-events: none` on the wrapper and `pointer-events: auto` on the
 * individual buttons so the Phaser canvas remains fully interactive.
 *
 * Button → action mapping:
 *   ▲ / ▼  → MoveUp / MoveDown  +  NavigateUp / NavigateDown  (context-filtered)
 *   ◀ / ▶  → MoveLeft / MoveRight  +  NavigateLeft / NavigateRight
 *   A       → Jump
 *   B       → Interact  +  Confirm  (context-filtered — only one fires at a time)
 */
export function initVirtualGamepad(): void {
  if (!isTouchPrimary()) return;

  const existingPad = document.getElementById('virtual-pad');
  if (existingPad) {
    // Already mounted (e.g. HMR or repeated init); just ensure it is visible.
    existingPad.classList.add('active');
    return;
  }

  const pad = document.createElement('div');
  pad.id = 'virtual-pad';
  pad.setAttribute('aria-hidden', 'true');

  pad.innerHTML = `
    <div class="vpad-cluster vpad-cluster--left">
      <div class="vpad-dpad">
        <div class="vpad-dpad-row vpad-dpad-row--top">
          <button class="vpad-btn" data-actions="MoveUp NavigateUp" aria-label="Up">▲</button>
        </div>
        <div class="vpad-dpad-row vpad-dpad-row--middle">
          <button class="vpad-btn" data-actions="MoveLeft NavigateLeft" aria-label="Left">◀</button>
          <div class="vpad-dpad-center"></div>
          <button class="vpad-btn" data-actions="MoveRight NavigateRight" aria-label="Right">▶</button>
        </div>
        <div class="vpad-dpad-row vpad-dpad-row--bottom">
          <button class="vpad-btn" data-actions="MoveDown NavigateDown" aria-label="Down">▼</button>
        </div>
      </div>
    </div>
    <div class="vpad-cluster vpad-cluster--right">
      <div class="vpad-actions">
        <button class="vpad-btn vpad-btn--action" data-actions="Jump" aria-label="Jump">A</button>
        <button class="vpad-btn vpad-btn--action" data-actions="Interact Confirm" aria-label="OK">B</button>
      </div>
    </div>
  `;

  document.body.appendChild(pad);

  // Make the pad visible (CSS default is display:none until .active is added).
  pad.classList.add('active');

  // Wire every button to the virtual button API.
  pad.querySelectorAll('.vpad-btn').forEach((btn) => {
    btn.addEventListener('touchstart', onTouchStart as EventListener, { passive: false });
    btn.addEventListener('touchend', onTouchEnd as EventListener, { passive: false });
    btn.addEventListener('touchcancel', onTouchEnd as EventListener, { passive: false });
  });

  // Show the first-run hint overlay on the initial touch-primary session.
  showTouchHintIfNeeded(pad);
}
