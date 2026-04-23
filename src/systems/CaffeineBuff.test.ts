import { describe, it, expect } from 'vitest';
import { CaffeineBuff } from './CaffeineBuff';

describe('CaffeineBuff', () => {
  it('is inactive by default', () => {
    const b = new CaffeineBuff();
    expect(b.isActive(0)).toBe(false);
    expect(b.remaining(0)).toBe(0);
    expect(b.ratio(0)).toBe(0);
  });

  it('activates for the given window', () => {
    const b = new CaffeineBuff();
    b.activate(1000, 6000);
    expect(b.isActive(1000)).toBe(true);
    expect(b.isActive(4000)).toBe(true);
    expect(b.isActive(6999)).toBe(true);
    expect(b.isActive(7000)).toBe(false);
  });

  it('reports remaining time that decays to zero', () => {
    const b = new CaffeineBuff();
    b.activate(0, 5000);
    expect(b.remaining(0)).toBe(5000);
    expect(b.remaining(2000)).toBe(3000);
    expect(b.remaining(5000)).toBe(0);
    expect(b.remaining(9000)).toBe(0);
  });

  it('reports ratio in 0..1 and clamps outside the window', () => {
    const b = new CaffeineBuff();
    b.activate(0, 4000);
    expect(b.ratio(0)).toBe(1);
    expect(b.ratio(2000)).toBeCloseTo(0.5);
    expect(b.ratio(4000)).toBe(0);
    expect(b.ratio(10000)).toBe(0);
  });

  it('re-activating refreshes the window (no stacking)', () => {
    const b = new CaffeineBuff();
    b.activate(0, 4000);
    // Half-elapsed, then refresh at t=2000 with a 4s window.
    b.activate(2000, 4000);
    expect(b.remaining(2000)).toBe(4000);
    expect(b.isActive(5999)).toBe(true);
    expect(b.isActive(6000)).toBe(false);
  });

  it('clear() immediately ends the buff', () => {
    const b = new CaffeineBuff();
    b.activate(0, 6000);
    b.clear();
    expect(b.isActive(100)).toBe(false);
    expect(b.ratio(100)).toBe(0);
  });
});
