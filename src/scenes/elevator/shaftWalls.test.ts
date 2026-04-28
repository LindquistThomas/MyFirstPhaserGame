/**
 * Unit tests for the pure helpers in `shaftWalls`. The Phaser drawing
 * functions are exercised in the Playwright visual-regression suite.
 */
import { describe, it, expect } from 'vitest';
import { generateDustMoteSpecs } from './shaftWalls';

describe('generateDustMoteSpecs', () => {
  it('returns the requested count', () => {
    expect(generateDustMoteSpecs(14, 0, 200, 100, 500)).toHaveLength(14);
    expect(generateDustMoteSpecs(0, 0, 200, 100, 500)).toHaveLength(0);
  });

  it('places every mote within the x bounds', () => {
    const xMin = 50;
    const xMax = 300;
    const specs = generateDustMoteSpecs(40, xMin, xMax, 0, 1000);
    for (const s of specs) {
      expect(s.x).toBeGreaterThanOrEqual(xMin);
      expect(s.x).toBeLessThanOrEqual(xMax);
    }
  });

  it('places every mote within the vertical shaft bounds', () => {
    const top = 200;
    const shaftH = 800;
    // Motes are placed in [top+40, top+shaftH-40]; Math.round can hit the upper edge.
    const specs = generateDustMoteSpecs(40, 0, 300, top, shaftH);
    for (const s of specs) {
      expect(s.y).toBeGreaterThanOrEqual(top + 40);
      expect(s.y).toBeLessThanOrEqual(top + shaftH - 40);
    }
  });

  it('is deterministic: same shaftH → same specs', () => {
    const a = generateDustMoteSpecs(14, 50, 300, 100, 960);
    const b = generateDustMoteSpecs(14, 50, 300, 100, 960);
    expect(a).toEqual(b);
  });

  it('differs when shaftH changes (different seed)', () => {
    const a = generateDustMoteSpecs(14, 50, 300, 100, 960);
    const b = generateDustMoteSpecs(14, 50, 300, 100, 961);
    expect(a).not.toEqual(b);
  });

  it('produces only size 1 or 2 motes', () => {
    const specs = generateDustMoteSpecs(100, 0, 500, 0, 2000);
    for (const s of specs) {
      expect([1, 2]).toContain(s.size);
    }
  });

  it('baseAlpha is within the [0.18, 0.36] band', () => {
    const specs = generateDustMoteSpecs(100, 0, 500, 0, 2000);
    for (const s of specs) {
      expect(s.baseAlpha).toBeGreaterThanOrEqual(0.18);
      expect(s.baseAlpha).toBeLessThanOrEqual(0.36);
    }
  });

  it('delay is always less than duration', () => {
    const specs = generateDustMoteSpecs(50, 0, 500, 0, 1000);
    for (const s of specs) {
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThan(s.duration);
    }
  });
});
