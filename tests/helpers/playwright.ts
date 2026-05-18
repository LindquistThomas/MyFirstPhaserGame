import { Page, expect } from '@playwright/test';

/**
 * Shared Playwright helpers for the end-to-end gameplay specs.
 *
 * Kept intentionally thin: every helper here is used by at least two specs,
 * and the types mirror only the fragments of the Phaser API the tests poke at
 * through `window.__game` (the dev-only global the app exposes).
 */

export interface PhaserSceneLike {
  sys: {
    settings: { key: string; status?: number };
    // `game.loop.frame` is Phaser's own rAF counter — it increments once per
    // committed frame while the loop is running. `waitForScene` uses it to
    // prove the Phaser loop (not just the browser rAF) has advanced.
    game?: { loop?: { frame?: number } };
  };
}

export interface PhaserLike {
  scene: {
    getScenes: (active?: boolean) => PhaserSceneLike[];
    isActive: (key: string) => boolean;
    start: (key: string) => void;
  };
}

/**
 * Phaser's Scenes.RUNNING status value. Used by `waitForScene` below to
 * detect that a scene's `create()` has fully finished, rather than just
 * that it became active — a scene can be active while still CREATING.
 *
 * Values (from Phaser source):
 *   PENDING=0, INIT=1, START=2, LOADING=3, CREATING=4, RUNNING=5,
 *   PAUSED=6, SLEEPING=7, SHUTDOWN=8, DESTROYED=9.
 */
const SCENE_STATUS_RUNNING = 5;
const STORAGE_CLEARED_SENTINEL = '__architect_test_storage_cleared__';

declare global {
  interface Window {
    __game?: PhaserLike;
  }
}

/** Wait until the Phaser game instance has been attached to `window.__game`. */
export async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__game, undefined, { timeout: 30_000 });
  // Ensure the game canvas has focus so keyboard input reaches Phaser.
  // Target the canvas inside #game-container explicitly — the first <canvas>
  // in the DOM is the pillarbox backdrop (pointer-events: none, z-index: 0)
  // and clicks on it get intercepted by <html> instead of reaching Phaser.
  await page.locator('#game-container canvas').first().click({ position: { x: 10, y: 10 } });
}

/** Wait until a specific Phaser scene is active (its `create()` has run). */
export async function waitForScene(page: Page, sceneKey: string): Promise<void> {
  // Poll until the scene has reached the RUNNING status — that is, its
  // `create()` method has completed. This replaces a prior fixed 800ms
  // sleep which was conservative on slow CI but wasted time everywhere.
  await page.waitForFunction(
    ({ key, running }) => {
      const g = window.__game;
      if (!g || !g.scene.isActive(key)) return false;
      const scene = g.scene.getScenes(true).find((s) => s.sys.settings.key === key);
      return !!scene && scene.sys.settings.status === running;
    },
    { key: sceneKey, running: SCENE_STATUS_RUNNING },
    { timeout: 30_000 },
  );
  // Wait for Phaser's own loop to advance by at least two frames after the
  // scene reached RUNNING. This is strictly better than a raw `rAF` promise
  // inside `page.evaluate`: the promise has no timeout, so under CPU
  // starvation (noisy CI runner) it can sit until the 60s test timeout
  // fires — surfacing as an unreadable "page.evaluate timed out".
  // `waitForFunction` here is bounded at 5s and reads `game.loop.frame`,
  // which is Phaser's committed-frame counter, so a stalled game loop shows
  // up as a clear error rather than a mystery timeout.
  await page.waitForFunction(
    (key) => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene.getScenes(true).find((s) => s.sys.settings.key === key);
      const frame = scene?.sys.game?.loop?.frame;
      if (typeof frame !== 'number') return false;
      const w = window as unknown as { __sceneBaseFrame?: Record<string, number> };
      w.__sceneBaseFrame ??= {};
      const base = w.__sceneBaseFrame[key];
      if (base === undefined) {
        w.__sceneBaseFrame[key] = frame;
        return false;
      }
      if (frame - base >= 2) {
        delete w.__sceneBaseFrame[key];
        return true;
      }
      return false;
    },
    sceneKey,
    { timeout: 5_000 },
  );
}

/**
 * Wait until the DialogController on the given scene reports `isOpen`.
 * Scenes expose their DialogController on the (TS-private) `dialogs`
 * property; opening a dialog is async-ish (sets the flag on the next
 * tick), so tests previously waited a fixed 200–500ms. This is the
 * deterministic replacement.
 */
export async function waitForDialogOpen(page: Page, sceneKey: string): Promise<void> {
  await page.waitForFunction(
    (key) => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === key) as unknown as Record<string, unknown>;
      if (!scene) return false;
      const dialogs = scene['dialogs'] as { isOpen: boolean } | undefined;
      return !!dialogs && dialogs.isOpen === true;
    },
    sceneKey,
    { timeout: 15_000 },
  );
}

