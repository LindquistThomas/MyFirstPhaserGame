/**
 * Quiz module barrel.
 *
 * The Tier A split moved the quiz pool out of a single 2,794-line god file
 * into one file per floor. Each floor owner edits a smaller file; merges
 * only collide when two contributors touch the same floor.
 *
 * Callers import from this barrel (`config/quiz`) and keep the same
 * symbols they had before: `QUIZ_DATA`, `QUIZ_REWARDS`, difficulty mix,
 * thresholds, and the `QuizQuestion` / `QuizDefinition` types.
 */

import { FloorId, FLOORS } from '../gameConfig';
import { QuizDefinition } from './types';
import { QUIZ_LOBBY } from './lobby';
import { QUIZ_PLATFORM } from './platform';
import { QUIZ_ARCHITECTURE } from './architecture';
import { QUIZ_FINANCE } from './finance';
import { QUIZ_PRODUCT } from './product';
import { QUIZ_EXEC } from './exec';

export type {
  QuizDifficulty,
  QuizQuestion,
  QuizDefinition,
} from './types';
export {
  QUIZ_REWARDS,
  QUIZ_COOLDOWN_MS,
  QUIZ_QUESTION_COUNT,
  QUIZ_DIFFICULTY_MIX,
  QUIZ_PASS_THRESHOLD,
} from './types';

/** Merged quiz catalogue keyed by infoId (back-compatible with the old export). */
export const QUIZ_DATA: Record<string, QuizDefinition> = {
  ...QUIZ_LOBBY,
  ...QUIZ_PLATFORM,
  ...QUIZ_ARCHITECTURE,
  ...QUIZ_FINANCE,
  ...QUIZ_PRODUCT,
  ...QUIZ_EXEC,
};

const QUIZZES_BY_FLOOR: Record<FloorId, Record<string, QuizDefinition>> = {
  [FLOORS.LOBBY]: QUIZ_LOBBY,
  // Floor 1 hosts both the Platform and Architecture rooms.
  [FLOORS.PLATFORM_TEAM]: { ...QUIZ_PLATFORM, ...QUIZ_ARCHITECTURE },
  // Floor 3 hosts Finance (left) and Product Leadership (right).
  [FLOORS.BUSINESS]: { ...QUIZ_FINANCE, ...QUIZ_PRODUCT },
  [FLOORS.EXECUTIVE]: QUIZ_EXEC,
  [FLOORS.PRODUCTS]: QUIZ_PRODUCT,
};

/** Return the quiz catalogue for a specific floor (keyed by infoId). */
export function getQuizFor(floorId: FloorId): Record<string, QuizDefinition> {
  return QUIZZES_BY_FLOOR[floorId] ?? {};
}
