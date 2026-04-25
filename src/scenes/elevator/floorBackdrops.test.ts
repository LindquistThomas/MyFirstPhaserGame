/**
 * Unit tests for `floorBackdrops` spec generators. We only test the pure
 * helpers — the Phaser renderer is exercised in Playwright integration /
 * visual specs.
 */
import { describe, it, expect } from 'vitest';
import { FLOORS } from '../../config/gameConfig';
import {
  specForBand,
  type FloorBackdropBand,
  type SideRect,
  type BlockedRange,
} from './floorBackdrops';

const band = (floorId: number, yTop = 0, yBottom = 200): FloorBackdropBand => ({
  floorId: floorId as FloorBackdropBand['floorId'],
  yTop,
  yBottom,
});

const rect = (xLeft = 0, xRight = 240, yTop = 0, yBottom = 200): SideRect => ({
  xLeft,
  xRight,
  yTop,
  yBottom,
});

describe('floorBackdrops / specForBand', () => {
  it('is deterministic for the same floor + side + rect', () => {
    const a = specForBand(band(FLOORS.PLATFORM_TEAM), 'left', rect());
    const b = specForBand(band(FLOORS.PLATFORM_TEAM), 'left', rect());
    expect(a).toEqual(b);
  });

  it('returns different specs for left vs right of split-room floors', () => {
    const left = specForBand(band(FLOORS.PLATFORM_TEAM), 'left', rect());
    const right = specForBand(band(FLOORS.PLATFORM_TEAM), 'right', rect());
    // Platform left = server racks (has blink LEDs); right = whiteboard (no blinks).
    expect(left.blinkRects.length).toBeGreaterThan(0);
    expect(right.blinkRects.length).toBe(0);
    expect(left.staticRects).not.toEqual(right.staticRects);
  });

  it('returns different specs for left vs right of business floor', () => {
    const left = specForBand(band(FLOORS.BUSINESS), 'left', rect());
    const right = specForBand(band(FLOORS.BUSINESS), 'right', rect());
    // Both sides have blinks (chart on left, ticket dot on right) but
    // the static layouts must differ.
    expect(left.staticRects).not.toEqual(right.staticRects);
  });

  it('returns empty spec for unknown floor ids', () => {
    const spec = specForBand(band(999), 'left', rect());
    expect(spec.staticRects).toEqual([]);
    expect(spec.blinkRects).toEqual([]);
  });

  it('returns empty spec when the side rect is too small', () => {
    const tiny: SideRect = { xLeft: 0, xRight: 30, yTop: 0, yBottom: 30 };
    for (const floor of Object.values(FLOORS)) {
      const spec = specForBand(band(floor), 'left', tiny);
      expect(spec.staticRects).toEqual([]);
      expect(spec.blinkRects).toEqual([]);
    }
  });

  it('keeps every rect strictly inside the supplied side rect', () => {
    const r = rect(40, 280, 50, 250);
    for (const floor of Object.values(FLOORS)) {
      for (const side of ['left', 'right'] as const) {
        const spec = specForBand(band(floor, r.yTop, r.yBottom), side, r);
        for (const rectSpec of [...spec.staticRects, ...spec.blinkRects]) {
          expect(rectSpec.x).toBeGreaterThanOrEqual(r.xLeft);
          expect(rectSpec.x + rectSpec.width).toBeLessThanOrEqual(r.xRight);
          expect(rectSpec.y).toBeGreaterThanOrEqual(r.yTop);
          expect(rectSpec.y + rectSpec.height).toBeLessThanOrEqual(r.yBottom);
        }
      }
    }
  });

  it('PRODUCTS spec respects blocked X ranges', () => {
    const r = rect(0, 1280, 0, 200);
    // Block the entire span — every potential décor X should be filtered.
    const fullyBlocked: BlockedRange[] = [{ xMin: -10_000, xMax: 10_000 }];
    const spec = specForBand(band(FLOORS.PRODUCTS), 'left', r, fullyBlocked);
    expect(spec.staticRects).toEqual([]);
    expect(spec.blinkRects).toEqual([]);
  });

  it('PRODUCTS spec produces décor when no ranges are blocked', () => {
    const r = rect(0, 200, 0, 200);
    const spec = specForBand(band(FLOORS.PRODUCTS), 'left', r, []);
    expect(spec.staticRects.length).toBeGreaterThan(0);
  });

  it('PRODUCTS spec only places content outside blocked ranges', () => {
    // Block the centre 80 px; the side rect is 0..240. Anything that
    // would land inside 80..160 must be omitted.
    const r = rect(0, 240, 0, 200);
    const blocked: BlockedRange[] = [{ xMin: 80, xMax: 160 }];
    const spec = specForBand(band(FLOORS.PRODUCTS), 'left', r, blocked);
    for (const rectSpec of spec.staticRects) {
      const xMax = rectSpec.x + rectSpec.width;
      const overlaps = xMax >= 80 && rectSpec.x <= 160;
      expect(overlaps).toBe(false);
    }
  });

  it('LOBBY spec includes a blinking sconce', () => {
    const spec = specForBand(band(FLOORS.LOBBY), 'left', rect());
    expect(spec.blinkRects.length).toBeGreaterThanOrEqual(1);
  });

  it('EXECUTIVE spec includes a blinking lamp', () => {
    const spec = specForBand(band(FLOORS.EXECUTIVE), 'left', rect());
    expect(spec.blinkRects.length).toBeGreaterThanOrEqual(1);
  });

  it('every blink rect carries valid blink params', () => {
    const r = rect(0, 240, 0, 200);
    for (const floor of Object.values(FLOORS)) {
      for (const side of ['left', 'right'] as const) {
        const spec = specForBand(band(floor), side, r);
        for (const b of spec.blinkRects) {
          expect(b.blink.lo).toBeGreaterThanOrEqual(0);
          expect(b.blink.lo).toBeLessThanOrEqual(1);
          expect(b.blink.hi).toBeGreaterThan(b.blink.lo);
          expect(b.blink.hi).toBeLessThanOrEqual(1);
          expect(b.blink.durationMs).toBeGreaterThan(0);
          expect(b.blink.delayMs).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
