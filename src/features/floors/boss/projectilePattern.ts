import { SeededRandom } from '../../../systems/SeededRandom';
import type { BossPhase } from './bossPhaseSelector';

export const PROJECTILE_PATTERNS = {
  CENTER_SPREAD: 'center-spread',
  OUTSIDE_IN: 'outside-in',
  INSIDE_OUT: 'inside-out',
} as const;

export type ProjectilePattern = (typeof PROJECTILE_PATTERNS)[keyof typeof PROJECTILE_PATTERNS];

export interface SelectedProjectilePattern {
  pattern: ProjectilePattern;
  yOffsets: readonly number[];
}

const PATTERN_OFFSETS: Readonly<Record<ProjectilePattern, readonly number[]>> = {
  [PROJECTILE_PATTERNS.CENTER_SPREAD]: [-30, 0, 30],
  [PROJECTILE_PATTERNS.OUTSIDE_IN]: [-30, 30, 0],
  [PROJECTILE_PATTERNS.INSIDE_OUT]: [0, -30, 30],
};

const PHASE_PATTERNS: Readonly<Record<BossPhase, readonly ProjectilePattern[]>> = {
  1: [PROJECTILE_PATTERNS.CENTER_SPREAD],
  2: [PROJECTILE_PATTERNS.CENTER_SPREAD, PROJECTILE_PATTERNS.OUTSIDE_IN],
  3: [PROJECTILE_PATTERNS.CENTER_SPREAD, PROJECTILE_PATTERNS.OUTSIDE_IN, PROJECTILE_PATTERNS.INSIDE_OUT],
};

export function selectProjectilePattern(phase: BossPhase, rng: SeededRandom): SelectedProjectilePattern {
  const choices = PHASE_PATTERNS[phase];
  const picked = choices[rng.nextInt(0, choices.length - 1)]!;
  return {
    pattern: picked,
    yOffsets: PATTERN_OFFSETS[picked],
  };
}
