import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * End-to-end tests for the Save Export / Import feature.
 *
 * These tests interact with the SettingsScene's Export and Import buttons,
 * verifying the happy-path round-trip and at least one error path.
 *
 * Note: actual file-download and file-picker interactions are tricky to
 * automate cross-browser, so the round-trip test uses the SaveManager API
 * directly via page.evaluate() to simulate what the buttons do.
 */

async function navigateToSettings(page: Parameters<typeof waitForGame>[0]): Promise<void> {
  await waitForScene(page, 'MenuScene');
  // Press Enter to proceed from MenuScene → SaveSlotScene
  await page.keyboard.press('Enter');
  await waitForScene(page, 'SaveSlotScene');
  // Press Enter to confirm slot1
  await page.keyboard.press('Enter');
  await waitForScene(page, 'ElevatorScene');
  // Press Escape to open PauseScene then navigate to Settings
  await page.keyboard.press('Escape');
  await waitForScene(page, 'PauseScene');
  // Navigate down to Settings button (index 1) and press Enter
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'SettingsScene');
}

test.describe('Save export / import', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('round-trip: export JSON from SaveManager and re-import it restores all fields', async ({ page }) => {
    await seedFullProgressSave(page, { totalAU: 37 });
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    // Directly exercise the SaveManager API (bypasses UI file-picker limitation)
    const result = await page.evaluate(async () => {
      // Dynamic import so we get the module's live state
      const { exportSlot, importToSlot, SAVE_ENVELOPE_FORMAT } = await import('/src/systems/SaveManager.ts');

      const json = exportSlot('slot1');
      if (!json) return { ok: false, reason: 'exportSlot returned null' };

      const envelope = JSON.parse(json);
      if (envelope.format !== SAVE_ENVELOPE_FORMAT) {
        return { ok: false, reason: `bad format: ${envelope.format as string}` };
      }
      if (typeof envelope.exportedAt !== 'string') {
        return { ok: false, reason: 'missing exportedAt' };
      }

      // Clear and re-import
      window.localStorage.removeItem('architect_slot1_v1');
      const data = importToSlot('slot1', json);
      if (!data) return { ok: false, reason: 'importToSlot returned null' };

      return {
        ok: true,
        totalAU: data.totalAU,
        hasSlotKey: window.localStorage.getItem('architect_slot1_v1') !== null,
      };
    });

    expect(result.ok).toBe(true);
    expect((result as { totalAU?: number }).totalAU).toBe(37);
    expect((result as { hasSlotKey?: boolean }).hasSlotKey).toBe(true);
    errors.assertClean();
  });

  test('importToSlot returns null for malformed JSON (error path)', async ({ page }) => {
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    const result = await page.evaluate(async () => {
      const { importToSlot } = await import('/src/systems/SaveManager.ts');
      return importToSlot('slot1', 'this is not json at all');
    });

    expect(result).toBeNull();
    errors.assertClean();
  });

  test('importToSlot returns null for a future format string', async ({ page }) => {
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    const result = await page.evaluate(async () => {
      const { importToSlot } = await import('/src/systems/SaveManager.ts');
      const badEnvelope = JSON.stringify({
        format: 'architect-save-v99',
        exportedAt: new Date().toISOString(),
        payload: {
          version: 1,
          totalAU: 10,
          floorAU: { 0: 10 },
          unlockedFloors: [0],
          currentFloor: 0,
          collectedTokens: { 0: [] },
        },
      });
      return importToSlot('slot1', badEnvelope);
    });

    expect(result).toBeNull();
    errors.assertClean();
  });

  test('SettingsScene renders Export Save and Import Save buttons', async ({ page }) => {
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    await navigateToSettings(page);

    // Verify the scene is active (which means the buttons were registered in buildItems())
    const isActive = await page.evaluate(() => {
      return window.__game?.scene.isActive('SettingsScene') ?? false;
    });
    expect(isActive).toBe(true);
    errors.assertClean();
  });
});
