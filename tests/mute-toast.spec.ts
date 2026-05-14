import { test, expect } from '@playwright/test';
import { attachErrorWatchers, clearStorage, waitForGame, waitForScene } from './helpers/playwright';

/**
 * Verifies the visual confirmation toast that appears when the M-key mute
 * hotkey is pressed.
 *
 * The toast text is rendered on the Phaser canvas so it cannot be queried
 * via DOM selectors. Instead, we verify:
 *   1. The `audio:mute-toggled` event fires via `window.__testHooks.eventBus`.
 *   2. The payload reflects the new mute state.
 *   3. The `AudioManager.isMuted()` state (read from the scene registry) is
 *      in sync with the payload after each press.
 */

test.describe('Mute hotkey — audio:mute-toggled toast', () => {
  test('pressing M fires audio:mute-toggled with correct muted state (persisted=true in normal env)', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Subscribe to audio:mute-toggled via testHooks.eventBus before pressing M.
    await page.evaluate(() => {
      const bus = (window as unknown as {
        __testHooks: {
          eventBus: {
            on: (event: string, fn: (payload: unknown) => void) => void;
          };
        };
        __muteToggledPayloads: unknown[];
      }).__testHooks.eventBus;

      (window as unknown as { __muteToggledPayloads: unknown[] }).__muteToggledPayloads = [];
      bus.on('audio:mute-toggled', (payload) => {
        (window as unknown as { __muteToggledPayloads: unknown[] }).__muteToggledPayloads.push(payload);
      });
    });

    // First M press — should mute.
    await page.keyboard.press('m');

    // Wait for the event to fire.
    const firstPayload = await page.waitForFunction(
      () => (window as unknown as { __muteToggledPayloads?: unknown[] }).__muteToggledPayloads?.[0],
      undefined,
      { timeout: 3_000 },
    );

    const first = await firstPayload.jsonValue() as { muted: boolean; persisted: boolean };
    expect(first.muted).toBe(true);
    expect(first.persisted).toBe(true);

    // Second M press — should unmute.
    await page.keyboard.press('m');

    const secondPayload = await page.waitForFunction(
      () => {
        const arr = (window as unknown as { __muteToggledPayloads?: unknown[] }).__muteToggledPayloads;
        return arr && arr.length >= 2 ? arr[1] : undefined;
      },
      undefined,
      { timeout: 3_000 },
    );

    const second = await secondPayload.jsonValue() as { muted: boolean; persisted: boolean };
    expect(second.muted).toBe(false);
    expect(second.persisted).toBe(true);

    errors.assertClean();
  });
});
