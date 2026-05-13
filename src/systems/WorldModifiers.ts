import type { GameMode } from './GameMode';

export interface WorldModifiers {
  enemySpeedMultiplier: number;
  enemyContactDamageMultiplier: number;
  bossHpMultiplier: number;
  hardQuizOnly: boolean;
}

export const NORMAL_WORLD_MODIFIERS: WorldModifiers = {
  enemySpeedMultiplier: 1,
  enemyContactDamageMultiplier: 1,
  bossHpMultiplier: 1,
  hardQuizOnly: false,
};

export const NGPLUS_WORLD_MODIFIERS: WorldModifiers = {
  enemySpeedMultiplier: 1.25,
  enemyContactDamageMultiplier: 1.5,
  bossHpMultiplier: 1.25,
  hardQuizOnly: true,
};

export function getWorldModifiers(mode: GameMode): WorldModifiers {
  return mode === 'ngplus' ? NGPLUS_WORLD_MODIFIERS : NORMAL_WORLD_MODIFIERS;
}
