import { describe, expect, it } from 'vitest';
import { SeededRandom } from './SeededRandom';

describe('SeededRandom', () => {
  it('produces reproducible float sequence for a known seed', () => {
    const rng = new SeededRandom(20260508);
    expect(rng.nextFloat()).toBeCloseTo(0.11170893721282482, 12);
    expect(rng.nextFloat()).toBeCloseTo(0.3251244626007974, 12);
    expect(rng.nextFloat()).toBeCloseTo(0.6743355146609247, 12);
  });

  it('produces reproducible integer sequence for a known seed', () => {
    const rng = new SeededRandom(20260508);
    expect(rng.nextInt(-60, 60)).toBe(-47);
    expect(rng.nextInt(-60, 60)).toBe(-21);
    expect(rng.nextInt(0, 5)).toBe(4);
  });

  it('returns identical sequences for identical seeds', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    expect([a.nextFloat(), a.nextFloat(), a.nextFloat()]).toEqual([
      b.nextFloat(),
      b.nextFloat(),
      b.nextFloat(),
    ]);
  });
});

