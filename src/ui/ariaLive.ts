/**
 * ARIA live-region bridge.
 *
 * `announce(message)` writes a human-readable message to the off-screen
 * `#game-aria-live` live region so assistive technologies (VoiceOver, NVDA)
 * read it out without moving focus.
 *
 * `initAriaLive()` subscribes to the EventBus events that should be
 * announced (quiz results, floor unlocks, floor entry, objectives, checkpoints,
 * caffeine buffs, AU milestones). Call it once
 * at game startup.
 */

import { eventBus, type GameEventName, type GameEventHandler } from '../systems/EventBus';
import { LEVEL_DATA } from '../config/levelData';

const REGION_ID = 'game-aria-live';

/** Pending timer id — cancelled before each new announcement so only the latest fires. */
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Cleanup callbacks for the active set of aria-live EventBus subscriptions. */
let ariaHandlers: Array<() => void> | null = null;

/**
 * Write `message` to the ARIA live region.
 *
 * To force the assistive technology to re-announce a message that is
 * identical to the previous one, the element is briefly cleared before the
 * new text is set (with a 50 ms gap for the DOM mutation to flush).
 *
 * Any previously scheduled write is cancelled so rapid back-to-back calls
 * don't let an older message overwrite a newer one.
 */
export function announce(message: string): void {
  const el = document.getElementById(REGION_ID);
  if (!el) return;
  // Cancel any previously scheduled write so only the latest message lands.
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  // Clear first to force re-announcement if the same text is repeated.
  el.textContent = '';
  // Small delay so the browser registers two distinct mutations.
  pendingTimer = setTimeout(() => {
    el.textContent = message;
    pendingTimer = null;
  }, 50);
}

/**
 * Subscribe to game events that warrant screen-reader announcements.
 * Intended to be called once from `main.ts` after the game is created.
 * Idempotent: calling it a second time replaces the previous subscriptions
 * with a fresh set (no duplicate handlers).
 */
export function initAriaLive(): void {
  // Deregister any handlers from a previous call before re-subscribing so
  // duplicate invocations never accumulate extra listeners.
  if (ariaHandlers) {
    for (const off of ariaHandlers) off();
  }
  ariaHandlers = [];

  const sub = <K extends GameEventName>(event: K, fn: GameEventHandler<K>): void => {
    eventBus.on(event, fn);
    ariaHandlers!.push(() => eventBus.off(event, fn));
  };

  sub('sfx:quiz_success', () => {
    announce('Quiz passed!');
  });

  sub('sfx:quiz_fail', () => {
    announce('Quiz failed. Read the info text and try again.');
  });

  sub('quiz:cooldown_expired', () => {
    announce('Quiz unlocked. You can retry now.');
  });

  sub('progression:floor_unlocked', (floorId) => {
    // Direct index — LEVEL_DATA is keyed by FloorId so this is O(1).
    // The fallback is a belt-and-suspenders guard against future misconfig.
    const entry = LEVEL_DATA[floorId];
    const name = entry?.name ?? 'a new floor';
    announce(`${name} unlocked!`);
  });

  sub('progression:au_milestone', (total) => {
    announce(`${total} Architecture Units collected.`);
  });

  sub('scene:floor-entered', ({ displayName, objective }) => {
    announce(objective.trim().length > 0 ? `Entered ${displayName}. ${objective}` : `Entered ${displayName}.`);
  });

  sub('objective:updated', ({ text }) => {
    announce(text);
  });

  sub('checkpoint:reached', ({ index, total }) => {
    announce(`Checkpoint ${index} of ${total} reached.`);
  });

  sub('buff:caffeine-applied', () => {
    announce('Caffeine buff active.');
  });
}
