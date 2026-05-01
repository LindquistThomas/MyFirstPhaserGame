import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * Quiz flow tests — exercise the pass and fail branches end-to-end through
 * a real QuizDialog instance. We bypass the info-dialog layer by
 * constructing QuizDialog directly (dynamically imported via Vite's dev
 * server) and then driving its `onAnswer` handler with the canonical
 * correct/incorrect index for each question. `showResults()` is what calls
 * `saveQuizResult`, so we assert the QuizManager-visible side effects:
 * `isQuizPassed` for pass, cooldown-active for fail.
 */

const INFO_ID = 'you-build-you-run';

type QuizQuestion = { correctIndex: number; choices: unknown[] };
type QuizDialogLike = {
  screen: 'question' | 'feedback' | 'results';
  currentIndex: number;
  questions: QuizQuestion[];
  onAnswer: (i: number, q: QuizQuestion) => void;
  showQuestion: () => void;
  showResults: () => void;
  close: () => void;
};

declare global {
  interface Window {
    __quiz?: QuizDialogLike;
  }
}

async function enterFloor1(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await waitForGame(page);
  await waitForScene(page, 'MenuScene');

  await navigateToElevator(page);

  await page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
    (scene['enterFloor'] as (id: number) => void)(1);
  });
  await waitForScene(page, 'PlatformTeamScene');
}

async function openQuiz(page: import('@playwright/test').Page, infoId: string): Promise<void> {
  await page.evaluate((id) => {
    // `__testHooks` is populated in src/main.ts for both dev and preview
    // builds. Previously this used `import('/src/ui/QuizDialog.ts')`, which
    // only works against the Vite dev server — CI now targets the built
    // bundle via `vite preview`, so that path resolves to a 404.
    const hooks = (window as unknown as {
      __testHooks?: { QuizDialog: new (s: unknown, o: unknown) => QuizDialogLike };
    }).__testHooks;
    if (!hooks) throw new Error('__testHooks missing — main.ts must expose QuizDialog');
    const scene = window.__game!.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
    if (!scene) throw new Error('PlatformTeamScene not active');
    window.__quiz = new hooks.QuizDialog(scene, {
      infoId: id,
      floorId: 1,
      progression: scene['progression'],
    });
  }, infoId);
  // Wait until the QuizDialog has rendered its first question screen.
  await page.waitForFunction(
    () => window.__quiz !== undefined && window.__quiz.screen === 'question',
    undefined,
    { timeout: 10_000 },
  );
}

async function answerAll(
  page: import('@playwright/test').Page,
  mode: 'correct' | 'wrong',
): Promise<number> {
  return page.evaluate((m) => {
    const qd = window.__quiz!;
    while (qd.screen === 'question') {
      const q = qd.questions[qd.currentIndex];
      const idx = m === 'correct'
        ? q.correctIndex
        : (q.correctIndex + 1) % q.choices.length;
      qd.onAnswer(idx, q);
      qd.currentIndex++;
      if (qd.currentIndex < qd.questions.length) {
        qd.showQuestion();
      }
    }
    qd.showResults();
    return qd.questions.length;
  }, mode);
}

interface QuizStoreRecord {
  passed: boolean;
  bestScore: number;
  lastAttemptTime: number;
  attempts: number;
}

async function readQuizStore(page: import('@playwright/test').Page): Promise<Record<string, QuizStoreRecord>> {
  const raw = await page.evaluate(() => window.localStorage.getItem('architect_quiz_v1'));
  expect(raw).toBeTruthy();
  return JSON.parse(raw!) as Record<string, QuizStoreRecord>;
}

test.describe('Quiz flows', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('answering every question correctly marks the quiz as passed', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await enterFloor1(page);
    const auBefore = await page.evaluate(() => {
      const scene = window.__game!.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
      return (scene['progression'] as { getTotalAU: () => number }).getTotalAU();
    });

    await openQuiz(page, INFO_ID);
    const total = await answerAll(page, 'correct');
    expect(total).toBeGreaterThan(0);

    const store = await readQuizStore(page);
    const record = store[INFO_ID];
    expect(record).toBeTruthy();
    expect(record.passed).toBe(true);
    expect(record.bestScore).toBe(total);
    expect(record.attempts).toBe(1);

    // Passing a quiz for the first time awards AU via ProgressionSystem.
    const auAfter = await page.evaluate(() => {
      const scene = window.__game!.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
      return (scene['progression'] as { getTotalAU: () => number }).getTotalAU();
    });
    expect(auAfter).toBeGreaterThan(auBefore);

    // Close the dialog before teardown so no modal input context leaks.
    await page.evaluate(() => window.__quiz?.close());
    errors.assertClean();
  });

  test('answering every question wrong leaves a cooldown and does not pass', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await enterFloor1(page);
    await openQuiz(page, INFO_ID);
    await answerAll(page, 'wrong');

    const store = await readQuizStore(page);
    const record = store[INFO_ID];
    expect(record).toBeTruthy();
    expect(record.passed).toBe(false);
    expect(record.bestScore).toBe(0);
    expect(record.attempts).toBe(1);

    // Cooldown is active immediately after a failed attempt (default 30s).
    const now = Date.now();
    expect(record.lastAttemptTime).toBeGreaterThan(now - 60_000);
    expect(record.lastAttemptTime).toBeLessThanOrEqual(now + 1_000);

    // Verify via the QuizManager API itself — single source of truth for
    // cooldown semantics (threshold lives in quizData.ts). Reaches the
    // function through the `__testHooks` global exposed by src/main.ts
    // so the path works against both the Vite dev server and the built
    // bundle served by `vite preview` on CI.
    const canRetry = await page.evaluate((id) => {
      const hooks = (window as unknown as {
        __testHooks?: { canRetryQuiz: (i: string) => boolean };
      }).__testHooks;
      if (!hooks) throw new Error('__testHooks missing — main.ts must expose canRetryQuiz');
      return hooks.canRetryQuiz(id);
    }, INFO_ID);
    expect(canRetry).toBe(false);

    await page.evaluate(() => window.__quiz?.close());
    errors.assertClean();
  });
});
