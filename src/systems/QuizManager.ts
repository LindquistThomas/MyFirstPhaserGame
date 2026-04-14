/**
 * Quiz state persistence — tracks completion, scores, and retry cooldowns.
 *
 * Follows the same module-level pattern as InfoDialogManager.ts:
 * own localStorage key, pure functions, no class needed.
 */

import type { KVStorage } from './SaveManager';
import { QUIZ_COOLDOWN_MS } from '../config/quizData';

const STORAGE_KEY = 'architect_quiz_v1';

interface QuizRecord {
  passed: boolean;
  bestScore: number;
  lastAttemptTime: number;   // Date.now() milliseconds
  attempts: number;
}

type QuizStore = Record<string, QuizRecord>;

let storage: KVStorage | null = null;

function getStorage(): KVStorage {
  if (storage) return storage;
  try { storage = globalThis.localStorage; return storage; }
  catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
}

function loadStore(): QuizStore {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as QuizStore : {};
  } catch { return {}; }
}

function persist(store: QuizStore): void {
  try { getStorage().setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

export function getQuizRecord(infoId: string): QuizRecord | null {
  return loadStore()[infoId] ?? null;
}

export function isQuizPassed(infoId: string): boolean {
  return loadStore()[infoId]?.passed ?? false;
}

export function canRetryQuiz(infoId: string): boolean {
  const record = loadStore()[infoId];
  if (!record) return true;  // never attempted
  return Date.now() - record.lastAttemptTime >= QUIZ_COOLDOWN_MS;
}

/** Returns milliseconds remaining before retry is allowed. 0 if ready. */
export function getCooldownRemaining(infoId: string): number {
  const record = loadStore()[infoId];
  if (!record) return 0;
  const elapsed = Date.now() - record.lastAttemptTime;
  return Math.max(0, QUIZ_COOLDOWN_MS - elapsed);
}

export function saveQuizResult(infoId: string, score: number, total: number): void {
  const store = loadStore();
  const existing = store[infoId];
  const passed = score >= 2;

  store[infoId] = {
    passed: passed || (existing?.passed ?? false),
    bestScore: Math.max(score, existing?.bestScore ?? 0),
    lastAttemptTime: Date.now(),
    attempts: (existing?.attempts ?? 0) + 1,
  };

  persist(store);
}

export function resetAllQuizzes(): void {
  try { getStorage().removeItem(STORAGE_KEY); } catch { /* noop */ }
}
