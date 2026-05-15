import quizData from './quiz.platform.json' with { type: 'json' };
import { parseQuizBundle } from '../../../config/quiz/quizSchema';
import { QuizDefinition } from '../../../config/quiz/types';

/** Quizzes for the Platform Team floor (left room of floor 1). */
export const QUIZ_PLATFORM: Record<string, QuizDefinition> = parseQuizBundle(quizData);
