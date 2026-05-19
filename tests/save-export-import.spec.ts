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
  // Walk the MenuScene buttons until [ SETTINGS ] is selected, then Enter.
  // Using label match (not a fixed ArrowDown count) so the helper survives
  // future menu reorderings or added items.
  const SETTINGS_LABEL = 'SETTINGS';
  for (let i = 0; i < 30; i++) {
    const selectedLabel = await page.evaluate(() => {
      const g = window.__game;
      if (!g) return null;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'MenuScene',
      ) as unknown as { menuButtons?: Array<{ btn: { text: string } }>; selectedIndex?: number } | undefined;
      if (!scene || !scene.menuButtons) return null;
      const idx = scene.selectedIndex ?? 0;
      return scene.menuButtons[idx]?.btn.text ?? null;
    });
    if (selectedLabel && selectedLabel.includes(SETTINGS_LABEL)) break;
    await page.keyboard.press('ArrowDown');
  }
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
      const hooks = (window as unknown as { __testHooks?: { exportSlot: (s:string)=>string|null; importToSlot:(s:string,j:string)=>unknown; SAVE_ENVELOPE_FORMAT: string } }).__testHooks;
      if (!hooks) return { ok: false, reason: '__testHooks missing' };
      const { exportSlot, importToSlot, SAVE_ENVELOPE_FORMAT } = hooks;

      const json = exportSlot('slot1');
      if (!json) return { ok: false, reason: 'exportSlot returned null' };

      const envelope = JSON.parse(json);
      if (envelope.format !== SAVE_ENVELOPE_FORMAT) {
        return { ok: false, reason: `bad format: ${envelope.format as string}` };
      }
      if (typeof envelope.exportedAt !== 'string') {
        return { ok: false, reason: 'missing exportedAt' };
      }

      if (!envelope.meta || typeof envelope.meta.floorName !== 'string') {
        return { ok: false, reason: 'missing export meta' };
      }

      // Capture original values before clearing
      const origTotalAU = (envelope.data as { totalAU: number }).totalAU;
      const origCurrentFloor = (envelope.data as { currentFloor: number }).currentFloor;
      const origUnlockedFloors = (envelope.data as { unlockedFloors: number[] }).unlockedFloors;
      const origOnboarding = (envelope.data as { onboardingComplete?: boolean }).onboardingComplete;

      // Clear and re-import
      window.localStorage.removeItem('architect_slot1_v1');
      const data = importToSlot('slot1', json);
      if (!data) return { ok: false, reason: 'importToSlot returned null' };

      return {
        ok: true,
        totalAU: data.totalAU,
        currentFloor: data.currentFloor,
        unlockedFloors: data.unlockedFloors,
        onboardingComplete: data.onboardingComplete,
        hasSlotKey: window.localStorage.getItem('architect_slot1_v1') !== null,
        origTotalAU,
        origCurrentFloor,
        origUnlockedFloors,
        origOnboarding,
      };
    });

    expect(result.ok).toBe(true);
    type R = {
      totalAU: number; currentFloor: number; unlockedFloors: number[];
      onboardingComplete?: boolean; hasSlotKey: boolean;
      origTotalAU: number; origCurrentFloor: number; origUnlockedFloors: number[]; origOnboarding?: boolean;
    };
    const r = result as unknown as R;
    expect(r.totalAU).toBe(r.origTotalAU);
    expect(r.currentFloor).toBe(r.origCurrentFloor);
    expect(r.unlockedFloors).toEqual(r.origUnlockedFloors);
    expect(r.onboardingComplete).toBe(r.origOnboarding);
    expect(r.hasSlotKey).toBe(true);
    errors.assertClean();
  });

  test('importToSlot returns null for malformed JSON (error path)', async ({ page }) => {
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    const result = await page.evaluate(async () => {
      const hooks = (window as unknown as { __testHooks?: { importToSlot:(s:string,j:string)=>unknown } }).__testHooks;
      if (!hooks) throw new Error('__testHooks missing');
      const { importToSlot } = hooks;
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
      const hooks = (window as unknown as { __testHooks?: { importToSlot:(s:string,j:string)=>unknown } }).__testHooks;
      if (!hooks) throw new Error('__testHooks missing');
      const { importToSlot } = hooks;
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

  test('SettingsScene contains Export Save and Import Save action items', async ({ page }) => {
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    await navigateToSettings(page);

    // Inspect the SettingsScene's items list to confirm both buttons are registered.
    const hasExportItem = await page.evaluate(() => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'SettingsScene',
      ) as unknown as Record<string, unknown>;
      if (!scene) return false;
      const items = scene['items'] as Array<{ kind: string; label: string }> | undefined;
      if (!Array.isArray(items)) return false;
      const hasExport = items.some((i) => i.kind === 'action' && i.label.includes('EXPORT SAVE'));
      const hasImport = items.some((i) => i.kind === 'action' && i.label.includes('IMPORT SAVE'));
      return hasExport && hasImport;
    });
    expect(hasExportItem).toBe(true);
    errors.assertClean();
  });

  test('import preview shows file and current-slot metadata before replace', async ({ page }) => {
    await seedFullProgressSave(page, { totalAU: 37 });
    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);

    await page.evaluate(() => {
      const game = window.__game as unknown as {
        scene: { start: (key: string, data?: unknown) => void };
      } | undefined;
      game?.scene.start('SettingsScene', { from: 'MenuScene' });
    });
    await waitForScene(page, 'SettingsScene');

    const result = await page.evaluate(() => {
      const hooks = (window as unknown as {
        __testHooks?: { exportSlot: (s: string) => string | null };
      }).__testHooks;
      const game = window.__game as unknown as {
        scene: {
          getScene: (key: string) => unknown;
        };
      } | undefined;
      if (!hooks || !game) return { ok: false, reason: 'missing hooks or game' };
      const json = hooks.exportSlot('slot1');
      if (!json) return { ok: false, reason: 'missing slot1 export' };

      const slot2 = {
        version: 3,
        totalAU: 99,
        floorAU: { 3: 99 },
        unlockedFloors: [0, 1, 3],
        currentFloor: 3,
        collectedTokens: { 0: [1], 3: [2] },
        onboardingComplete: true,
        visitedFloors: [0, 3],
        playtimeMs: 3661000,
        lastPlayedAt: Date.parse('2026-01-01T10:00:00.000Z'),
      };
      window.localStorage.setItem('architect_slot2_v1', JSON.stringify(slot2));

      const scene = game.scene.getScene('SettingsScene') as unknown as {
        importConfirmOpen?: boolean;
        importOverlay?: { list?: unknown[] };
        openImportConfirm: (raw: string, slotId: 'slot1' | 'slot2' | 'slot3', slotNum: number, preview: unknown) => void;
      };
      if (!scene || typeof scene.openImportConfirm !== 'function') {
        return { ok: false, reason: 'settings scene unavailable' };
      }
      const fromFile = JSON.parse(json);
      const preview = {
        fromFile: {
          floorName: fromFile.meta.floorName,
          totalAu: fromFile.meta.totalAu,
          playTime: fromFile.meta.playTime,
          slotId: fromFile.meta.slotId,
          exportedAt: fromFile.exportedAt,
        },
        currentSlot: {
          floorName: 'Business',
          totalAu: 99,
          playTime: 3661,
          slotId: 'slot2',
          lastPlayedAt: Date.parse('2026-01-01T10:00:00.000Z'),
        },
      };
      scene.openImportConfirm(json, 'slot2', 2, preview);

      const collectTexts = (nodes: unknown[] | undefined): string[] =>
        (nodes ?? []).flatMap((node) => {
          if (typeof (node as { text?: unknown }).text === 'string') {
            return [(node as { text: string }).text];
          }
          if (Array.isArray((node as { list?: unknown[] }).list)) {
            return collectTexts((node as { list: unknown[] }).list);
          }
          return [];
        });
      return {
        ok: scene.importConfirmOpen === true,
        texts: collectTexts(scene.importOverlay?.list),
      };
    });

    expect(result.ok).toBe(true);
    const texts = (result as { texts: string[] }).texts.join('\n');
    expect(texts).toContain('From file:');
    expect(texts).toContain('Current slot:');
    expect(texts).toContain('Lobby');
    expect(texts).toContain('Business');
    expect(texts).toContain('[ REPLACE ]');
    expect(texts).toContain('[ CANCEL ]');
    errors.assertClean();
  });
});
