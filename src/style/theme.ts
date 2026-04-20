/**
 * Single source of truth for colours and spacing.
 *
 * All hex literals and padding magic numbers in the game funnel through
 * this file. Phaser wants numeric `0x...` for graphics/tint APIs and CSS
 * `#...` strings for Text styles — we keep both forms as siblings under
 * `color.*` so callers don't have to string-convert at the call site.
 *
 * Numeric names (e.g. `color.text.primary`) are shared by the canvas-
 * side renderer paths; the string counterparts live under `color.css.*`.
 */
export const theme = {
  color: {
    /** Background fills — numeric (Phaser graphics / camera). */
    bg: {
      default: 0x1a1a2e,
      shaft: 0x16213e,
      menu: 0x0f0f1e,
      dark: 0x000000,
      overlay: 0x060610,
      /**
       * Mid tone used for low-alpha washes (floor tints, backdrop accents).
       * Pulled from the legacy floor-shim "wall" palette average so it sits
       * between `bg.default` and `ui.panel` without matching either.
       */
      mid: 0x2a2f4a,
    },

    /**
     * Night-city sky palette used by the elevator scene's exterior backdrop
     * (sky gradient, moon, stars, lit windows on the façade). Kept separate
     * from `bg.*` so daytime/dusk variants can coexist later without moving
     * tokens around.
     */
    sky: {
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
    },

    /** Floor-specific palettes mirroring `config/levelData.ts`. */
    floor: {
      lobby:     { platform: 0x444466, background: 0x1a1a2e, wall: 0x333355, token: 0xffd700 },
      platform:  { platform: 0x2d6a4f, background: 0x1b4332, wall: 0x40916c, token: 0x95d5b2 },
      business:  { platform: 0x6b4a1e, background: 0x1a1408, wall: 0x8b6a2e, token: 0xffd980 },
      executive: { platform: 0x4a3a1a, background: 0x1a1208, wall: 0x6b5320, token: 0xffd700 },
      products:  { platform: 0x3a3a55, background: 0x101a2a, wall: 0x445577, token: 0xffd700 },
    },

    /** UI chrome — buttons, borders, accents, token glow. */
    ui: {
      accent: 0x00d4ff,
      accentAlt: 0x00aaff,
      hover: 0xffed4a,
      border: 0x00aaff,
      disabled: 0x555555,
      panel: 0x0f3460,
      token: 0xffd700,
      quizPanel: 0x0a0a2a,
      quizChoice: 0x1a2a3a,
      quizChoiceBorder: 0x2a4a6a,
      quizChoiceHover: 0x2a4a6a,
      quizChoiceHoverBorder: 0x4a6a8a,
      quizChoiceCorrect: 0x1a4a2a,
      quizChoiceWrong: 0x4a1a1a,
      quizCorrect: 0x44ff88,
      quizWrong: 0xff4444,
    },

    /** Status indicators — unlock state, danger, warnings. */
    status: {
      unlocked: 0x53a653,
      locked: 0x8b0000,
      lockedGrey: 0x888888,
      danger: 0xd32f2f,
      warning: 0xffaa00,
    },

    /** CSS colour strings — used in `scene.add.text(...)` style objects. */
    css: {
      textPrimary: '#e0e0e0',
      textSecondary: '#aabbcc',
      textMuted: '#9aa0a6',
      textDisabled: '#666',
      textAccent: '#00d4ff',
      textTitle: '#00d4ff',
      textWhite: '#ffffff',
      textWarn: '#ffdd44',
      textPanel: '#aaddff',
      textPale: '#cfe6ff',
      textQuizBody: '#c0c8d4',
      textQuizHint: '#667788',
      textQuizMuted: '#8899aa',
      textQuizCorrect: '#44ff88',
      textQuizHard: '#ff6644',
      textQuizDanger: '#ff6666',
      textQuizAccentHover: '#88ddff',
      bgPanel: '#0a1422',
      bgDialog: '#00000088',
    },
  },

  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;

/**
 * Legacy-shaped alias used by existing `COLORS.<key>` call sites while
 * the migration is in flight. New code should prefer `theme.color.*`
 * directly.
 */
export const COLORS = {
  background: theme.color.bg.default,
  elevatorShaft: theme.color.bg.shaft,
  elevatorPlatform: theme.color.ui.panel,
  floorUnlocked: theme.color.status.unlocked,
  floorLocked: theme.color.status.locked,
  token: theme.color.ui.token,
  hudBackground: theme.color.bg.dark,
  hudText: theme.color.css.textPrimary,
  titleText: theme.color.css.textTitle,
  menuText: theme.color.css.textWhite,
} as const;
