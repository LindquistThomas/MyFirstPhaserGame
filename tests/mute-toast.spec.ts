import { test, expect } from '@playwright/test';
import { attachErrorWatchers, clearStorage, waitForGame, waitForScene } from './helpers/playwright';

/**
 * Verifies the visual confirmation toast that appears when the M-key mute
 * hotkey is pressed.
 *
 * The toast text is rendered on the Phaser canvas so it cannot be queried
 * via DOM selectors. Instead we verify:
 *   1. The `audio:mute-toggled` event fires via `window.__testHooks.eventBus`.
 *   2. The payload reflects the new mute state and whether it was persisted.
 */

interface MuteToggledPayload {
  muted: boolean;
  persisted: boolean;
}

declare global {
  interface Window {
    __muteToggledPayloads?: MuteToggledPayload[];
  }
}

test.describe('Mute hotkey — audio:mute-toggled toast', () => {
  test('pressing M fires audio:mute-toggled with correct muted state (persisted=true in normal env)', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Register a listener for audio:mute-toggled via testHooks.eventBus.
    await page.evaluate(() => {
      const bus = (window as unknown as {
        __testHooks: { eventBus: { on: (event: string, fn: (p: MuteToggledPayload) => void) => void } };
      }).__testHooks.eventBus;
      window.__muteToggledPayloads = [];
      bus.on('audio:mute-toggled', (p) => window.__muteToggledPayloads!.push(p));
    });

    // First M press — should mute.
    await page.keyboard.press('m');

    const firstHandle = await page.waitForFunction(
      () => window.__muteToggledPayloads?.[0],
      undefined,
      { timeout: 3_000 },
    );
    const first = await firstHandle.jsonValue() as MuteToggledPayload;
    expect(first.muted).toBe(true);
    expect(first.persisted).toBe(true);

    // Second M press — should unmute.
    await page.keyboard.press('m');

    const secondHandle = await page.waitForFunction(
      () => window.__muteToggledPayloads?.[1],
      undefined,
      { timeout: 3_000 },
    );
    const second = await secondHandle.jsonValue() as MuteToggledPayload;
    expect(second.muted).toBe(false);
    expect(second.persisted).toBe(true);

    errors.assertClean();
  });
});
