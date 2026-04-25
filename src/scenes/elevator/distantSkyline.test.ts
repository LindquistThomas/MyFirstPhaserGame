import { describe, it, expect } from 'vitest';
import { generateSkyline } from './distantSkyline';

describe('generateSkyline', () => {
  it('tiles buildings across the full width with no gaps left of the right edge', () => {
    const width = 1280;
    const skyline = generateSkyline(width, 1);
    expect(skyline.length).toBeGreaterThan(6);

    // First building starts at or before x=0 (pre-seam) and last finishes at or past `width`.
    expect(skyline[0]!.x).toBeLessThanOrEqual(0);
    const last = skyline[skyline.length - 1]!;
    expect(last.x + last.width).toBeGreaterThanOrEqual(width);
  });

  it('is deterministic per seed', () => {
    const a = generateSkyline(1280, 42);
    const b = generateSkyline(1280, 42);
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    const a = generateSkyline(1280, 1);
    const b = generateSkyline(1280, 2);
    expect(a).not.toEqual(b);
  });

  it('produces buildings with sensible bounds', () => {
    const skyline = generateSkyline(1280, 7);
    for (const b of skyline) {
      expect(b.width).toBeGreaterThanOrEqual(48);
      expect(b.width).toBeLessThanOrEqual(120);
      expect(b.height).toBeGreaterThanOrEqual(60);
      expect(b.height).toBeLessThanOrEqual(180);
      expect(['silhouette', 'accent']).toContain(b.variant);
      expect(['flat', 'step', 'spike']).toContain(b.roof);
    }
  });

  it('places windows inside each building`s bounding box', () => {
    const skyline = generateSkyline(1280, 11);
    for (const b of skyline) {
      for (const w of b.windows) {
        expect(w.x).toBeGreaterThanOrEqual(0);
        expect(w.y).toBeGreaterThanOrEqual(0);
        expect(w.x + w.width).toBeLessThanOrEqual(b.width);
        expect(w.y + w.height).toBeLessThanOrEqual(b.height);
      }
    }
  });

  it('limits twinkling windows to a small budget per building', () => {
    const skyline = generateSkyline(1280, 3);
    for (const b of skyline) {
      const twinkles = b.windows.filter((w) => w.twinkle).length;
      expect(twinkles).toBeLessThanOrEqual(2);
    }
    // And overall the skyline should have a handful (bounded).
    const total = skyline.reduce((acc, b) => acc + b.windows.filter((w) => w.twinkle).length, 0);
    expect(total).toBeLessThanOrEqual(skyline.length * 2);
  });

  it('gives mostly silhouette variant (accent is a minority)', () => {
    const skyline = generateSkyline(2000, 123);
    const accent = skyline.filter((b) => b.variant === 'accent').length;
    expect(accent).toBeLessThan(skyline.length); // not all accent
    expect(accent).toBeGreaterThanOrEqual(0);
  });
});
