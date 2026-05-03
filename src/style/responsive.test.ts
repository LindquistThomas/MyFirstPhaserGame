import { describe, it, expect } from 'vitest';
import { getSizeClass, getLayoutTokens, type SizeClass } from './responsive';

describe('getSizeClass', () => {
  it('returns compact for widths below 700', () => {
    expect(getSizeClass(375)).toBe('compact');
    expect(getSizeClass(699)).toBe('compact');
  });

  it('returns compact at exactly 0', () => {
    expect(getSizeClass(0)).toBe('compact');
  });

  it('returns regular for widths from 700 to 1099', () => {
    expect(getSizeClass(700)).toBe('regular');
    expect(getSizeClass(768)).toBe('regular');
    expect(getSizeClass(1099)).toBe('regular');
  });

  it('returns wide for widths of 1100 and above', () => {
    expect(getSizeClass(1100)).toBe('wide');
    expect(getSizeClass(1280)).toBe('wide');
    expect(getSizeClass(1920)).toBe('wide');
  });

  it('covers all three branches without overlap', () => {
    const classes = [0, 699, 700, 1099, 1100, 1280].map(getSizeClass);
    expect(classes).toEqual(['compact', 'compact', 'regular', 'regular', 'wide', 'wide']);
  });
});

describe('getLayoutTokens', () => {
  const sizeClasses: SizeClass[] = ['compact', 'regular', 'wide'];

  it('returns a complete LayoutTokens object for every size class', () => {
    for (const sc of sizeClasses) {
      const t = getLayoutTokens(sc);
      expect(typeof t.hudFontAU).toBe('string');
      expect(typeof t.hudFontFloor).toBe('string');
      expect(typeof t.hudFontTitle).toBe('string');
      expect(typeof t.hudFontFloorLabel).toBe('string');
      expect(typeof t.dialogFontBody).toBe('string');
      expect(typeof t.dialogFontTitle).toBe('string');
      expect(typeof t.dialogTapTarget).toBe('number');
      expect(typeof t.dialogPanelW).toBe('number');
    }
  });

  it('font sizes increase (larger game-unit values) as viewport gets smaller', () => {
    const compact = getLayoutTokens('compact');
    const regular = getLayoutTokens('regular');
    const wide = getLayoutTokens('wide');

    // Extract numeric part from e.g. '28px'
    const px = (s: string): number => parseInt(s, 10);

    expect(px(compact.hudFontAU)).toBeGreaterThan(px(regular.hudFontAU));
    expect(px(regular.hudFontAU)).toBeGreaterThan(px(wide.hudFontAU));
    expect(px(compact.dialogFontBody)).toBeGreaterThan(px(wide.dialogFontBody));
    expect(px(compact.dialogFontTitle)).toBeGreaterThan(px(wide.dialogFontTitle));
  });

  it('dialog panel is wider for smaller size classes', () => {
    expect(getLayoutTokens('compact').dialogPanelW)
      .toBeGreaterThan(getLayoutTokens('regular').dialogPanelW);
    expect(getLayoutTokens('regular').dialogPanelW)
      .toBeGreaterThan(getLayoutTokens('wide').dialogPanelW);
  });

  it('tap targets are at least 44 for all classes', () => {
    for (const sc of sizeClasses) {
      expect(getLayoutTokens(sc).dialogTapTarget).toBeGreaterThanOrEqual(44);
    }
  });

  it('tap targets are larger at smaller sizes', () => {
    expect(getLayoutTokens('compact').dialogTapTarget)
      .toBeGreaterThan(getLayoutTokens('wide').dialogTapTarget);
  });

  it('wide tokens match current legacy hardcoded values', () => {
    const wide = getLayoutTokens('wide');
    expect(wide.hudFontAU).toBe('20px');
    expect(wide.hudFontFloor).toBe('16px');
    expect(wide.hudFontFloorLabel).toBe('9px');
    expect(wide.dialogFontBody).toBe('15px');
    expect(wide.dialogPanelW).toBe(620);
  });

  it('textScale=1 returns identical tokens to no-scale call', () => {
    for (const sc of sizeClasses) {
      expect(getLayoutTokens(sc, 1)).toEqual(getLayoutTokens(sc));
    }
  });

  it('textScale multiplies all font-size tokens', () => {
    const base = getLayoutTokens('wide');
    const scaled = getLayoutTokens('wide', 1.5);
    const px = (s: string): number => parseInt(s, 10);
    expect(px(scaled.hudFontAU)).toBe(Math.round(px(base.hudFontAU) * 1.5));
    expect(px(scaled.hudFontFloor)).toBe(Math.round(px(base.hudFontFloor) * 1.5));
    expect(px(scaled.hudFontTitle)).toBe(Math.round(px(base.hudFontTitle) * 1.5));
    expect(px(scaled.hudFontFloorLabel)).toBe(Math.round(px(base.hudFontFloorLabel) * 1.5));
    expect(px(scaled.dialogFontBody)).toBe(Math.round(px(base.dialogFontBody) * 1.5));
    expect(px(scaled.dialogFontTitle)).toBe(Math.round(px(base.dialogFontTitle) * 1.5));
  });

  it('textScale does not affect non-font numeric tokens', () => {
    const base = getLayoutTokens('wide');
    const scaled = getLayoutTokens('wide', 1.5);
    expect(scaled.dialogTapTarget).toBe(base.dialogTapTarget);
    expect(scaled.dialogPanelW).toBe(base.dialogPanelW);
  });

  it('textScale applies correctly to compact size class', () => {
    const base = getLayoutTokens('compact');
    const scaled = getLayoutTokens('compact', 1.15);
    const px = (s: string): number => parseInt(s, 10);
    expect(px(scaled.dialogFontBody)).toBe(Math.round(px(base.dialogFontBody) * 1.15));
  });
});
