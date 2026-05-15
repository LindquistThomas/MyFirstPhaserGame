import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';
import { Toast } from './Toast';

const DEBOUNCE_MS = 500;
const WARN_MESSAGE =
  'Some assets failed to load \u2014 game will continue with reduced fidelity';

/**
 * Count of static boot assets that failed to load, accumulated at module
 * import time via the `boot:asset-error` event.  Module-level so the count
 * is live before any scene is created.
 *
 * @internal Exported as a test seam — reset via `eventBus.emit('boot:reset')`
 * in production and via `_resetBootErrorCount()` in tests.
 */
export let _bootErrorCount = 0;

/** @internal Reset the pending error counter — use in tests only. */
export function _resetBootErrorCount(): void {
  _bootErrorCount = 0;
}

// These module-level subscriptions are intentionally never removed: the
// module is imported exactly once per application lifetime, and the EventBus
// singleton is co-located in the same bundle, so there is no leak risk.
eventBus.on('boot:reset', () => { _bootErrorCount = 0; });
eventBus.on('boot:asset-error', () => { _bootErrorCount++; });

/**
 * Mount an asset-error Toast observer onto `scene`.
 *
 * Call once from a long-lived scene's `create()` (e.g. `MenuScene`).
 *
 * - If any static boot assets failed before the scene was created, a Toast
 *   is scheduled immediately (after the 500 ms debounce window).
 * - Also subscribes to `music:load-error` for live lazy-music failures.
 * - Multiple errors within `DEBOUNCE_MS` are collapsed into a single Toast
 *   so the player sees one notification rather than a flood.
 *
 * The Toast and all subscriptions are torn down automatically on scene shutdown.
 */
export function mountBootErrorToast(scene: Phaser.Scene): void {
  const toast = new Toast(scene);

  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  let pendingInWindow = 0;

  const flush = (): void => {
    debounceHandle = null;
    if (pendingInWindow > 0) {
      toast.show(WARN_MESSAGE);
      pendingInWindow = 0;
    }
  };

  const schedule = (): void => {
    pendingInWindow++;
    if (debounceHandle !== null) return; // already counting down
    debounceHandle = setTimeout(flush, DEBOUNCE_MS);
  };

  // Consume any boot errors that accumulated before this scene was created.
  if (_bootErrorCount > 0) {
    _bootErrorCount = 0;
    schedule();
  }

  // Live subscription for lazy-music load failures.
  const onMusicError = (): void => schedule();
  eventBus.on('music:load-error', onMusicError);

  scene.events.once('shutdown', () => {
    eventBus.off('music:load-error', onMusicError);
    if (debounceHandle !== null) {
      clearTimeout(debounceHandle);
      debounceHandle = null;
    }
    toast.destroy();
  });
}
