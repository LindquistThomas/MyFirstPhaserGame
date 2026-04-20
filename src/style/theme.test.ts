import { describe, it, expect } from 'vitest';
import { theme, COLORS } from './theme';

describe('theme', () => {
  it('exposes a stable top-level shape', () => {
    expect(Object.keys(theme).sort()).toEqual(['color', 'space']);
    expect(Object.keys(theme.color).sort()).toEqual([
      'bg', 'css', 'floor', 'sky', 'status', 'ui',
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
    expect(theme.color.css.textQuizHint).toBe('#667788');
    expect(theme.color.css.textQuizMuted).toBe('#8899aa');
    expect(theme.color.css.textQuizCorrect).toBe('#44ff88');
    expect(theme.color.css.textQuizHard).toBe('#ff6644');
    expect(theme.color.css.textQuizDanger).toBe('#ff6666');
    expect(theme.color.css.textQuizAccentHover).toBe('#88ddff');
  });
});
