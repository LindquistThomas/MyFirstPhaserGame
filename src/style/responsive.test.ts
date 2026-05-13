import { describe, it, expect } from 'vitest';
import { getSizeClass, getLayoutTokens, type SizeClass } from './responsive';

/** Phaser game canvas logical width (matches gameConfig.GAME_WIDTH). */
const GAME_WIDTH = 1280;

describe('getSizeClass', () => {
  it('returns ultra-compact for widths below 500', () => {
    expect(getSizeClass(320)).toBe('ultra-compact');
    expect(getSizeClass(375)).toBe('ultra-compact');
    expect(getSizeClass(499)).toBe('ultra-compact');
  });

  it('returns ultra-compact at exactly 0', () => {
    expect(getSizeClass(0)).toBe('ultra-compact');
  });

  it('returns compact for widths from 500 to 699', () => {
    expect(getSizeClass(500)).toBe('compact');
    expect(getSizeClass(600)).toBe('compact');
    expect(getSizeClass(699)).toBe('compact');
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

  it('covers all four branches without overlap', () => {
    const classes = [0, 499, 500, 699, 700, 1099, 1100, 1280].map(getSizeClass);
    expect(classes).toEqual([
      'ultra-compact', 'ultra-compact',
      'compact', 'compact',
      'regular', 'regular',
      'wide', 'wide',
    ]);
  });
});

describe('getLayoutTokens', () => {
  const sizeClasses: SizeClass[] = ['ultra-compact', 'compact', 'regular', 'wide'];

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
      expect(typeof t.infoIconHitSize).toBe('number');
    }
  });

  it('font sizes increase (larger game-unit values) as viewport gets smaller', () => {
    const ultraCompact = getLayoutTokens('ultra-compact');
    const compact = getLayoutTokens('compact');
    const regular = getLayoutTokens('regular');
    const wide = getLayoutTokens('wide');

    // Extract numeric part from e.g. '28px'
    const px = (s: string): number => parseInt(s, 10);

    expect(px(ultraCompact.hudFontAU)).toBeGreaterThan(px(compact.hudFontAU));
    expect(px(compact.hudFontAU)).toBeGreaterThan(px(regular.hudFontAU));
    expect(px(regular.hudFontAU)).toBeGreaterThan(px(wide.hudFontAU));
    expect(px(ultraCompact.dialogFontBody)).toBeGreaterThan(px(compact.dialogFontBody));
    expect(px(compact.dialogFontBody)).toBeGreaterThan(px(wide.dialogFontBody));
    expect(px(ultraCompact.dialogFontTitle)).toBeGreaterThan(px(compact.dialogFontTitle));
    expect(px(compact.dialogFontTitle)).toBeGreaterThan(px(wide.dialogFontTitle));
  });

  it('dialog panel is wider for smaller size classes', () => {
    expect(getLayoutTokens('ultra-compact').dialogPanelW)
      .toBeGreaterThan(getLayoutTokens('compact').dialogPanelW);
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
    expect(getLayoutTokens('ultra-compact').dialogTapTarget)
      .toBeGreaterThan(getLayoutTokens('compact').dialogTapTarget);
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
    expect(scaled.infoIconHitSize).toBe(base.infoIconHitSize);
  });

  it('textScale applies correctly to compact size class', () => {
    const base = getLayoutTokens('compact');
    const scaled = getLayoutTokens('compact', 1.15);
    const px = (s: string): number => parseInt(s, 10);
    expect(px(scaled.dialogFontBody)).toBe(Math.round(px(base.dialogFontBody) * 1.15));
  });

  describe('WCAG 2.5.5 tap-target invariant at 320×640 viewport', () => {
    // On a 320px-wide device the Phaser canvas (1280 game-units wide) is
    // FIT-scaled to 320 CSS px.  The CSS-pixel-per-game-unit ratio is
    // 320/1280 = 0.25.  A tap target of N game-units therefore renders as
    // N × 0.25 CSS px.  WCAG 2.5.5 Level AAA requires ≥ 44 CSS px.
    const VIEWPORT_WIDTH = 320;
    const CSS_PX_PER_GU = VIEWPORT_WIDTH / GAME_WIDTH;

    it('ultra-compact dialogTapTarget meets WCAG 44 CSS px at 320px viewport', () => {
      const { dialogTapTarget } = getLayoutTokens('ultra-compact');
      expect(dialogTapTarget * CSS_PX_PER_GU).toBeGreaterThanOrEqual(44);
    });

    it('ultra-compact infoIconHitSize meets WCAG 44 CSS px at 320px viewport', () => {
      const { infoIconHitSize } = getLayoutTokens('ultra-compact');
      expect(infoIconHitSize * CSS_PX_PER_GU).toBeGreaterThanOrEqual(44);
    });
  });
});
