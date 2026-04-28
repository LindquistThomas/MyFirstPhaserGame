/**
 * Unit tests for the pure helpers in `platformTiles`. The Phaser drawing
 * functions are exercised in the Playwright visual-regression suite.
 */
import { describe, it, expect } from 'vitest';
import { computeShaftWallSegments, formatFloorLabel } from './platformTiles';

describe('formatFloorLabel', () => {
  it('joins floor number and room name with a middle dot', () => {
    expect(formatFloorLabel('F1', 'Platform Team')).toBe('F1 \u00B7 Platform Team');
  });

  it('works with numeric-only strings', () => {
    expect(formatFloorLabel('4', 'Executive')).toBe('4 \u00B7 Executive');
  });

  it('preserves leading/trailing spaces in the parts', () => {
    // Callers are responsible for trimming; the function does not strip.
    expect(formatFloorLabel(' F2 ', ' Finance ')).toBe(' F2  \u00B7  Finance ');
  });
});

describe('computeShaftWallSegments', () => {
  const openingAbove = 120;
  const openingBelow = 24;

  it('returns a single full-height segment when there are no walkYs', () => {
    const segs = computeShaftWallSegments([], 0, 800, openingAbove, openingBelow);
    expect(segs).toEqual([{ yTop: 0, yBottom: 800 }]);
  });

  it('cuts an opening at each walkY', () => {
    // walkYs at 400.  Expect:
    //   segment 1: [0, 400 - 120) = [0, 280)
    //   opening:   [280, 400 + 24) = invisible
    //   segment 2: [424, 800)
    const segs = computeShaftWallSegments([400], 0, 800, openingAbove, openingBelow);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ yTop: 0, yBottom: 280 });
    expect(segs[1]).toEqual({ yTop: 424, yBottom: 800 });
  });

  it('handles multiple walkYs producing interleaved segments', () => {
    const segs = computeShaftWallSegments([300, 600], 0, 1000, openingAbove, openingBelow);
    // [0,180), opening, [324,480), opening, [624,1000)
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ yTop: 0,   yBottom: 180 });
    expect(segs[1]).toEqual({ yTop: 324, yBottom: 480 });
    expect(segs[2]).toEqual({ yTop: 624, yBottom: 1000 });
  });

  it('omits zero-height segments when walkY is at the shaft top', () => {
    const segs = computeShaftWallSegments(
      [openingAbove],   // walkY exactly at the opening-above distance from top
      0,
      600,
      openingAbove,
      openingBelow,
    );
    // yBottom for first segment = walkY - openingAbove = openingAbove - openingAbove = 0
    // => height is 0, should be omitted
    const hasZeroHeight = segs.some((s) => s.yBottom <= s.yTop);
    expect(hasZeroHeight).toBe(false);
  });

  it('the walkYs must be sorted for correct output', () => {
    const segsAsc = computeShaftWallSegments([200, 500], 0, 800, 10, 10);
    const segsDesc = computeShaftWallSegments([500, 200], 0, 800, 10, 10);
    // Sorted input should produce distinct, non-overlapping segments
    expect(segsAsc).not.toEqual(segsDesc);
  });

  it('covers the full shaft with no gaps outside openings', () => {
    const walkYs = [300, 600, 900];
    const shaftTop = 0;
    const shaftBottom = 1200;
    const above = 50;
    const below = 20;
    const segs = computeShaftWallSegments(walkYs, shaftTop, shaftBottom, above, below);

    // Reconstruct the covered ranges and verify they add up correctly.
    // Each opening spans [walkY - above, walkY + below).
    const covered = segs.reduce((acc, s) => acc + (s.yBottom - s.yTop), 0);
    const openings = walkYs.length * (above + below);
    expect(covered + openings).toBe(shaftBottom - shaftTop);
  });
});
