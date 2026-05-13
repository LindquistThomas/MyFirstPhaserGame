import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isQuizPassed,
  canRetryQuiz,
  getCooldownRemaining,
  saveQuizResult,
  getQuizRecord,
  resetAllQuizzes,
  recordQuizPass,
  setStorage,
  getPassedCount,
} from './QuizManager';
import { QUIZ_COOLDOWN_MS, QUIZ_PASS_THRESHOLD } from '../config/quiz';
import { FLOORS } from '../config/gameConfig';
import { setPlayerSlot } from './SaveManager';

describe('QuizManager', () => {
  const memoryStorage = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { memoryStorage.set(key, value); },
    removeItem: (key: string) => { memoryStorage.delete(key); },
  };

  beforeEach(() => {
    memoryStorage.clear();
    setStorage(storage);
    setPlayerSlot('slot1');
    resetAllQuizzes();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAllQuizzes();
  });

  it('reports not passed and retryable before any attempt', () => {
    expect(isQuizPassed('foo')).toBe(false);
    expect(canRetryQuiz('foo')).toBe(true);
    expect(getCooldownRemaining('foo')).toBe(0);
    expect(getQuizRecord('foo')).toBeNull();
  });

  it('records a passing score', () => {
    saveQuizResult('foo', QUIZ_PASS_THRESHOLD);
    expect(isQuizPassed('foo')).toBe(true);
    const rec = getQuizRecord('foo');
    expect(rec?.bestScore).toBe(QUIZ_PASS_THRESHOLD);
    expect(rec?.attempts).toBe(1);
  });

  it('keeps passed=true once earned, even on later failures', () => {
    saveQuizResult('foo', QUIZ_PASS_THRESHOLD);
    saveQuizResult('foo', 0);
    expect(isQuizPassed('foo')).toBe(true);
  });

  it('tracks bestScore as the maximum across attempts', () => {
    saveQuizResult('foo', 1);
    saveQuizResult('foo', 3);
    saveQuizResult('foo', 2);
    expect(getQuizRecord('foo')?.bestScore).toBe(3);
    expect(getQuizRecord('foo')?.attempts).toBe(3);
  });

  it('enforces a cooldown between attempts', () => {
    saveQuizResult('foo', 0);
    expect(canRetryQuiz('foo')).toBe(false);
    expect(getCooldownRemaining('foo')).toBeGreaterThan(0);

    vi.advanceTimersByTime(QUIZ_COOLDOWN_MS - 1);
    expect(canRetryQuiz('foo')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(canRetryQuiz('foo')).toBe(true);
    expect(getCooldownRemaining('foo')).toBe(0);
  });

  it('counts down remaining cooldown monotonically', () => {
    saveQuizResult('foo', 0);
    const start = getCooldownRemaining('foo');
    vi.advanceTimersByTime(5_000);
    const later = getCooldownRemaining('foo');
    expect(later).toBe(start - 5_000);
  });

  it('recordQuizPass is idempotent and grants AU only once per quiz', () => {
    saveQuizResult('platform-q1', QUIZ_PASS_THRESHOLD);

    const first = recordQuizPass('platform-q1', FLOORS.PLATFORM_TEAM, ['platform-q1', 'arch-q1']);
    expect(first.quizBonusAU).toBe(3);
    expect(first.floorMasteryBonusAU).toBe(0);

    const replay = recordQuizPass('platform-q1', FLOORS.PLATFORM_TEAM, ['platform-q1', 'arch-q1']);
    expect(replay.quizBonusAU).toBe(0);
    expect(replay.floorMasteryBonusAU).toBe(0);
  });

  it('awards floor mastery only after all quizzes on that floor are passed (left + right rooms)', () => {
    saveQuizResult('platform-left', QUIZ_PASS_THRESHOLD);
    const first = recordQuizPass('platform-left', FLOORS.PLATFORM_TEAM, ['platform-left', 'architecture-right']);
    expect(first.floorMasteryBonusAU).toBe(0);

    saveQuizResult('architecture-right', QUIZ_PASS_THRESHOLD);
    const second = recordQuizPass('architecture-right', FLOORS.PLATFORM_TEAM, ['platform-left', 'architecture-right']);
    expect(second.floorMasteryBonusAU).toBe(5);

    const replay = recordQuizPass('architecture-right', FLOORS.PLATFORM_TEAM, ['platform-left', 'architecture-right']);
    expect(replay.floorMasteryBonusAU).toBe(0);
  });

  it('migrates legacy passed records as already-awarded to avoid back-granting AU', () => {
    storage.setItem('architect_quiz_v1', JSON.stringify({
      legacyQuiz: {
        passed: true,
        bestScore: QUIZ_PASS_THRESHOLD,
        lastAttemptTime: Date.now(),
        attempts: 1,
      },
    }));

    expect(isQuizPassed('legacyQuiz')).toBe(true);
    const reward = recordQuizPass('legacyQuiz', FLOORS.LOBBY, ['legacyQuiz']);
    expect(reward.quizBonusAU).toBe(0);
    expect(reward.floorMasteryBonusAU).toBe(5);
  });

  it('tracks passed quiz counts per slot', () => {
    saveQuizResult('slot1-quiz', QUIZ_PASS_THRESHOLD);
    recordQuizPass('slot1-quiz', FLOORS.LOBBY, ['slot1-quiz']);

    setPlayerSlot('slot2');
    saveQuizResult('slot2-quiz', QUIZ_PASS_THRESHOLD);
    recordQuizPass('slot2-quiz', FLOORS.LOBBY, ['slot2-quiz']);

    expect(getPassedCount('slot1')).toBe(1);
    expect(getPassedCount('slot2')).toBe(1);
  });
});
