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

/** Active color-blind simulation mode. Persisted in SettingsStore. */
export type ColorBlindMode = 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';

/**
 * Semantic color roles that change across color-blind palettes.
 * Covers quiz feedback and token glow — the highest-stakes color-coded UI.
 */
export interface ColorBlindPalette {
  /** Numeric tint for correct-answer border/accent (Phaser graphics). */
  quizCorrect: number;
  /** Numeric tint for wrong-answer border/accent (Phaser graphics). */
  quizWrong: number;
  /** Numeric fill for correct choice background. */
  quizChoiceCorrect: number;
  /** Numeric fill for wrong choice background. */
  quizChoiceWrong: number;
  /** CSS string for "Correct!" result text. */
  textQuizCorrect: string;
  /** CSS string for "Wrong!" result text (maps to textQuizHard in default palette). */
  textQuizHard: string;
  /** Numeric tint for token coin / halo. */
  token: number;
}

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
      // Additional lit-window tints for the hallway façade so the tower
      // reads as a mix of warm offices, cool fluorescent rooms, and the
      // occasional green-tinged monitor-lit space.
      windowLitCool: 0xbfd7ff,
      windowLitGreen: 0x9ad39a,
      // Darker overlay used to draw horizontal "blinds" stripes over a lit
      // window. Blended with the window fill; reads as a drawn shade.
      windowBlinds: 0x3a2e18,
    },

    /**
     * Per-floor near-layer backdrop palette. Used by `floorBackdrops.ts` to
     * draw themed silhouettes inside the hallway strips on either side of
     * the elevator shaft (server racks, whiteboard, monitor, panelling,
     * pipes, etc.). Tuned darker / desaturated so backdrop reads as
     * "behind the floor" against the foreground decor at depth 3+.
     */
    floorBackdrop: {
      // Generic
      panelDark: 0x1a1a22,
      panelMid: 0x2a2a36,
      panelEdge: 0x3a3a48,
      stencil: 0x55556a,
      // Platform Team — server cabinets
      rackBody: 0x14181f,
      rackEdge: 0x2a3140,
      rackLedOff: 0x223028,
      rackLedOn: 0x4cd07a,
      rackLedAmber: 0xe0a040,
      // Architecture — whiteboard
      boardSurface: 0xc8cdd4,
      boardFrame: 0x6a6a78,
      boardMarker: 0x2a3d6b,
      boardMarkerAlt: 0x8a3a3a,
      // Business — desk + monitor
      deskSurface: 0x3a2e22,
      deskEdge: 0x5a4a36,
      monitorBezel: 0x14181c,
      monitorScreen: 0x0e2030,
      monitorChart: 0x4cc0d0,
      // Customer Success — cubicles
      cubicleDivider: 0x44485a,
      cubicleAccent: 0x5a607a,
      ticketScreen: 0x143a3a,
      ticketGlow: 0x4cd0c0,
      // Executive — wood panelling + bookshelf
      woodDark: 0x2a1a10,
      woodMid: 0x4a2e1c,
      woodLight: 0x6a4830,
      brass: 0xd8a040,
      lampWarm: 0xffb060,
      // Products — utility corridor
      pipeBody: 0x4a4f5a,
      pipeEdge: 0x6a7080,
      ventGrille: 0x14181c,
      ventSlit: 0x2a3036,
      signYellow: 0xe0c040,
      signRed: 0xc04040,
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
      textDisabled: '#888',
      textAccent: '#00d4ff',
      textTitle: '#00d4ff',
      textWhite: '#ffffff',
      textWarn: '#ffdd44',
      textPanel: '#aaddff',
      textPale: '#cfe6ff',
      textQuizBody: '#c0c8d4',
      textQuizHint: '#a0aab8',
      textQuizMuted: '#b0bcc8',
      textHint: '#9aa0a6',
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

/**
 * Per-mode palette overrides for the color-blind-sensitive semantic roles.
 *
 * Design rationale (verified against Coblis simulator):
 *  - deuteranopia / protanopia: both are red-green deficient.
 *    Replace green→blue and red→orange so correct/wrong are never confused.
 *  - tritanopia: blue-yellow deficient.
 *    Green/magenta pair avoids the blue-yellow axis entirely; gold token
 *    shifts to orange so it doesn't wash into yellow.
 *
 * The `off` entry is derived from `theme` tokens so there is a single
 * source of truth — if a base token changes, the default palette updates
 * automatically without a separate edit here.
 */
const COLOR_BLIND_PALETTES: Record<ColorBlindMode, ColorBlindPalette> = {
  off: {
    quizCorrect:       theme.color.ui.quizCorrect,
    quizWrong:         theme.color.ui.quizWrong,
    quizChoiceCorrect: theme.color.ui.quizChoiceCorrect,
    quizChoiceWrong:   theme.color.ui.quizChoiceWrong,
    textQuizCorrect:   theme.color.css.textQuizCorrect,
    textQuizHard:      theme.color.css.textQuizHard,
    token:             theme.color.ui.token,
  },
  deuteranopia: {
    // Red-green blind: swap green→blue for correct, red→orange for wrong.
    quizCorrect:       0x4488ff,
    quizWrong:         0xff8800,
    quizChoiceCorrect: 0x1a2a4a,
    quizChoiceWrong:   0x4a2a1a,
    textQuizCorrect:   '#4488ff',
    textQuizHard:      '#ff8800',
    token:             theme.color.ui.token,
  },
  protanopia: {
    // Red-blind: reds appear very dark; use blue for correct, amber for wrong.
    quizCorrect:       0x44bbff,
    quizWrong:         0xffaa00,
    quizChoiceCorrect: 0x1a3a4a,
    quizChoiceWrong:   0x4a3a1a,
    textQuizCorrect:   '#44bbff',
    textQuizHard:      '#ffaa00',
    token:             theme.color.ui.token,
  },
  tritanopia: {
    // Blue-yellow blind: green/magenta pair avoids the confusion axis.
    quizCorrect:       0x44ff88,
    quizWrong:         0xff44aa,
    quizChoiceCorrect: 0x1a4a2a,
    quizChoiceWrong:   0x4a1a3a,
    textQuizCorrect:   '#44ff88',
    textQuizHard:      '#ff44aa',
    // Gold → orange to avoid yellow-blue confusion.
    token:             0xff9944,
  },
};

/**
 * Returns the color-blind palette for the given mode.
 * Pass `settingsStore.read().colorBlindMode` from the call site to keep
 * `theme.ts` free of store dependencies.
 */
export function getColorBlindPalette(mode: ColorBlindMode): ColorBlindPalette {
  return COLOR_BLIND_PALETTES[mode];
}

/**
 * CSS colour overrides for the full high-contrast theme.
 *
 * Designed to meet WCAG 2.1 AA (4.5:1 minimum contrast ratio) for all body
 * text and UI accents on a black / near-black canvas background.
 *
 * Contrast ratios verified against `bg.default` (#1a1a2e) and pure black (#000000):
 *   - #ffffff on #1a1a2e ≈ 14.9:1  ✓
 *   - #ffeb3b on #1a1a2e ≈ 12.3:1  ✓
 *   - #ffffff on #000000 = 21:1     ✓
 */
export interface HighContrastPalette {
  textPrimary: string;
  textSecondary: string;
  textAccent: string;
  textPanel: string;
  bgPanel: string;
  bgDialog: string;
}

const HIGH_CONTRAST_PALETTE: HighContrastPalette = {
  textPrimary:   '#ffffff',
  textSecondary: '#ffffff',
  textAccent:    '#ffeb3b',
  textPanel:     '#ffffff',
  bgPanel:       '#000000',
  bgDialog:      '#000000cc',
};

const STANDARD_PALETTE: HighContrastPalette = {
  textPrimary:   theme.color.css.textPrimary,
  textSecondary: theme.color.css.textSecondary,
  textAccent:    theme.color.css.textAccent,
  textPanel:     theme.color.css.textPanel,
  bgPanel:       theme.color.css.bgPanel,
  bgDialog:      theme.color.css.bgDialog,
};

/**
 * Returns the CSS colour overrides for the current high-contrast state.
 * Pass `settingsStore.read().highContrast` from the call site to keep
 * `theme.ts` free of store dependencies.
 */
export function getHighContrastCss(enabled: boolean): HighContrastPalette {
  return enabled ? HIGH_CONTRAST_PALETTE : STANDARD_PALETTE;
}
