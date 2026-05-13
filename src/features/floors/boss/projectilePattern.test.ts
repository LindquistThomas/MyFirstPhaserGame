import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../../systems/SeededRandom';
import { selectProjectilePattern } from './projectilePattern';

describe('projectilePattern', () => {
  it('is deterministic for a fixed seed', () => {
    const a = new SeededRandom(424242);
    const b = new SeededRandom(424242);

    const seqA = Array.from({ length: 20 }, () => selectProjectilePattern(3, a).pattern);
    const seqB = Array.from({ length: 20 }, () => selectProjectilePattern(3, b).pattern);

    expect(seqA).toEqual(seqB);
  });

  it('keeps phase 1 to the legacy single pattern', () => {
    const rng = new SeededRandom(2026);
    const sample = Array.from({ length: 20 }, () => selectProjectilePattern(1, rng).pattern);
    expect(new Set(sample)).toEqual(new Set(['center-spread']));
  });

  it('is roughly even across phase-3 patterns over 1k samples', () => {
    const rng = new SeededRandom(1337);
    const counts = new Map<string, number>();

    for (let i = 0; i < 1000; i++) {
      const pick = selectProjectilePattern(3, rng).pattern;
      counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }

    const values = [...counts.values()];
    expect(values).toHaveLength(3);
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(min).toBeGreaterThanOrEqual(250);
    expect(max).toBeLessThanOrEqual(420);
  });
});
