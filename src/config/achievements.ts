/**
 * Achievement definitions for the game.
 *
 * Each entry has a stable `id`, a short `label` (shown in toasts and the
 * dialog title row), and a longer `description` shown in the detail row.
 * `secret` achievements are hidden in the dialog until unlocked.
 */

export type AchievementId =
  | 'au-5' | 'au-15' | 'au-30' | 'au-50'
  | 'floors-3' | 'floors-all'
  | 'info-1' | 'info-5' | 'info-all'
  | 'quiz-1' | 'quiz-5' | 'quiz-all'
  | 'tokens-10' | 'tokens-25'
  | 'grand-architect';

export interface AchievementDef {
  id: AchievementId;
  label: string;
  description: string;
  /** Hidden in the dialog until unlocked. */
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // AU milestones
  { id: 'au-5',       label: 'First Steps',       description: 'Collect 5 AU.' },
  { id: 'au-15',      label: 'On the Way Up',      description: 'Collect 15 AU.' },
  { id: 'au-30',      label: 'Architecture Units', description: 'Collect 30 AU.' },
  { id: 'au-50',      label: 'Senior Architect',   description: 'Collect 50 AU.' },
  // Floor exploration
  { id: 'floors-3',   label: 'Frequent Visitor',   description: 'Visit 3 different floors.' },
  { id: 'floors-all', label: 'Building Expert',    description: 'Visit every floor in the building.' },
  // Info panels
  { id: 'info-1',     label: 'Curious Mind',       description: 'Read your first info panel.' },
  { id: 'info-5',     label: 'Knowledge Seeker',   description: 'Read 5 info panels.' },
  { id: 'info-all',   label: 'Fully Informed',     description: 'Read every info panel in the building.' },
  // Quizzes
  { id: 'quiz-1',     label: 'First Quiz',         description: 'Pass your first quiz.' },
  { id: 'quiz-5',     label: 'Quiz Veteran',       description: 'Pass 5 quizzes.' },
  { id: 'quiz-all',   label: 'Quiz Master',        description: 'Pass every quiz in the building.' },
  // Token collection
  { id: 'tokens-10',  label: 'Token Collector',    description: 'Collect 10 tokens.' },
  { id: 'tokens-25',  label: 'Token Hoarder',      description: 'Collect 25 tokens.' },
  // Secret
  {
    id: 'grand-architect',
    label: 'Grand Architect',
    description: 'Unlock all other achievements.',
    secret: true,
  },
];

/** Convenience map keyed by id. */
export const ACHIEVEMENT_MAP = new Map<AchievementId, AchievementDef>(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** All non-secret achievement ids — Grand Architect requires all of these. */
export const NON_SECRET_IDS: AchievementId[] = ACHIEVEMENTS
  .filter((a) => !a.secret)
  .map((a) => a.id);
