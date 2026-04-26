# Skill: Debug with Playwright

## Purpose

Inspect the running game from tests — grab screenshots, jump to specific scenes, pre-seed progression — without driving the full gameplay flow every time.

## Commands

```powershell
npm run test:e2e              # Run Playwright specs (headless)
npm run test:headed           # Visible browser (watch scene transitions)
npm run test:ui               # Interactive Playwright UI (trace, timeline)
npm run test:visual:update    # Refresh visual snapshot PNGs
npm run test:report           # Open the last HTML report
```

Playwright specs live in `tests/*.spec.ts`; shared helpers live in `tests/helpers/playwright.ts`.

## Test-hook globals

`src/main.ts` attaches `window.__game` (Phaser.Game) and `window.__testHooks` (`{ QuizDialog, canRetryQuiz, eventBus }`) whenever `VITE_EXPOSE_TEST_HOOKS !== 'false'` — default-on in dev, preview, and production. Tests use both. Build with `VITE_EXPOSE_TEST_HOOKS=false` for a hardened bundle (see README "Build flags").

## Debug screenshot

```ts
await page.screenshot({ path: 'tests/screenshots/debug-my-feature.png' });

// Clip to a region:
await page.screenshot({
  path: 'tests/screenshots/debug-hud.png',
  clip: { x: 0, y: 0, width: 640, height: 120 },
});
```

Commit useful screenshots to `tests/screenshots/` so reviewers can see the current state without running the game.

## Jump to a specific scene

```ts
import { waitForGame, waitForScene } from './helpers/playwright';

await waitForGame(page);
await page.evaluate(() => {
  const active = window.__game!.scene.getScenes(true);
  const current = active.find(s => s.sys.settings.key === 'ElevatorScene');
  current?.scene.start('PlatformTeamScene');
});
await waitForScene(page, 'PlatformTeamScene');
await page.screenshot({ path: 'tests/screenshots/debug-platform-team.png' });
```

## Call private methods

TypeScript visibility is stripped at runtime, so bracket access works:

```ts
(scene as Record<string, unknown>)['enterFloor'](1);
```

## Pre-seed progression

Use the shared helper — it keeps test payloads in sync with the save schema:

```ts
import { seedFullProgressSave } from './helpers/playwright';

await seedFullProgressSave(page);                 // defaults: totalAU=50, sensible floorAU
await seedFullProgressSave(page, { totalAU: 0 }); // observe AU increasing from zero
```

The helper also marks the elevator info dialog as already seen so it doesn't swallow keyboard input on first ride.

To start from a completely clean slate:

```ts
import { clearStorage } from './helpers/playwright';
await clearStorage(page);
```

## Error hygiene

```ts
import { attachErrorWatchers } from './helpers/playwright';

const errors = attachErrorWatchers(page);
// … test body …
errors.assertClean();                // fails if any uncaught pageerror / console.error leaked
```

Known-benign patterns (Vite HMR close, ResizeObserver) are already suppressed in the helper.

## Wait for dialog state

Use the deterministic helpers instead of `page.waitForTimeout` when a dialog opens or closes:

```ts
import { waitForDialogOpen, waitForDialogClosed } from './helpers/playwright';

// After triggering an action that opens a dialog:
await page.keyboard.press('Enter');
await waitForDialogOpen(page, 'PlatformTeamScene');

// After dismissing the dialog:
await page.keyboard.press('Escape');
await waitForDialogClosed(page, 'PlatformTeamScene');
```

Both helpers poll `DialogController.isOpen` on the named scene (via the `dialogs` property) and time out after 15 seconds. They replace the fixed 200–500 ms sleeps that were common before these helpers existed.

## Input gotcha

`Space` is bound **exclusively** to Jump. To start the game from `MenuScene`, confirm a quiz, or interact with the elevator, press **`Enter`** — it's bound to `Confirm` / `Interact` / `ToggleInfo`. See `src/input/bindings.ts`.
