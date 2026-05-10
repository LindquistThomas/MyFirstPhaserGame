/**
 * Quiz state persistence — tracks completion, scores, and retry cooldowns.
 *
 * Backed by the shared `PersistedStore<T>` factory; see PersistedStore.ts.
 */

import type { KVStorage } from './SaveManager';
import { getPlayerSlot } from './SaveManager';
import { createPersistedStore } from './PersistedStore';
import { FloorId } from '../config/gameConfig';
import { QUIZ_COOLDOWN_MS, QUIZ_FLOOR_MASTERY_BONUS_AU, QUIZ_PASS_THRESHOLD, QUIZ_REWARDS } from '../config/quiz';

const STORAGE_KEY = 'architect_quiz_v1';

interface QuizRecord {
  passed: boolean;
  bestScore: number;
  lastAttemptTime: number;   // Date.now() milliseconds
  attempts: number;
  awarded?: boolean;
}

interface QuizSlotState {
  quizzes: Record<string, QuizRecord>;
  floorMasteryAwarded: Partial<Record<FloorId, boolean>>;
}

interface QuizStore {
  slots: Record<string, QuizSlotState>;
}

function defaultSlotState(): QuizSlotState {
  return {
    quizzes: {},
    floorMasteryAwarded: {},
  };
}

function defaultStore(): QuizStore {
  return { slots: {} };
}

function normaliseLegacySlot(raw: unknown): Record<string, QuizRecord> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, QuizRecord> = {};
  for (const [infoId, rec] of Object.entries(raw as Record<string, unknown>)) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
    const r = rec as Partial<QuizRecord>;
    if (typeof r.bestScore !== 'number' || typeof r.lastAttemptTime !== 'number' || typeof r.attempts !== 'number') continue;
    const passed = !!r.passed;
    out[infoId] = {
      passed,
      bestScore: r.bestScore,
      lastAttemptTime: r.lastAttemptTime,
      attempts: r.attempts,
      // Migration rule: legacy passed quizzes are treated as already awarded
      // so old saves do not back-grant AU when replayed.
      awarded: typeof r.awarded === 'boolean' ? r.awarded : passed,
    };
  }
  return out;
}

function parseSlotState(raw: unknown): QuizSlotState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultSlotState();
  const obj = raw as Record<string, unknown>;
  return {
    quizzes: normaliseLegacySlot(obj['quizzes']),
    floorMasteryAwarded: (obj['floorMasteryAwarded'] && typeof obj['floorMasteryAwarded'] === 'object' && !Array.isArray(obj['floorMasteryAwarded']))
      ? obj['floorMasteryAwarded'] as Partial<Record<FloorId, boolean>>
      : {},
  };
}

const store = createPersistedStore<QuizStore>({
  key: STORAGE_KEY,
  defaultValue: defaultStore,
  parse: (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultStore();
    const obj = raw as Record<string, unknown>;
    if (!obj['slots'] || typeof obj['slots'] !== 'object' || Array.isArray(obj['slots'])) {
      return {
        slots: {
          [getPlayerSlot()]: {
            quizzes: normaliseLegacySlot(raw),
            floorMasteryAwarded: {},
          },
        },
      };
    }
    const slots: Record<string, QuizSlotState> = {};
    for (const [slotId, slotState] of Object.entries(obj['slots'] as Record<string, unknown>)) {
      slots[slotId] = parseSlotState(slotState);
    }
    return { slots };
  },
});

export function setStorage(s: KVStorage): void { store.setStorage(s); }

function slotState(state: QuizStore, slotId = getPlayerSlot()): QuizSlotState {
  return state.slots[slotId] ?? defaultSlotState();
}

function readSlot(slotId = getPlayerSlot()): QuizSlotState {
  return slotState(store.read(), slotId);
}

export function getQuizRecord(infoId: string): QuizRecord | null {
  return readSlot().quizzes[infoId] ?? null;
}

export function isQuizPassed(infoId: string): boolean {
  return readSlot().quizzes[infoId]?.passed ?? false;
}

export function canRetryQuiz(infoId: string): boolean {
  const record = readSlot().quizzes[infoId];
  if (!record) return true;  // never attempted
  return Date.now() - record.lastAttemptTime >= QUIZ_COOLDOWN_MS;
}

