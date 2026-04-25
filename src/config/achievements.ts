/**
 * Achievement definitions.
 *
 * Each `AchievementDef` describes a single achievement: its id, display
 * strings, icon character, and a pure `check` predicate that returns true
 * when the achievement should be unlocked.
 *
 * `check` receives a snapshot of the current game state assembled by
 * `AchievementManager.checkAll`. Add new achievements here; the manager
 * and dialog will pick them up automatically.
 */

import { FLOORS, FloorId } from './gameConfig';
import { LEVEL_DATA } from './levelData';
import { QUIZ_DATA } from './quiz';
import { INFO_POINTS } from './info';

export interface AchievementCheckState {
  totalAU: number;
  visitedFloors: Set<FloorId>;
  collectedTokens: Record<FloorId, Set<number>>;
  /** IDs of all quizzes that have been passed. */
  passedQuizIds: string[];
  /** IDs of all info points that have been read. */
  seenInfoIds: string[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Emoji / text icon shown in the dialog and toast. */
  icon: string;
  /**
   * When true the achievement name and description are hidden in the list
   * until it is unlocked — creates a sense of mystery for hard goals.
   */
  secret?: boolean;
  check: (state: AchievementCheckState) => boolean;
}

/** Total quizzes in the game that can actually be passed. */
const TOTAL_QUIZZES = Object.keys(QUIZ_DATA).length;

/** Total info points that can be read. */
const TOTAL_INFO = Object.keys(INFO_POINTS).length;

/** Total collectible tokens across all floors. */
const TOTAL_TOKENS = Object.values(LEVEL_DATA).reduce((sum, f) => sum + f.totalAU, 0);

/** All floor IDs that have tokens. */
const TOKEN_FLOORS = Object.values(LEVEL_DATA)
  .filter((f) => f.totalAU > 0)
  .map((f) => f.id);

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── AU milestones ────────────────────────────────────────────────────────
  {
    id: 'first-au',
    title: 'First Steps',
    description: 'Collect your first Architecture Unit.',
    icon: '⭐',
    check: ({ totalAU }) => totalAU >= 1,
  },
  {
    id: 'au-10',
    title: 'Budding Architect',
    description: 'Accumulate 10 AU.',
    icon: '🏗️',
    check: ({ totalAU }) => totalAU >= 10,
  },
  {
    id: 'au-25',
    title: 'Senior Architect',
    description: 'Accumulate 25 AU.',
    icon: '🎓',
    check: ({ totalAU }) => totalAU >= 25,
  },

  // ── Floor exploration ────────────────────────────────────────────────────
  {
    id: 'floor-all',
    title: 'Elevator Rider',
    description: 'Visit every floor in the building.',
    icon: '🛗',
    check: ({ visitedFloors }) =>
      [FLOORS.LOBBY, FLOORS.PLATFORM_TEAM, FLOORS.BUSINESS, FLOORS.EXECUTIVE]
        .every((f) => visitedFloors.has(f)),
  },

  // ── Info panels ──────────────────────────────────────────────────────────
  {
    id: 'info-first',
    title: 'Curious Mind',
    description: 'Read your first info panel.',
    icon: '📖',
    check: ({ seenInfoIds }) => seenInfoIds.length >= 1,
  },
  {
    id: 'info-5',
    title: 'Knowledge Seeker',
    description: 'Read 5 info panels.',
    icon: '📚',
    check: ({ seenInfoIds }) => seenInfoIds.length >= 5,
  },
  {
    id: 'info-all',
    title: 'Information Architect',
    description: `Read all ${TOTAL_INFO} info panels in the building.`,
    icon: '🗃️',
    check: ({ seenInfoIds }) => seenInfoIds.length >= TOTAL_INFO,
  },

  // ── Quizzes ──────────────────────────────────────────────────────────────
  {
    id: 'quiz-first',
    title: 'Quiz Taker',
    description: 'Pass your first quiz.',
    icon: '✅',
    check: ({ passedQuizIds }) => passedQuizIds.length >= 1,
  },
  {
    id: 'quiz-3',
    title: 'Quiz Expert',
    description: 'Pass 3 quizzes.',
    icon: '🧠',
    check: ({ passedQuizIds }) => passedQuizIds.length >= 3,
  },
  ...(TOTAL_QUIZZES >= 5
    ? [{
        id: 'quiz-all',
        title: 'Quiz Master',
        description: `Pass all ${TOTAL_QUIZZES} quizzes.`,
        icon: '🏆',
        check: ({ passedQuizIds }) =>
          passedQuizIds.length >= TOTAL_QUIZZES,
      } satisfies AchievementDef]
    : []),

  // ── Token collecting ─────────────────────────────────────────────────────
  ...TOKEN_FLOORS.map((floorId): AchievementDef => {
    const fd = LEVEL_DATA[floorId];
    return {
      id: `tokens-floor-${floorId}`,
      title: `${fd.name} Complete`,
      description: `Collect all ${fd.totalAU} tokens on the ${fd.name} floor.`,
      icon: '🪙',
      check: ({ collectedTokens }) =>
        (collectedTokens[floorId]?.size ?? 0) >= fd.totalAU,
    };
  }),
  ...(TOTAL_TOKENS > 0
    ? [{
        id: 'tokens-all',
        title: 'Grand Architect',
        description: `Collect every token in the building (${TOTAL_TOKENS} total).`,
        icon: '👑',
        secret: true,
        check: ({ collectedTokens }) =>
          TOKEN_FLOORS.every(
            (f) => (collectedTokens[f]?.size ?? 0) >= LEVEL_DATA[f].totalAU,
          ),
      } satisfies AchievementDef]
    : []),
];
