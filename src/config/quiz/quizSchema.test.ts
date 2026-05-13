import { beforeAll, describe, expect, it } from 'vitest';
import { FLOORS } from '../gameConfig';
import { INFO_POINTS, preloadInfoFor } from '../info';
import { QUIZ_DATA, preloadQuizFor } from './index';
import { quizDefinitionSchema, quizQuestionSchema } from './quizSchema';

beforeAll(async () => {
  await Promise.all(
    Object.values(FLOORS).map((floorId) =>
      Promise.all([preloadQuizFor(floorId), preloadInfoFor(floorId)]),
    ),
  );
});

describe('quizSchema', () => {
  it('validates every loaded quiz definition and question', () => {
    const failures: string[] = [];

    for (const [infoId, definition] of Object.entries(QUIZ_DATA)) {
      const result = quizDefinitionSchema.safeParse(definition);
      if (!result.success) {
        failures.push(
          `${infoId}: ${result.errors.map((error) => `${error.path} ${error.message}`).join('; ')}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps question ids globally unique across all quizzes', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const definition of Object.values(QUIZ_DATA)) {
      for (const question of definition.questions) {
        if (seen.has(question.id)) {
          duplicates.push(question.id);
        } else {
          seen.add(question.id);
        }
      }
    }

    expect(duplicates).toEqual([]);
  });

  it('ensures each quiz is registered against loaded info content and has questions', () => {
    for (const [infoId, definition] of Object.entries(QUIZ_DATA)) {
      expect(INFO_POINTS[infoId], `Missing info content for quiz infoId: ${infoId}`).toBeDefined();
      expect(definition.questions.length).toBeGreaterThan(0);
    }
  });

  it('rejects question with out-of-range correctIndex', () => {
    const invalidQuestion = {
      id: '__test_fixture_bad_correct_index',
      difficulty: 'easy',
      question: 'What does this fixture intentionally break?',
      choices: ['Option A', 'Option B'],
      correctIndex: 2,
      explanation: 'This fixture proves correctIndex must stay within choices bounds.',
    } as const;

    const result = quizQuestionSchema.safeParse(invalidQuestion);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.path === 'correctIndex')).toBe(true);
    }
  });
});
