import quizData from './quiz.architecture.json' with { type: 'json' };
import { parseQuizBundle } from '../../../config/quiz/quizSchema';
import { QuizDefinition } from '../../../config/quiz/types';

/** Quizzes for the Architecture Team floor (right room of floor 1). */
export const QUIZ_ARCHITECTURE: Record<string, QuizDefinition> = parseQuizBundle(quizData);
