import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForDialogClosed,
  waitForDialogOpen,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

declare global {
  interface Window {
    __modalA11yTrigger?: Element | null;
  }
}

test.describe('Modal accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('InfoDialog exposes modal ARIA, traps Tab focus, and restores trigger focus on close', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);

    await page.evaluate(() => {
      window.__modalA11yTrigger = document.activeElement;
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('architecture-elevator');
    });

    await waitForDialogOpen(page, 'ElevatorScene');

    const modalRoot = page.locator('[data-modal-root="true"]').first();
    await expect(modalRoot).toHaveAttribute('role', 'dialog');
    await expect(modalRoot).toHaveAttribute('aria-modal', 'true');
    await expect(modalRoot).toHaveAttribute('aria-labelledby', /game-modal-\d+-title/);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const trapped = await page.evaluate(() => {
      const root = document.querySelector('[data-modal-root="true"]');
      return !!root && root.contains(document.activeElement);
    });
    expect(trapped).toBe(true);

    await page.keyboard.press('Escape');
    await waitForDialogClosed(page, 'ElevatorScene');

    const restored = await page.evaluate(
      () => document.activeElement === window.__modalA11yTrigger,
    );
    expect(restored).toBe(true);

    errors.assertClean();
  });
});
