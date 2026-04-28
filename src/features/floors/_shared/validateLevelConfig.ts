/**
 * Shared validator for `LevelConfig` objects.
 *
 * Checks structural shape, content-registry consistency, enemy-type legality,
 * and token coordinate bounds. Throws a descriptive error on the first
 * violation so callers (unit tests, dev-mode boot checks) get an actionable
 * message.
 *
 * This module has **zero** Phaser or scene dependencies — it only imports
 * constant data — so it is safe to use in pure Vitest unit tests without a
 * Phaser mock.
 */

import type { LevelConfig } from './LevelScene';
import { INFO_POINTS } from '../../../config/info';
import { GAME_WIDTH, GAME_HEIGHT } from '../../../config/gameConfig';

/** Every type string accepted by `LevelEnemySpawner`. */
export const VALID_ENEMY_TYPES = [
  'slime',
  'bot',
  'scope-creep',
  'astronaut',
  'tech-debt-ghost',
  'terrorist',
] as const;

export type EnemyType = (typeof VALID_ENEMY_TYPES)[number];

/**
 * Assert that `cfg` is a well-formed `LevelConfig`.
 *
 * Throws `Error` with a descriptive message on the first violation.
 * Returns `void` on success (tests call it inside `expect(() => ...).not.toThrow()`
 * or simply rely on the thrown error failing the test).
 */
export function assertValidLevelConfig(cfg: LevelConfig): void {
  // ---- Required arrays ----
  if (!Array.isArray(cfg.platforms)) {
    throw new Error('LevelConfig.platforms must be an array');
  }
  if (!Array.isArray(cfg.tokens)) {
    throw new Error('LevelConfig.tokens must be an array');
  }
  if (!Array.isArray(cfg.roomElevators)) {
    throw new Error('LevelConfig.roomElevators must be an array');
  }

  // ---- Required position objects (reject NaN/Infinity via Number.isFinite) ----
  if (!Number.isFinite(cfg.exitPosition?.x) || !Number.isFinite(cfg.exitPosition?.y)) {
    throw new Error('LevelConfig.exitPosition must have finite numeric x and y');
  }
  if (!Number.isFinite(cfg.playerStart?.x) || !Number.isFinite(cfg.playerStart?.y)) {
    throw new Error('LevelConfig.playerStart must have finite numeric x and y');
  }

  // ---- Enemy types ----
  for (const enemy of cfg.enemies ?? []) {
    if (!(VALID_ENEMY_TYPES as readonly string[]).includes(enemy.type)) {
      throw new Error(
        `Unknown enemy type "${enemy.type}". ` +
          `Expected one of: ${VALID_ENEMY_TYPES.join(', ')}`,
      );
    }
  }

  // ---- InfoPoint content-registry consistency ----
  for (const point of cfg.infoPoints ?? []) {
    if (!Object.prototype.hasOwnProperty.call(INFO_POINTS, point.contentId)) {
      throw new Error(
        `infoPoints contentId "${point.contentId}" is not registered in INFO_POINTS. ` +
          `Check src/config/info/ and ensure the entry is re-exported from the barrel.`,
      );
    }
  }

  // ---- Token bounds (reject NaN/Infinity; use indexed loop for correct error messages) ----
  for (let i = 0; i < cfg.tokens.length; i++) {
    const token = cfg.tokens[i]!;
    if (!Number.isFinite(token.x) || token.x < 0 || token.x > GAME_WIDTH) {
      throw new Error(
        `Token at index ${i} has x=${token.x} ` +
          `outside world bounds [0, ${GAME_WIDTH}]`,
      );
    }
    if (!Number.isFinite(token.y) || token.y < 0 || token.y > GAME_HEIGHT) {
      throw new Error(
        `Token at index ${i} has y=${token.y} ` +
          `outside world bounds [0, ${GAME_HEIGHT}]`,
      );
    }
  }
}
