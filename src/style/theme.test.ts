import { describe, it, expect } from 'vitest';
import { theme, COLORS, getColorBlindPalette, getHighContrastCss, type ColorBlindMode } from './theme';

describe('theme', () => {
  it('exposes a stable top-level shape', () => {
    expect(Object.keys(theme).sort()).toEqual(['color', 'space']);
    expect(Object.keys(theme.color).sort()).toEqual([
      'bg', 'css', 'floor', 'floorBackdrop', 'sky', 'status', 'ui',
    ]);
  });

  it('exposes night-sky palette tokens used by the elevator exterior backdrop', () => {
    expect(theme.color.sky).toEqual({
      zenith: 0x05070f,
      horizon: 0x0e1730,
      moon: 0xf5efd8,
      moonHalo: 0xd8d0b8,
      starDim: 0x7a8aaa,
      starBright: 0xe8eeff,
      skylineSilhouette: 0x050810,
      skylineAccent: 0x0a1020,
      windowLit: 0xffd27f,
      windowDim: 0x8a7344,
      windowLitCool: 0xbfd7ff,
      windowLitGreen: 0x9ad39a,
      windowBlinds: 0x3a2e18,
    });
  });

  it('exposes a mid background tone used for low-alpha washes', () => {
    expect(theme.color.bg.mid).toBe(0x2a2f4a);
  });

  it('covers every floor in the palette', () => {
    expect(Object.keys(theme.color.floor).sort()).toEqual([
      'business', 'executive', 'lobby', 'platform', 'products',
    ]);
    for (const palette of Object.values(theme.color.floor)) {
      expect(palette).toHaveProperty('platform');
      expect(palette).toHaveProperty('background');
      expect(palette).toHaveProperty('wall');
      expect(palette).toHaveProperty('token');
    }
  });

  it('exposes standard spacing steps', () => {
    expect(theme.space).toEqual({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 });
  });

  it('keeps numeric and css siblings in sync for shared colours', () => {
    // Title / accent share a hex on both sides of the numeric/css divide.
    expect(theme.color.css.textAccent).toBe('#00d4ff');
    expect(theme.color.ui.accent).toBe(0x00d4ff);
  });

  it('legacy COLORS shim routes through theme tokens', () => {
    expect(COLORS.background).toBe(theme.color.bg.default);
    expect(COLORS.elevatorShaft).toBe(theme.color.bg.shaft);
    expect(COLORS.elevatorPlatform).toBe(theme.color.ui.panel);
    expect(COLORS.floorUnlocked).toBe(theme.color.status.unlocked);
    expect(COLORS.floorLocked).toBe(theme.color.status.locked);
    expect(COLORS.token).toBe(theme.color.ui.token);
    expect(COLORS.hudBackground).toBe(theme.color.bg.dark);
    expect(COLORS.hudText).toBe(theme.color.css.textPrimary);
    expect(COLORS.titleText).toBe(theme.color.css.textTitle);
    expect(COLORS.menuText).toBe(theme.color.css.textWhite);
  });

  it('includes quiz palette tokens used by QuizDialog', () => {
    expect(theme.color.ui.quizPanel).toBe(0x0a0a2a);
    expect(theme.color.ui.quizChoice).toBe(0x1a2a3a);
    expect(theme.color.ui.quizChoiceBorder).toBe(0x2a4a6a);
    expect(theme.color.ui.quizChoiceHover).toBe(0x2a4a6a);
    expect(theme.color.ui.quizChoiceHoverBorder).toBe(0x4a6a8a);
    expect(theme.color.ui.quizChoiceCorrect).toBe(0x1a4a2a);
    expect(theme.color.ui.quizChoiceWrong).toBe(0x4a1a1a);
    expect(theme.color.ui.quizCorrect).toBe(0x44ff88);
    expect(theme.color.ui.quizWrong).toBe(0xff4444);
    expect(theme.color.css.textQuizBody).toBe('#c0c8d4');
    expect(theme.color.css.textQuizHint).toBe('#a0aab8');
    expect(theme.color.css.textQuizMuted).toBe('#b0bcc8');
    expect(theme.color.css.textQuizCorrect).toBe('#44ff88');
    expect(theme.color.css.textQuizHard).toBe('#ff6644');
    expect(theme.color.css.textQuizDanger).toBe('#ff6666');
    expect(theme.color.css.textQuizAccentHover).toBe('#88ddff');
  });

  it('textHint token is present and routes through theme', () => {
    expect(typeof theme.color.css.textHint).toBe('string');
    expect(theme.color.css.textHint).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('all text* tokens in css palette meet WCAG AA (4.5:1) on the game background', () => {
    /** WCAG 2.1 relative luminance for a CSS hex colour (e.g. '#1a1a2e'). */
    function relativeLuminance(hex: string): number {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLinear = (c: number): number =>
        c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = relativeLuminance(hex1);
      const l2 = relativeLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker  = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Derive the background from the theme token so the test stays correct
    // if bg.default ever changes (0xRRGGBB → '#rrggbb').
    const bgHex = theme.color.bg.default.toString(16).padStart(6, '0');
    const bg = `#${bgHex}`;

    const cssPalette = theme.color.css as Record<string, string>;
    const textTokens = Object.entries(cssPalette).filter(
      ([key]) => key.startsWith('text'),
    );

    // Skip tokens that are intentionally decorative / non-body colours
    // whose primary background is not the default dark canvas:
    //   textQuizCorrect / textQuizDanger — green/red status colours rendered
    //     on a per-choice panel background, not on bg.default.
    //   textQuizHard — warning accent used with heavy glow, not body text.
    //   textDisabled — intentionally low-contrast (indicates inactivity).
    //   textAccent / textTitle / textQuizAccentHover —
    //     decorative accent/title colours; contrast is supplemented by
    //     weight, size, or glow effects.
    const skip = new Set([
      'textQuizCorrect', 'textQuizDanger', 'textQuizHard',
      'textDisabled',
      'textAccent', 'textTitle', 'textQuizAccentHover',
    ]);

    for (const [key, value] of textTokens) {
      if (skip.has(key)) continue;

      const ratio = contrastRatio(value, bg);
      expect(ratio, `${key} (${value}) must be ≥4.5:1 on ${bg}, got ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('getColorBlindPalette', () => {
  const modes: ColorBlindMode[] = ['off', 'deuteranopia', 'protanopia', 'tritanopia'];

  it('returns a palette for every mode', () => {
    for (const mode of modes) {
      const p = getColorBlindPalette(mode);
      expect(p).toHaveProperty('quizCorrect');
      expect(p).toHaveProperty('quizWrong');
      expect(p).toHaveProperty('quizChoiceCorrect');
      expect(p).toHaveProperty('quizChoiceWrong');
      expect(p).toHaveProperty('textQuizCorrect');
      expect(p).toHaveProperty('textQuizHard');
      expect(p).toHaveProperty('token');
    }
  });

  it('off palette matches existing theme tokens', () => {
    const p = getColorBlindPalette('off');
    expect(p.quizCorrect).toBe(theme.color.ui.quizCorrect);
    expect(p.quizWrong).toBe(theme.color.ui.quizWrong);
    expect(p.textQuizCorrect).toBe(theme.color.css.textQuizCorrect);
    expect(p.token).toBe(theme.color.ui.token);
  });

  it('deuteranopia correct color differs from off correct color', () => {
    expect(getColorBlindPalette('deuteranopia').quizCorrect).not.toBe(
      getColorBlindPalette('off').quizCorrect,
    );
  });

  it('deuteranopia wrong color differs from off wrong color', () => {
    expect(getColorBlindPalette('deuteranopia').quizWrong).not.toBe(
      getColorBlindPalette('off').quizWrong,
    );
  });

  it('protanopia correct color differs from off correct color', () => {
    expect(getColorBlindPalette('protanopia').quizCorrect).not.toBe(
      getColorBlindPalette('off').quizCorrect,
    );
  });

  it('tritanopia wrong color differs from off wrong color', () => {
    expect(getColorBlindPalette('tritanopia').quizWrong).not.toBe(
      getColorBlindPalette('off').quizWrong,
    );
  });

  it('deuteranopia and protanopia correct colors are distinct from each other', () => {
    expect(getColorBlindPalette('deuteranopia').quizCorrect).not.toBe(
      getColorBlindPalette('protanopia').quizCorrect,
    );
  });

  it('tritanopia token color differs from off token color', () => {
    expect(getColorBlindPalette('tritanopia').token).not.toBe(
      getColorBlindPalette('off').token,
    );
  });

  it('each mode returns distinct quizCorrect values', () => {
    const values = modes.map((m) => getColorBlindPalette(m).quizCorrect);
    // off vs deuteranopia vs protanopia should all differ (tritanopia matches off for green)
    expect(values[0]).not.toBe(values[1]); // off vs deuteranopia
    expect(values[0]).not.toBe(values[2]); // off vs protanopia
    expect(values[1]).not.toBe(values[2]); // deuteranopia vs protanopia
  });
});

describe('getHighContrastCss', () => {
  it('returns standard palette when disabled', () => {
    const p = getHighContrastCss(false);
    expect(p.textPrimary).toBe(theme.color.css.textPrimary);
    expect(p.textAccent).toBe(theme.color.css.textAccent);
    expect(p.bgPanel).toBe(theme.color.css.bgPanel);
  });

  it('returns high-contrast palette when enabled', () => {
    const p = getHighContrastCss(true);
    expect(p.textPrimary).toBe('#ffffff');
    expect(p.textAccent).toBe('#ffeb3b');
    expect(p.bgPanel).toBe('#000000');
  });

  it('high-contrast text colours meet WCAG AA on black background', () => {
    function relativeLuminance(hex: string): number {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLinear = (c: number): number =>
        c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }
    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = relativeLuminance(hex1);
      const l2 = relativeLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker  = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const p = getHighContrastCss(true);
    const bg = p.bgPanel; // '#000000'
    expect(contrastRatio(p.textPrimary, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.textAccent, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.textPanel, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('standard palette matches theme tokens for both text and bg', () => {
    const p = getHighContrastCss(false);
    expect(p.textSecondary).toBe(theme.color.css.textSecondary);
    expect(p.textPanel).toBe(theme.color.css.textPanel);
    expect(p.bgDialog).toBe(theme.color.css.bgDialog);
  });
});
