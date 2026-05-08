import { TILE_SIZE } from '../../../config/gameConfig';
import { SeededRandom } from '../../../systems/SeededRandom';
import type { LevelConfig } from './LevelScene';

const TOKEN_JITTER_PX = 24;
const ENEMY_JITTER_PX = 60;
const MIN_PATROL_SPAN_PX = 80;

function withSeed(baseSeed: number, salt: number): SeededRandom {
  return new SeededRandom((baseSeed ^ Math.imul(salt, 0x9e3779b1)) >>> 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffleInPlace<T>(arr: T[], rng: SeededRandom): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function getFloorExtent(config: LevelConfig): { minX: number; maxX: number } {
  const ranges: Array<{ minX: number; maxX: number }> = [];
  for (const p of config.platforms) {
    ranges.push({ minX: p.x, maxX: p.x + p.width * TILE_SIZE });
  }
  for (const c of config.catwalks ?? []) {
    ranges.push({ minX: c.x, maxX: c.x + c.width });
  }
  if (ranges.length === 0) return { minX: 0, maxX: 1280 };
  return {
    minX: Math.min(...ranges.map((r) => r.minX)),
    maxX: Math.max(...ranges.map((r) => r.maxX)),
  };
}

function overrideTokens(config: LevelConfig, seed: number): LevelConfig['tokens'] {
  if (config.tokens.length <= 1) {
    return config.tokens.map((t, i) => ({ ...t, index: t.index ?? i }));
  }

  const rng = withSeed(seed, 11);
  const bandMin = Math.min(...config.tokens.map((t) => t.x));
  const bandMax = Math.max(...config.tokens.map((t) => t.x));
  const shuffled = config.tokens.map((t, i) => ({ ...t, index: t.index ?? i }));
  shuffleInPlace(shuffled, rng);
  return shuffled.map((t) => ({
    ...t,
    x: clamp(t.x + rng.nextInt(-TOKEN_JITTER_PX, TOKEN_JITTER_PX), bandMin, bandMax),
  }));
}

function overrideEnemies(config: LevelConfig, seed: number): LevelConfig['enemies'] {
  if (!config.enemies?.length) return config.enemies;
  const rng = withSeed(seed, 23);
  const extent = getFloorExtent(config);
  return config.enemies.map((e) => {
    let minX = (e.minX ?? e.x - 160) + rng.nextInt(-ENEMY_JITTER_PX, ENEMY_JITTER_PX);
    let maxX = (e.maxX ?? e.x + 160) + rng.nextInt(-ENEMY_JITTER_PX, ENEMY_JITTER_PX);
    minX = clamp(minX, extent.minX, extent.maxX);
    maxX = clamp(maxX, extent.minX, extent.maxX);
    if (maxX < minX) [minX, maxX] = [maxX, minX];
    if (maxX - minX < MIN_PATROL_SPAN_PX) {
      const center = clamp((minX + maxX) / 2, extent.minX, extent.maxX);
      minX = clamp(center - MIN_PATROL_SPAN_PX / 2, extent.minX, extent.maxX);
      maxX = clamp(center + MIN_PATROL_SPAN_PX / 2, extent.minX, extent.maxX);
    }
    const x = clamp(e.x, minX, maxX);
    return { ...e, x, minX, maxX };
  });
}

function toggleSingleConsumable(config: LevelConfig, seed: number): Pick<LevelConfig, 'coffees' | 'fridges'> {
  const coffees = (config.coffees ?? []).map((c) => ({ ...c }));
  const fridges = (config.fridges ?? []).map((f) => ({ ...f }));
  const pool: Array<{ kind: 'coffee' | 'fridge'; index: number }> = [
    ...coffees.map((_v, i) => ({ kind: 'coffee' as const, index: i })),
    ...fridges.map((_v, i) => ({ kind: 'fridge' as const, index: i })),
  ];
  if (pool.length === 0) return { coffees, fridges };
  const rng = withSeed(seed, 37);
  const picked = pool[rng.nextInt(0, pool.length - 1)]!;
  if (picked.kind === 'coffee') coffees.splice(picked.index, 1);
  else fridges.splice(picked.index, 1);
  return { coffees, fridges };
}

export function applyDailyChallengeLayout(config: LevelConfig, seed: number): LevelConfig {
  const tokens = overrideTokens(config, seed);
  const enemies = overrideEnemies(config, seed);
  const { coffees, fridges } = toggleSingleConsumable(config, seed);
  return {
    ...config,
    tokens,
    enemies,
    coffees,
    fridges,
  };
}

