import { setVirtualButton } from '../input';
import type { GameAction } from '../input';
import { showTouchHintIfNeeded, showTouchHintForced } from './TouchHintOverlay';
export { isTouchPrimary } from './touchPrimary';
import { isTouchPrimary } from './touchPrimary';
import { eventBus } from '../systems/EventBus';
import { settingsStore } from '../systems/SettingsStore';

/**
 * Session flag: at least one `touchstart` event was observed on `window`
 * during this page session. Set by `registerReactiveDetection()` and read
 * by `applyVirtualGamepadVisibility()` so the `auto` mode can activate the
 * pad for hybrid devices that weren't detected as touch-primary at boot.
 */
let reactiveDetected = false;

/** Reset the session flag — test seam only. */
export function _resetReactiveDetected(): void {
  reactiveDetected = false;
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
 * Build and append a fresh `#virtual-pad` element to `document.body`.
 * Wires touchstart/touchend/touchcancel handlers on every button.
 */
function buildPad(): HTMLElement {
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

  // Apply high-contrast controls CSS class if the player has enabled it.
  pad.classList.toggle('vpad-high-contrast', settingsStore.read().highContrastControls);

  pad.querySelectorAll('.vpad-btn').forEach((btn) => {
    btn.addEventListener('touchstart', onTouchStart as EventListener, { passive: false });
    btn.addEventListener('touchend', onTouchEnd as EventListener, { passive: false });
    btn.addEventListener('touchcancel', onTouchEnd as EventListener, { passive: false });
  });

  return pad;
}

/**
 * Returns `true` when the Phaser game is running a gameplay scene (a level,
 * boss arena, product room, etc.) rather than an infrastructure scene (menu,
 * settings, elevator). Used to gate the mid-session hint re-show so the hint
 * doesn't pop up while the player is navigating menus.
 *
 * Inspects `window.__game` (exposed by `main.ts`) when available; returns
 * `false` in environments where the game hasn't bootstrapped yet (e.g. unit
 * tests without Phaser).
 */
function isInLevelScene(): boolean {
  const NON_LEVEL_SCENES = new Set([
    'BootScene', 'MenuScene', 'SettingsScene', 'ControlsScene',
    'PauseScene', 'SaveSlotScene', 'ElevatorScene',
  ]);
  try {
    type PhaserGame = {
      scene?: {
        getScenes?: (active: boolean) => Array<{ sys?: { settings?: { key?: string } } }>;
      };
    };
    const w = window as Window & { __game?: PhaserGame };
    const activeScenes = w.__game?.scene?.getScenes?.(true) ?? [];
    return activeScenes.some((s) => {
      const key = s.sys?.settings?.key ?? '';
      return key !== '' && !NON_LEVEL_SCENES.has(key);
    });
  } catch {
    return false;
  }
}

/**
 * Read the current `onScreenControls` setting and `isTouchPrimary()` / session
 * flag, then show or hide `#virtual-pad` accordingly.
 *
 * - `'always'`  → always visible.
 * - `'never'`   → always hidden.
 * - `'auto'`    → visible when `isTouchPrimary()` at boot OR `reactiveDetected`
 *                 (first `touchstart` seen this session).
 *
 * When the pad transitions from hidden to visible, the appropriate hint is shown:
 * - Reactive mid-session detection in a level scene → `showTouchHintForced`
 *   (does not update the hasSeen flag).
 * - Explicit `'always'` selection on a non-touch device → `showTouchHintForced`
 *   (informs the user what the buttons do without touching the hasSeen flag).
 * - Normal touch-primary boot → `showTouchHintIfNeeded` (respects hasSeen).
 */
export function applyVirtualGamepadVisibility(): void {
  const { onScreenControls } = settingsStore.read();
  const shouldShow =
    onScreenControls === 'always' ||
    (onScreenControls === 'auto' && (isTouchPrimary() || reactiveDetected));

  let pad = document.getElementById('virtual-pad') as HTMLElement | null;

  if (shouldShow) {
    if (!pad) {
      pad = buildPad();
    }
    const wasHidden = !pad.classList.contains('active');
    pad.classList.add('active');
    // Keep high-contrast class in sync even if the pad was already mounted.
    pad.classList.toggle('vpad-high-contrast', settingsStore.read().highContrastControls);

    if (wasHidden) {
      if (reactiveDetected && isInLevelScene()) {
        // Mid-session touch detected while playing: re-show hint without
        // overwriting the hasSeen flag.
        showTouchHintForced(pad);
      } else if (onScreenControls === 'always' && !isTouchPrimary() && !reactiveDetected) {
        // User explicitly enabled the pad on a non-touch device from Settings:
        // pop the hint so they know what the buttons do.
        showTouchHintForced(pad);
      } else {
        // Normal touch-primary device at boot.
        showTouchHintIfNeeded(pad);
      }
    }
  } else if (pad) {
    pad.classList.remove('active');
  }
}

/**
 * Register a one-shot `touchstart` listener on `window` that activates the
 * virtual pad when a touch is first detected during the session. Safe to call
 * multiple times — the session flag prevents double-activation.
 *
 * Separated from `initVirtualGamepad` so tests can call it independently.
 */
export function registerReactiveDetection(): void {
  if (reactiveDetected) return;
  window.addEventListener(
    'touchstart',
    () => {
      if (reactiveDetected) return;
      reactiveDetected = true;
      eventBus.emit('input:touch_detected');
      applyVirtualGamepadVisibility();
    },
    { once: true, passive: true },
  );
}

/**
 * Initialise the virtual gamepad subsystem.
 *
 * - Registers a one-shot `touchstart` listener for reactive hybrid-device
 *   detection.
 * - Subscribes to `settings:changed` so visibility updates immediately when
 *   the user changes `onScreenControls` in Settings.
 * - Applies initial visibility based on the current setting + boot-time
 *   touch detection.
 *
 * Called once at app bootstrap from `main.ts`. Safe to call again (HMR /
 * repeated boot) — `buildPad()` is guarded by an id check.
 */
export function initVirtualGamepad(): void {
  registerReactiveDetection();

  // Re-apply visibility whenever any non-audio setting changes (the handler
  // is idempotent — it only does work when onScreenControls actually matters).
  eventBus.on('settings:changed', applyVirtualGamepadVisibility);

  applyVirtualGamepadVisibility();
}

/**
 * Update the high-contrast CSS class on the mounted virtual pad immediately.
 * Call this whenever the "HIGH CONTRAST CONTROLS" setting changes so the pad
 * reflects the new value without requiring a page reload or re-init.
 * No-op when the pad is not mounted (e.g. on desktop).
 */
export function updateVirtualGamepadContrast(enabled: boolean): void {
  const pad = document.getElementById('virtual-pad');
  if (!pad) return;
  pad.classList.toggle('vpad-high-contrast', enabled);
}
