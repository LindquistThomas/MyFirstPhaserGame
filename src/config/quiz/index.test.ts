import { describe, it, expect, beforeAll } from 'vitest';
import architectureQuizSource from '../../features/floors/architecture/quiz.ts?raw';
import platformQuizSource from '../../features/floors/platform/quiz.ts?raw';
import {
  QUIZ_DATA,
  QUIZ_DIFFICULTY_MIX,
  QUIZ_QUESTION_COUNT,
  QUIZ_PASS_THRESHOLD,
  QUIZ_REWARDS,
  QuizDifficulty,
  QuizDefinition,
  preloadQuizFor,
} from './index';
import { INFO_POINTS, preloadInfoFor } from '../info';
import { FLOORS } from '../gameConfig';

// Preload all floor content so QUIZ_DATA and INFO_POINTS are fully populated
// before any assertions run.  This mirrors what happens at runtime when the
// player visits each floor.
beforeAll(async () => {
  await Promise.all(
    Object.values(FLOORS).map((fid) =>
      Promise.all([preloadQuizFor(fid), preloadInfoFor(fid)]),
    ),
  );
});

describe('QUIZ_DATA', () => {
  // entries is captured lazily inside a nested beforeAll so that it reflects
  // the fully-populated QUIZ_DATA after the outer beforeAll completes.
  let entries: Array<[string, QuizDefinition]> = [];

  beforeAll(() => {
    entries = Object.entries(QUIZ_DATA);
  });

  it('is non-empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('has unique quiz keys', () => {
    const keys = entries.map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has infoId that matches the record key for every quiz', () => {
    for (const [key, def] of entries) {
      expect(def.infoId).toBe(key);
    }
  });

  it('references a real info-content entry for every quiz', () => {
    for (const [, def] of entries) {
      expect(INFO_POINTS[def.infoId]).toBeDefined();
    }
  });

  it('has at least QUIZ_QUESTION_COUNT questions per quiz', () => {
    for (const [, def] of entries) {
      expect(def.questions.length).toBeGreaterThanOrEqual(QUIZ_QUESTION_COUNT);
    }
  });

  it('has unique question ids inside every quiz', () => {
    for (const [, def] of entries) {
      const ids = def.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has at least 2 choices per question', () => {
    for (const [, def] of entries) {
      for (const q of def.questions) {
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('has a correctIndex within [0, choices.length) for every question', () => {
    for (const [, def] of entries) {
      for (const q of def.questions) {
        expect(Number.isInteger(q.correctIndex)).toBe(true);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
      }
    }
  });

  it('has non-empty question, choices, and explanation strings', () => {
    for (const [, def] of entries) {
      for (const q of def.questions) {
        expect(q.question.trim().length).toBeGreaterThan(0);
        expect(q.explanation.trim().length).toBeGreaterThan(0);
        for (const choice of q.choices) {
          expect(typeof choice).toBe('string');
          expect(choice.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has unique choices per question (no duplicate answer text)', () => {
    for (const [, def] of entries) {
      for (const q of def.questions) {
        expect(new Set(q.choices).size).toBe(q.choices.length);
      }
    }
  });

  it('uses only valid difficulty values', () => {
    const valid: QuizDifficulty[] = ['easy', 'medium', 'hard'];
    for (const [, def] of entries) {
      for (const q of def.questions) {
        expect(valid).toContain(q.difficulty);
      }
    }
  });

  it('has enough questions of each difficulty to satisfy QUIZ_DIFFICULTY_MIX', () => {
    for (const [key, def] of entries) {
      const counts: Record<QuizDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
      for (const q of def.questions) counts[q.difficulty]++;
      for (const diff of ['easy', 'medium', 'hard'] as QuizDifficulty[]) {
        expect(
          counts[diff],
          `quiz "${key}" has only ${counts[diff]} ${diff} questions, needs ${QUIZ_DIFFICULTY_MIX[diff]}`,
        ).toBeGreaterThanOrEqual(QUIZ_DIFFICULTY_MIX[diff]);
      }
    }
  });
});

describe('quiz constants', () => {
  it('QUIZ_DIFFICULTY_MIX sums to QUIZ_QUESTION_COUNT', () => {
    const sum = QUIZ_DIFFICULTY_MIX.easy + QUIZ_DIFFICULTY_MIX.medium + QUIZ_DIFFICULTY_MIX.hard;
    expect(sum).toBe(QUIZ_QUESTION_COUNT);
  });

  it('QUIZ_QUESTION_COUNT is in the documented 7..10 range', () => {
    expect(QUIZ_QUESTION_COUNT).toBeGreaterThanOrEqual(7);
    expect(QUIZ_QUESTION_COUNT).toBeLessThanOrEqual(10);
  });

  it('QUIZ_PASS_THRESHOLD is within [1, QUIZ_QUESTION_COUNT]', () => {
    expect(QUIZ_PASS_THRESHOLD).toBeGreaterThanOrEqual(1);
    expect(QUIZ_PASS_THRESHOLD).toBeLessThanOrEqual(QUIZ_QUESTION_COUNT);
  });

  it('QUIZ_REWARDS ordering: fail <= pass <= perfect', () => {
    expect(QUIZ_REWARDS.fail).toBeLessThanOrEqual(QUIZ_REWARDS.pass);
    expect(QUIZ_REWARDS.pass).toBeLessThanOrEqual(QUIZ_REWARDS.perfect);
  });
});

describe('quiz module organization', () => {
  it('keeps thin floor loader modules under 20 lines', () => {
    const sources = [
      ['architecture', architectureQuizSource],
      ['platform', platformQuizSource],
    ] as const;

    for (const [floorName, source] of sources) {
      const normalizedSource = source.replace(/\r\n/g, '\n');
      const withoutTrailingNewline = normalizedSource.endsWith('\n')
        ? normalizedSource.slice(0, -1)
        : normalizedSource;
      const lineCount = withoutTrailingNewline === '' ? 0 : withoutTrailingNewline.split('\n').length;
      expect(
        lineCount,
        `src/features/floors/${floorName}/quiz.ts should stay a thin loader; move authored content to quiz.${floorName}.json`,
      ).toBeLessThan(20);
    }
  });
});
