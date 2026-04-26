import { describe, it, expect } from 'vitest';
import { generateFacadeWindows, wrapFacadeMotionY } from './buildingFacade';

describe('generateFacadeWindows', () => {
  it('returns an empty grid if the rectangle is too small for any window', () => {
    expect(generateFacadeWindows(10, 200, 1)).toEqual([]);
    expect(generateFacadeWindows(200, 10, 1)).toEqual([]);
  });

  it('is deterministic per seed', () => {
    const a = generateFacadeWindows(300, 240, 7);
    const b = generateFacadeWindows(300, 240, 7);
    expect(a).toEqual(b);
  });

  it('places every window inside the requested rectangle', () => {
    const W = 300;
    const H = 240;
    const windows = generateFacadeWindows(W, H, 11);
    for (const w of windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + w.width).toBeLessThanOrEqual(W);
      expect(w.y + w.height).toBeLessThanOrEqual(H);
      expect(['lit', 'dim', 'dark']).toContain(w.state);
      expect(['warm', 'cool', 'green']).toContain(w.tint);
      expect(['plain', 'blinds', 'monitor']).toContain(w.kind);
    }
  });

  it('restricts non-plain kinds to lit windows', () => {
    // `dim` and `dark` always report `kind: 'plain'` so downstream rendering
    // doesn't have to special-case blinds/monitor on non-lit fills.
    const windows = generateFacadeWindows(600, 480, 19);
    for (const w of windows) {
      if (w.state !== 'lit') {
        expect(w.kind).toBe('plain');
      }
    }
  });

  it('emits all three tints across a decent sample', () => {
    const windows = generateFacadeWindows(600, 480, 101);
    const tints = new Set(windows.map((w) => w.tint));
    // Fixed seed + large sample reliably exercises every supported tint.
    expect(tints.has('warm')).toBe(true);
    expect(tints.has('cool')).toBe(true);
    expect(tints.has('green')).toBe(true);
  });

  it('emits a plausible mix of states (dark is majority)', () => {
    // Large rectangle → decent sample size.
    const windows = generateFacadeWindows(600, 480, 42);
    const total = windows.length;
    const lit = windows.filter((w) => w.state === 'lit').length;
    const dim = windows.filter((w) => w.state === 'dim').length;
    const dark = windows.filter((w) => w.state === 'dark').length;
    expect(lit + dim + dark).toBe(total);
    // Allow generous bands for the small-sample xorshift RNG.
    expect(dark / total).toBeGreaterThan(0.35);
    expect(lit / total).toBeLessThan(0.5);
  });

  it('respects the twinkle budget', () => {
    const windows = generateFacadeWindows(600, 480, 3, { twinkles: 2 });
    const twinkles = windows.filter((w) => w.twinkle).length;
    expect(twinkles).toBeLessThanOrEqual(2);
    // Every twinkler must be a lit window.
    for (const w of windows.filter((w) => w.twinkle)) {
      expect(w.state).toBe('lit');
    }
  });

  it('defaults to at most one twinkle when no opts passed', () => {
    const windows = generateFacadeWindows(600, 480, 5);
    const twinkles = windows.filter((w) => w.twinkle).length;
    expect(twinkles).toBeLessThanOrEqual(1);
  });

  it('respects the flicker budget and never flickers a dark/dim window', () => {
    const windows = generateFacadeWindows(600, 480, 9, { flickers: 3 });
    const flickers = windows.filter((w) => w.flicker).length;
    expect(flickers).toBeLessThanOrEqual(3);
    for (const w of windows.filter((w) => w.flicker)) {
      expect(w.state).toBe('lit');
    }
  });

  it('never marks the same window as both twinkle and flicker', () => {
    const windows = generateFacadeWindows(600, 480, 21, { twinkles: 4, flickers: 4 });
    for (const w of windows) {
      expect(w.twinkle && w.flicker).toBe(false);
    }
  });

  it('defaults to zero flickers when no opts passed', () => {
    const windows = generateFacadeWindows(600, 480, 13);
    expect(windows.filter((w) => w.flicker).length).toBe(0);
  });

  it('respects the motion budget and only moves visible non-effect windows', () => {
    const windows = generateFacadeWindows(600, 480, 27, {
      twinkles: 4,
      flickers: 4,
      movers: 8,
    });
    const movers = windows.filter((w) => w.motion);
    expect(movers.length).toBeLessThanOrEqual(8);
    for (const w of movers) {
      expect(w.state).not.toBe('dark');
      expect(w.twinkle).toBe(false);
      expect(w.flicker).toBe(false);
    }
  });

  it('emits bounded ride-motion metadata', () => {
    const windows = generateFacadeWindows(600, 480, 33, { movers: 20 });
    const movers = windows.filter((w) => w.motion);
    expect(movers.length).toBeGreaterThan(0);
    for (const w of movers) {
      expect(w.motion?.speedMultiplier).toBeGreaterThanOrEqual(0.85);
      expect(w.motion?.speedMultiplier).toBeLessThanOrEqual(1.75);
      expect(w.motion?.alpha).toBeGreaterThanOrEqual(0.34);
      expect(w.motion?.alpha).toBeLessThanOrEqual(0.92);
      expect(w.motion?.phase).toBeGreaterThanOrEqual(0);
      expect(w.motion?.phase).toBeLessThan(1);
    }
  });

  it('defaults to zero moving windows when no opts passed', () => {
    const windows = generateFacadeWindows(600, 480, 13);
    expect(windows.filter((w) => w.motion).length).toBe(0);
  });
});

describe('wrapFacadeMotionY', () => {
  it('leaves in-bounds center coordinates unchanged', () => {
    expect(wrapFacadeMotionY(50, 0, 100, 10)).toBe(50);
  });

  it('wraps above and below the band into valid center bounds', () => {
    for (const y of [-120, -5, 105, 240]) {
      const wrapped = wrapFacadeMotionY(y, 0, 100, 10);
      expect(wrapped).toBeGreaterThanOrEqual(5);
      expect(wrapped).toBeLessThanOrEqual(95);
    }
  });

  it('collapses to band center when the band is too short for motion', () => {
    expect(wrapFacadeMotionY(20, 10, 14, 10)).toBe(12);
  });
});