/** Inverse of `waitForDialogOpen`: wait until `dialogs.isOpen` is false. */
export async function waitForDialogClosed(page: Page, sceneKey: string): Promise<void> {
  await page.waitForFunction(
    (key) => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === key) as unknown as Record<string, unknown>;
      if (!scene) return false;
      const dialogs = scene['dialogs'] as { isOpen: boolean } | undefined;
      return !!dialogs && dialogs.isOpen === false;
    },
    sceneKey,
    { timeout: 15_000 },
  );
}

export interface SeedSaveOptions {
  /** Override `totalAU`. Per-floor AU is auto-distributed if not provided. */
  totalAU?: number;
  /** Override `floorAU` explicitly. When omitted, a sensible default is used. */
  floorAU?: Record<number, number>;
}

/**
 * Pre-populate a save slot so floors unlock without having to grind tokens,
 * and mark the elevator info point as already seen so it doesn't pop a
 * dialog on first ride (which would block keyboard input in tests).
 *
 * Pass `options` to tailor the seeded AU values — e.g. `{ totalAU: 0 }` for
 * tests that want to observe AU increasing from zero.
 *
 * Writes directly to `architect_slot1_v1` (the default active slot set by
 * `BootScene`) so the save is immediately visible in `SaveSlotScene` without
 * relying on the legacy-slot migration path.
 */
export async function seedFullProgressSave(
  page: Page,
  options: SeedSaveOptions = {},
): Promise<void> {
  const totalAU = options.totalAU ?? 50;
  const floorAU = options.floorAU ?? { 0: 0, 1: totalAU === 50 ? 25 : 0 };
  await page.addInitScript((payload) => {
    const save = {
      totalAU: payload.totalAU,
      floorAU: payload.floorAU,
      unlockedFloors: [0, 1],
      currentFloor: 0,
      collectedTokens: { 0: [], 1: [] },
      // Mark onboarding complete so WelcomeModal doesn't block keyboard input
      // in tests that interact with the ElevatorScene or floor scenes.
      onboardingComplete: true,
    };
    try {
      window.localStorage.setItem('architect_slot1_v1', JSON.stringify(save));
      window.localStorage.setItem(
        'architect_info_seen_v1',
        JSON.stringify(['architecture-elevator']),
      );
    } catch {
      /* localStorage blocked — ignore */
    }
  }, { totalAU, floorAU });
}

/**
 * Navigate from `MenuScene` through the `SaveSlotScene` slot picker to
 * `ElevatorScene`. This replaces the old single-Enter pattern which
 * worked when `MenuScene` started the elevator directly; now there is an
 * intermediate slot-picker step.
 *
 * Assumes the caller has already waited for `MenuScene` to be active.
 * Selects slot 1 (the first / default slot) via Enter.
 */
export async function navigateToElevator(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
  await waitForScene(page, 'SaveSlotScene');
  await page.keyboard.press('Enter');
  const actionPickerOpened = await page
    .waitForFunction(() => {
      const g = window.__game;
      if (!g) return false;
      const saveSlotScene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'SaveSlotScene') as unknown as
          | { ['inActionSelect']?: boolean }
          | undefined;
      return saveSlotScene?.['inActionSelect'] === true;
    }, undefined, { timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (actionPickerOpened) {
    await page.keyboard.press('Enter');
  }
  await waitForScene(page, 'ElevatorScene');
}

/**
 * Error-watcher handle.
 *
 * `assertClean()` asserts no gameplay-visible errors leaked from the page.
 * Tests call it (typically in `afterEach`) so any uncaught Phaser error
 * surfaces as a test failure instead of a silent log line.
 */
export interface ErrorWatcher {
  assertClean(): void;
}

// Known-benign patterns we deliberately ignore.
// Add entries here only with a justification — these suppressions apply
// globally across every spec.
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  // Vite/dev websocket chatter that appears during teardown.
  /\bWebSocket\b.*closed/i,
  // Chromium occasionally logs a ResizeObserver notice that is not a real bug.
  /ResizeObserver loop/i,
];

function isIgnorable(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * Attach pageerror + console listeners to `page` and return a handle whose
 * `assertClean()` fails the test if any uncaught error was observed.
 *
 * The listeners also mirror errors to the Playwright stdout so failing
 * tests are easy to diagnose.
 */
export function attachErrorWatchers(page: Page): ErrorWatcher {
  const errors: string[] = [];

  page.on('pageerror', (err) => {
    const msg = err.message;
    console.error('[page error]', msg);
    if (!isIgnorable(msg)) errors.push(`[pageerror] ${msg}`);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    console.error('[console]', text);
    if (!isIgnorable(text)) errors.push(`[console] ${text}`);
  });

  return {
    assertClean() {
      expect(errors, `Uncaught errors during test:\n${errors.join('\n')}`).toEqual([]);
    },
  };
}

/** Clear localStorage before the app boots so each test starts clean. */
export async function clearStorage(page: Page): Promise<void> {
  await page.addInitScript((sentinel) => {
    try {
      if (window.sessionStorage.getItem(sentinel) === 'true') return;
      window.localStorage.clear();
      window.sessionStorage.setItem(sentinel, 'true');
    } catch { /* noop */ }
  }, STORAGE_CLEARED_SENTINEL);
}
