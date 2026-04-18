import { Page, expect } from '@playwright/test';

/**
 * Shared Playwright helpers for the end-to-end gameplay specs.
 *
 * Kept intentionally thin: every helper here is used by at least two specs,
 * and the types mirror only the fragments of the Phaser API the tests poke at
 * through `window.__game` (the dev-only global the app exposes).
 */

export const SCREENSHOT_DIR = 'tests/screenshots';

export interface PhaserSceneLike {
  sys: { settings: { key: string } };
}

export interface PhaserLike {
  scene: {
    getScenes: (active?: boolean) => PhaserSceneLike[];
    isActive: (key: string) => boolean;
    start: (key: string) => void;
  };
}

declare global {
  interface Window {
    __game?: PhaserLike;
  }
}

/** Wait until the Phaser game instance has been attached to `window.__game`. */
export async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__game, undefined, { timeout: 30_000 });
  // Ensure the game canvas has focus so keyboard input reaches Phaser.
  await page.locator('canvas').first().click({ position: { x: 10, y: 10 } });
}

/** Wait until a specific Phaser scene is active (its `create()` has run). */
export async function waitForScene(page: Page, sceneKey: string): Promise<void> {
  await page.waitForFunction(
    (key) => !!window.__game && window.__game.scene.isActive(key),
    sceneKey,
    { timeout: 30_000 },
  );
  // Give Phaser a few frames to finish fading in / rendering.
  await page.waitForTimeout(800);
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
    };
    try {
      window.localStorage.setItem('architect_default_v1', JSON.stringify(save));
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
    // eslint-disable-next-line no-console
    console.error('[page error]', msg);
    if (!isIgnorable(msg)) errors.push(`[pageerror] ${msg}`);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // eslint-disable-next-line no-console
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
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* noop */ }
  });
}