/** Returns milliseconds remaining before retry is allowed. 0 if ready. */
export function getCooldownRemaining(infoId: string): number {
  const record = readSlot().quizzes[infoId];
  if (!record) return 0;
  const elapsed = Date.now() - record.lastAttemptTime;
  return Math.max(0, QUIZ_COOLDOWN_MS - elapsed);
}

export function saveQuizResult(infoId: string, score: number): void {
  const slotId = getPlayerSlot();
  store.update((prev) => {
    const slot = slotState(prev, slotId);
    const existing = slot.quizzes[infoId];
    const passed = score >= QUIZ_PASS_THRESHOLD;
    return {
      ...prev,
      slots: {
        ...prev.slots,
        [slotId]: {
          ...slot,
          quizzes: {
            ...slot.quizzes,
            [infoId]: {
              passed: passed || (existing?.passed ?? false),
              bestScore: Math.max(score, existing?.bestScore ?? 0),
              lastAttemptTime: Date.now(),
              attempts: (existing?.attempts ?? 0) + 1,
              awarded: existing?.awarded ?? false,
            },
          },
        },
      },
    };
  });
}

export function resetAllQuizzes(): void {
  store.clear();
}

export interface QuizPassRewardResult {
  quizBonusAU: number;
  floorMasteryBonusAU: number;
  totalBonusAU: number;
  floorMasteryEarned: boolean;
}

export function recordQuizPass(infoId: string, floorId: FloorId, floorQuizInfoIds: string[]): QuizPassRewardResult {
  const slotId = getPlayerSlot();
  let result: QuizPassRewardResult = {
    quizBonusAU: 0,
    floorMasteryBonusAU: 0,
    totalBonusAU: 0,
    floorMasteryEarned: false,
  };

  store.update((prev) => {
    const slot = slotState(prev, slotId);
    const existing = slot.quizzes[infoId];
    const nextQuizAward = existing?.awarded ? 0 : QUIZ_REWARDS.pass;
    const updatedQuiz: QuizRecord = {
      passed: true,
      bestScore: existing?.bestScore ?? 0,
      lastAttemptTime: existing?.lastAttemptTime ?? Date.now(),
      attempts: existing?.attempts ?? 0,
      awarded: true,
    };

    const updatedQuizzes = {
      ...slot.quizzes,
      [infoId]: updatedQuiz,
    };

    const masteryAlreadyAwarded = slot.floorMasteryAwarded[floorId] === true;
    const hasFloorQuizSet = floorQuizInfoIds.length > 0;
    const allPassedForFloor = hasFloorQuizSet
      && floorQuizInfoIds.every((id) => updatedQuizzes[id]?.passed === true);
    const floorMasteryEarnedNow = !masteryAlreadyAwarded && allPassedForFloor;
    const floorMasteryBonus = floorMasteryEarnedNow ? QUIZ_FLOOR_MASTERY_BONUS_AU : 0;

    result = {
      quizBonusAU: nextQuizAward,
      floorMasteryBonusAU: floorMasteryBonus,
      totalBonusAU: nextQuizAward + floorMasteryBonus,
      floorMasteryEarned: floorMasteryEarnedNow,
    };

    return {
      ...prev,
      slots: {
        ...prev.slots,
        [slotId]: {
          quizzes: updatedQuizzes,
          floorMasteryAwarded: floorMasteryEarnedNow
            ? { ...slot.floorMasteryAwarded, [floorId]: true }
            : slot.floorMasteryAwarded,
        },
      },
    };
  });

  return result;
}

/** Number of distinct quizzes the player has passed at least once. */
export function getPassedCount(slotId = getPlayerSlot()): number {
  const quizzes = readSlot(slotId).quizzes;
  return Object.values(quizzes).filter((r: QuizRecord) => r.passed).length;
}

/** All infoIds for which the player has a passing record. */
export function getAllPassed(): string[] {
  const quizzes = readSlot().quizzes;
  return Object.entries(quizzes)
    .filter(([, r]) => (r as QuizRecord).passed)
    .map(([id]) => id);
}
