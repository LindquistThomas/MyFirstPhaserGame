/**
 * Quiz state persistence — tracks completion, scores, and retry cooldowns.
 *
 * Backed by the shared `PersistedStore<T>` factory; see PersistedStore.ts.
 */

import type { KVStorage } from './SaveManager';
import { createPersistedStore } from './PersistedStore';
import { QUIZ_COOLDOWN_MS, QUIZ_PASS_THRESHOLD } from '../config/quiz';

const STORAGE_KEY = 'architect_quiz_v1';

interface QuizRecord {
  passed: boolean;
  bestScore: number;
  lastAttemptTime: number;   // Date.now() milliseconds
  attempts: number;
}

type QuizStore = Record<string, QuizRecord>;

const store = createPersistedStore<QuizStore>({
  key: STORAGE_KEY,
  defaultValue: () => ({}),
  parse: (raw) => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as QuizStore : {}),
});

export function setStorage(s: KVStorage): void { store.setStorage(s); }

export function getQuizRecord(infoId: string): QuizRecord | null {
  return store.read()[infoId] ?? null;
}

export function isQuizPassed(infoId: string): boolean {
  return store.read()[infoId]?.passed ?? false;
}

export function canRetryQuiz(infoId: string): boolean {
  const record = store.read()[infoId];
  if (!record) return true;  // never attempted
  return Date.now() - record.lastAttemptTime >= QUIZ_COOLDOWN_MS;
}

/** Returns milliseconds remaining before retry is allowed. 0 if ready. */
export function getCooldownRemaining(infoId: string): number {
  const record = store.read()[infoId];
  if (!record) return 0;
  const elapsed = Date.now() - record.lastAttemptTime;
  return Math.max(0, QUIZ_COOLDOWN_MS - elapsed);
}

export function saveQuizResult(infoId: string, score: number): void {
  store.update((prev) => {
    const existing = prev[infoId];
    const passed = score >= QUIZ_PASS_THRESHOLD;
    return {
      ...prev,
      [infoId]: {
        passed: passed || (existing?.passed ?? false),
        bestScore: Math.max(score, existing?.bestScore ?? 0),
        lastAttemptTime: Date.now(),
        attempts: (existing?.attempts ?? 0) + 1,
      },
    };
  });
}

export function resetAllQuizzes(): void {
  store.clear();
}

/** Number of distinct quizzes the player has passed at least once. */
export function getPassedCount(): number {
  const s = store.read();
  return Object.values(s).filter((r: QuizRecord) => r.passed).length;
}

/** All infoIds for which the player has a passing record. */
export function getAllPassed(): string[] {
  const s = store.read();
  return Object.entries(s)
    .filter(([, r]) => (r as QuizRecord).passed)
    .map(([id]) => id);
}
