import { describe, expect, it } from 'vitest';
import { selectPhase } from './bossPhaseSelector';

describe('bossPhaseSelector', () => {
  it('returns phase 1 above the phase-2 threshold', () => {
    expect(selectPhase(10, 0)).toBe(1);
    expect(selectPhase(8, 3)).toBe(1);
  });

  it('returns phase 2 from hp 7 through hp 4', () => {
    expect(selectPhase(7, 2)).toBe(2);
    expect(selectPhase(5, 0)).toBe(2);
    expect(selectPhase(4, 1)).toBe(2);
  });

  it('returns phase 3 at hp <= 3', () => {
    expect(selectPhase(3, 2)).toBe(3);
    expect(selectPhase(1, 2)).toBe(3);
    expect(selectPhase(0, 2)).toBe(3);
  });

  it('clamps negative and non-finite hp to phase 3', () => {
    expect(selectPhase(-1, 1)).toBe(3);
    expect(selectPhase(Number.NaN, 1)).toBe(3);
    expect(selectPhase(Number.POSITIVE_INFINITY, 1)).toBe(1);
  });
});
