import { QuizDefinition, QuizDifficulty, QuizQuestion } from './types';

export interface QuizSchemaIssue {
  path: string;
  message: string;
}

export type QuizSchemaResult<T> =
  | { success: true; data: T }
  | { success: false; errors: QuizSchemaIssue[] };

const QUESTION_ID_RE = /^[a-z0-9_-]+$/;
const QUIZ_DIFFICULTIES: ReadonlySet<QuizDifficulty> = new Set(['easy', 'medium', 'hard']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafeText(value: unknown, minLength: number): value is string {
  return typeof value === 'string'
    && value.trim().length >= minLength;
}

function pushIssue(errors: QuizSchemaIssue[], path: string, message: string): void {
  errors.push({ path, message });
}

export const quizQuestionSchema = {
  safeParse(value: unknown): QuizSchemaResult<QuizQuestion> {
    const errors: QuizSchemaIssue[] = [];

    if (!isRecord(value)) {
      pushIssue(errors, 'question', 'question must be an object');
      return { success: false, errors };
    }

    if (typeof value.id !== 'string' || !QUESTION_ID_RE.test(value.id)) {
      pushIssue(errors, 'id', 'id must match /^[a-z0-9_-]+$/');
    }

    if (!isSafeText(value.question, 1)) {
      pushIssue(errors, 'question', 'question must be non-empty text');
    }

    if (!Array.isArray(value.choices) || value.choices.length < 2 || value.choices.length > 6) {
      pushIssue(errors, 'choices', 'choices must contain 2..6 entries');
    } else {
      value.choices.forEach((choice, index) => {
        if (!isSafeText(choice, 1)) {
          pushIssue(
            errors,
            `choices[${index}]`,
            'choice must be non-empty text',
          );
        }
      });
    }

    const correctIndex = value.correctIndex;
    if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0) {
      pushIssue(errors, 'correctIndex', 'correctIndex must be a non-negative integer');
    } else if (Array.isArray(value.choices) && correctIndex >= value.choices.length) {
      pushIssue(errors, 'correctIndex', 'correctIndex must be < choices.length');
    }

    if (typeof value.difficulty !== 'string' || !QUIZ_DIFFICULTIES.has(value.difficulty as QuizDifficulty)) {
      pushIssue(errors, 'difficulty', 'difficulty must be one of easy|medium|hard');
    }

    if (!isSafeText(value.explanation, 1)) {
      pushIssue(
        errors,
        'explanation',
        'explanation must be non-empty text',
      );
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: value as unknown as QuizQuestion };
  },
};

export const quizDefinitionSchema = {
  safeParse(value: unknown): QuizSchemaResult<QuizDefinition> {
    const errors: QuizSchemaIssue[] = [];

    if (!isRecord(value)) {
      pushIssue(errors, 'quiz', 'quiz must be an object');
      return { success: false, errors };
    }

    if (typeof value.infoId !== 'string' || value.infoId.trim().length === 0) {
      pushIssue(errors, 'infoId', 'infoId must be a non-empty string');
    }

    if (!Array.isArray(value.questions) || value.questions.length === 0) {
      pushIssue(errors, 'questions', 'questions must contain at least one question');
    } else {
      const questionIds = new Set<string>();

      value.questions.forEach((question, index) => {
        const result = quizQuestionSchema.safeParse(question);
        if (!result.success) {
          result.errors.forEach((error) => {
            pushIssue(errors, `questions[${index}].${error.path}`, error.message);
          });
          return;
        }

        if (questionIds.has(result.data.id)) {
          pushIssue(errors, `questions[${index}].id`, `duplicate question id: ${result.data.id}`);
          return;
        }

        questionIds.add(result.data.id);
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: value as unknown as QuizDefinition };
  },
};
