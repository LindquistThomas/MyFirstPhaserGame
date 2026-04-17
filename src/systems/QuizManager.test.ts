import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isQuizPassed,
  canRetryQuiz,
  getCooldownRemaining,
  saveQuizResult,
  getQuizRecord,
  resetAllQuizzes,
} from './QuizManager';
import { QUIZ_COOLDOWN_MS, QUIZ_PASS_THRESHOLD } from '../config/quizData';

describe('QuizManager', () => {
  beforeEach(() => {
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
    saveQuizResult('foo', 3);
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
});
