import { describe, it, expect } from 'vitest';
import { lerpColor, generateStars } from './skyBackdrop';

describe('skyBackdrop helpers', () => {
  describe('lerpColor', () => {
    it('returns endpoint colours at t=0 and t=1', () => {
      expect(lerpColor(0x000000, 0xffffff, 0)).toBe(0x000000);
      expect(lerpColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    });

    it('interpolates each channel independently at midpoint', () => {
      // 0x204060 → (32, 64, 96);  0x80c0e0 → (128, 192, 224)
      //   mid → (80, 128, 160) = 0x5080a0
      expect(lerpColor(0x204060, 0x80c0e0, 0.5)).toBe(0x5080a0);
    });

    it('clamps t outside [0, 1]', () => {
      expect(lerpColor(0x000000, 0xffffff, -1)).toBe(0x000000);
      expect(lerpColor(0x000000, 0xffffff, 2)).toBe(0xffffff);
    });
  });

  describe('generateStars', () => {
    it('returns the requested number of stars', () => {
      expect(generateStars(40, 1280, 720)).toHaveLength(40);
      expect(generateStars(0, 1280, 720)).toHaveLength(0);
    });

    it('places every star inside the requested rectangle', () => {
      const stars = generateStars(200, 1280, 720, 42);
      for (const s of stars) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThan(1280);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThan(720);
        expect(s.alpha).toBeGreaterThanOrEqual(0.5);
        expect(s.alpha).toBeLessThanOrEqual(1.0);
        expect([1, 2]).toContain(s.size);
      }
    });

    it('is deterministic for a given seed', () => {
      const a = generateStars(30, 1000, 500, 7);
      const b = generateStars(30, 1000, 500, 7);
      expect(a).toEqual(b);
    });

    it('differs across seeds', () => {
      const a = generateStars(30, 1000, 500, 7);
      const b = generateStars(30, 1000, 500, 99);
      expect(a).not.toEqual(b);
    });

    it('mixes bright and dim stars (bright is a minority)', () => {
      const stars = generateStars(500, 1280, 720, 1);
      const bright = stars.filter((s) => s.bright).length;
      // Expect roughly 15% bright; allow a generous band for the xorshift RNG.
      expect(bright).toBeGreaterThan(20);
      expect(bright).toBeLessThan(200);
      // Bright stars are 2px, dim are 1px — keep that mapping honest.
      for (const s of stars) {
        expect(s.size).toBe(s.bright ? 2 : 1);
      }
    });
  });
});
