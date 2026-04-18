/**
 * Shared types and constants for the quiz system.
 *
 * Each quiz pool contains at least 30 questions (10 easy / 10 medium / 10 hard).
 * Each quiz attempt randomly draws QUIZ_QUESTION_COUNT questions with a
 * deterministic difficulty mix (see QUIZ_DIFFICULTY_MIX).
 *
 * Scoring: pass (>= QUIZ_PASS_THRESHOLD correct) → 3 AU,
 *          perfect (all correct)               → 5 AU,
 *          below threshold                     → 0 AU.
 */

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  difficulty: QuizDifficulty;
  question: string;
  choices: string[];       // always 4
  correctIndex: number;    // 0-3
  explanation: string;
}

export interface QuizDefinition {
  infoId: string;
  questions: QuizQuestion[];
}

/** AU awarded per quiz result. */
export const QUIZ_REWARDS = {
  pass: 3,       // 2 out of 3 correct
  perfect: 5,    // 3 out of 3 correct
  fail: 0,       // 0-1 correct
} as const;

/** Cooldown between quiz retry attempts in milliseconds. */
export const QUIZ_COOLDOWN_MS = 30_000;

/** Number of questions per quiz attempt (must be in 7..10 range). */
export const QUIZ_QUESTION_COUNT = 8;

/**
 * How many questions of each difficulty to draw per attempt.
 * Sum must equal QUIZ_QUESTION_COUNT.
 */
export const QUIZ_DIFFICULTY_MIX: Record<QuizDifficulty, number> = {
  easy: 3,
  medium: 3,
  hard: 2,
};

/** Minimum correct answers required to pass a quiz. */
export const QUIZ_PASS_THRESHOLD = 5;
