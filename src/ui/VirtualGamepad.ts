import { setVirtualButton } from '../input';
import type { GameAction } from '../input';
import { showTouchHintIfNeeded, showTouchHintForced } from './TouchHintOverlay';
export { isTouchPrimary } from './touchPrimary';
import { isTouchPrimary } from './touchPrimary';
import { eventBus } from '../systems/EventBus';
import { settingsStore } from '../systems/SettingsStore';
import { isReducedMotion } from '../systems/MotionPreference';

/**
 * Session flag: at least one `touchstart` event was observed on `window`
 * during this page session. Set by `registerReactiveDetection()` and read
 * by `applyVirtualGamepadVisibility()` so the `auto` mode can activate the
 * pad for hybrid devices that weren't detected as touch-primary at boot.
 */
let reactiveDetected = false;

/**
 * Cached value of `settingsStore.hapticsEnabled`.
 * Initialised from the store in `applyVirtualGamepadVisibility()` (which
 * already reads settings) and kept in sync via the `settings:changed`
 * subscription registered in `initVirtualGamepad()`. Avoids a storage
 * read on every vpad `touchstart` event.
 */
let hapticsEnabled = true;

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
  if (hapticsEnabled && !isReducedMotion()) {
    navigator.vibrate?.(10);
  }
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

  // Apply high-contrast CSS class if the player has enabled it.
  pad.classList.toggle('vpad-high-contrast', settingsStore.read().highContrast);

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
  const settings = settingsStore.read();
  const { onScreenControls } = settings;
  // Keep haptics cache in sync — applyVirtualGamepadVisibility already reads
  // settings, so this is free and ensures the cache is always current.
  hapticsEnabled = settings.hapticsEnabled;

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
    pad.classList.toggle('vpad-high-contrast', settings.highContrast);

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
 * Module-level stable handler for the `settings:changed` EventBus event.
 *
 * Using a named module-level function (rather than an inline arrow) means
 * EventBus.on() adds the same reference to the Set on every call, so
 * repeated invocations of `initVirtualGamepad()` (HMR, test re-runs) are
 * idempotent — the Set deduplicates automatically.
 */
function _syncHighContrastToDocument(): void {
  applyHighContrastToDocument(settingsStore.read().highContrast);
}

/**
 * Named handler for `settings:changed` that refreshes the module-level
 * `hapticsEnabled` cache from the store. Registered once in
 * `initVirtualGamepad()` and idempotent across repeated calls (EventBus Set
 * deduplicates the same function reference).
 */
function _syncHapticsFromStore(): void {
  hapticsEnabled = settingsStore.read().hapticsEnabled;
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
  // Keep the document-level high-contrast attribute in sync with the setting.
  // Module-level named function so repeated initVirtualGamepad() calls (HMR /
  // test resets) add the same reference to the EventBus Set and stay idempotent.
  eventBus.on('settings:changed', _syncHighContrastToDocument);
  // Keep the haptics cache in sync with the persisted setting.
  eventBus.on('settings:changed', _syncHapticsFromStore);

  applyVirtualGamepadVisibility();
  // Apply high-contrast at startup so a persisted setting takes effect immediately.
  applyHighContrastToDocument(settingsStore.read().highContrast);
}

/**
 * Toggle the `data-high-contrast` attribute on `<html>` and the
 * `vpad-high-contrast` CSS class on `#virtual-pad`.
 *
 * Setting `data-high-contrast="true"` on the root element makes the CSS
 * in `index.html` apply to all HTML UI elements (virtual gamepad, touch
 * hint overlay, any future HTML overlays) rather than scoping the effect
 * to the virtual pad only.  Canvas-rendered elements (HUD, dialogs) listen
 * for the `settings:changed` EventBus event and re-render with appropriate
 * high-contrast colours when the setting changes.
 *
 * Called once at app startup (from `initVirtualGamepad`) and again whenever
 * the setting changes (from `SettingsScene`).
 */
export function applyHighContrastToDocument(enabled: boolean): void {
  if (enabled) {
    document.documentElement.dataset.highContrast = 'true';
  } else {
    delete document.documentElement.dataset.highContrast;
  }
  // Keep the virtual-pad class in sync too.
  const pad = document.getElementById('virtual-pad');
  if (pad) pad.classList.toggle('vpad-high-contrast', enabled);
}

/**
 * Update the high-contrast state on the virtual pad and the document root.
 * Call this whenever the "HIGH CONTRAST CONTROLS" setting changes so the pad
 * and all HTML UI elements (touch hint, any future HTML overlays) reflect the
 * new value without requiring a page reload.
 *
 * Delegates to {@link applyHighContrastToDocument} which also sets the
 * `data-high-contrast` attribute on `<html>` for CSS-level overrides.
 */
export function updateVirtualGamepadContrast(enabled: boolean): void {
  applyHighContrastToDocument(enabled);
}
