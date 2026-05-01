import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * WCAG 2.1 AA colour-contrast and accessibility gate.
 *
 * Uses `@axe-core/playwright` to scan the HTML DOM at key game states.
 * Because the game renders almost entirely on a Phaser `<canvas>`, axe-core
 * cannot inspect in-canvas colours (HUD, dialogs, floor text). The scans
 * therefore focus on the HTML frame:
 *
 *  - Document structure (lang, title, landmarks).
 *  - The Phaser game canvas accessible name and keyboard-focus style.
 *  - The virtual D-pad buttons when visible.
 *  - The ARIA live region.
 *
 * Canvas-rendered colour contrast is verified indirectly: the
 * `highContrastControls` toggle is tested to confirm it applies the
 * `data-high-contrast="true"` attribute on `<html>`, which is the CSS hook
 * used by all HTML-layer UI elements.
 *
 * Rules intentionally disabled:
 *  - `color-contrast` — axe cannot read pixel data from a WebGL/2D canvas, so
 *    any "contrast" result it produces for the canvas element would be
 *    meaningless.  Colour contrast for canvas-rendered text (HUD, dialogs) is
 *    covered by the `highContrastControls` toggle and manual design review.
 */

async function runAxe(page: import('@playwright/test').Page): Promise<AxeResults> {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .disableRules(['color-contrast']) // canvas pixel data is opaque to axe
    .analyze();
}

test.describe('Accessibility — WCAG 2.1 AA (HTML layer)', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('MenuScene: zero WCAG violations', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    const results = await runAxe(page);
    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);

    errors.assertClean();
  });

  test('SettingsScene: zero WCAG violations', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    // Navigate to SettingsScene via Escape key (bound to Settings from MenuScene).
    await page.keyboard.press('Escape');
    await waitForScene(page, 'SettingsScene');

    const results = await runAxe(page);
    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);

    errors.assertClean();
  });

  test('Floor scene with HUD: zero WCAG violations', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);

    // Enter floor 1 (Platform Team) directly via the internal API.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    const results = await runAxe(page);
    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);

    errors.assertClean();
  });

  test('prefers-reduced-motion: zero WCAG violations', async ({ browser }) => {
    // Launch a new context with reduced-motion emulation.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = attachErrorWatchers(page);

    await clearStorage(page);
    await seedFullProgressSave(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    const results = await runAxe(page);
    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);

    errors.assertClean();
    await context.close();
  });

  test('highContrastControls: data-high-contrast attribute applied to <html>', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    // Seed highContrastControls=true in settings so that initVirtualGamepad()
    // reads it from SettingsStore at startup and calls
    // applyHighContrastToDocument(true) — the real runtime path.
    // This addInitScript runs after clearStorage + seedFullProgressSave (added
    // by beforeEach), so the save data is preserved and only the setting is added.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'architect_settings_v1',
          JSON.stringify({ highContrastControls: true }),
        );
      } catch { /* noop */ }
    });

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // The <html> element should carry data-high-contrast="true", applied by
    // applyHighContrastToDocument() inside initVirtualGamepad() at startup.
    await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');

    // Axe scan with high-contrast active — verifies no regressions when the
    // high-contrast CSS overrides are in effect.
    const results = await runAxe(page);
    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);

    errors.assertClean();
  });
});

/**
 * Format axe violations into a human-readable string for assertion failure
 * messages. Each violation includes id, impact, description, and the
 * offending node's HTML snippet so engineers can quickly locate the problem.
 */
function formatViolations(
  violations: AxeResults['violations'],
): string {
  if (violations.length === 0) return 'No violations';
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    ${n.html}`)
        .join('\n');
      return `[${v.impact ?? 'unknown'}] ${v.id}: ${v.description}\n${nodes}`;
    })
    .join('\n\n');
}
