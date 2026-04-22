/**
 * Layered backdrop for a single-screen floor scene.
 *
 * Replaces the legacy "flat fill + 64-px grid + border" look with four
 * pure-Graphics layers stacked at depth 0, all drawn once at scene
 * create() time (no per-frame work):
 *
 *   1. Vertical gradient from `theme.backgroundColor` (ceiling) down to
 *      a derived darker shade at floor level. Sells "interior ambient
 *      lighting spilling from above" without any light sources.
 *   2. Soft 64-px grid at alpha 0.08 — still present for a tech-drawing
 *      undertone, but quiet enough to let decor dominate.
 *   3. Vignette: top + bottom + left + right dark edge fades so the
 *      scene framing reads focal without being boxed by a hard border.
 *   4. Optional drawAccents(g) hook for phase 6 (per-floor silhouettes).
 *
 * Colour maths are intentionally simple channel scales — one pass, no
 * allocations, easy to unit-test. See `sceneBackdrop.test.ts`.
 */
import type * as Phaser from 'phaser';
import { drawFloorPattern, type FloorPatternId } from './floorPatterns';

export type { FloorPatternId } from './floorPatterns';

export interface SceneBackdropTheme {
  /** Base fill (same as legacy `floorData.theme.backgroundColor`). */
  backgroundColor: number;
  /** Tint used for the grid + wash (same as `floorData.theme.wallColor`). */
  wallColor: number;
  /** Accent for the subtle border glow (same as `floorData.theme.platformColor`). */
  platformColor: number;
}

export interface SceneBackdropOptions {
  width: number;
  height: number;
  theme: SceneBackdropTheme;
  /**
   * Which decorative pattern to overlay between the gradient and the
   * vignette. Defaults to the quiet 'grid' used by the legacy look.
   */
  pattern?: FloorPatternId;
  /**
   * Seed passed to stochastic patterns (wood grain, terrazzo). Using the
   * floor id keeps the pattern stable across reloads but distinct per floor.
   */
  patternSeed?: number;
  /**
   * Called after the base layers so callers can paint floor-specific
   * motifs (silhouettes, skyline prints, etc.) without needing to own
   * any of the boilerplate. Runs at the same depth.
   */
  drawAccents?: (g: Phaser.GameObjects.Graphics) => void;
}

/**
 * Scale each RGB channel of `color` by `factor`, clamped to [0, 255].
 * Returns a new 0xRRGGBB integer. Factor 1 is identity, < 1 darkens,
 * > 1 lightens.
 */
export function scaleChannels(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/**
 * Draw the layered backdrop. Returns the Graphics object so callers can
 * add their own tweens/manipulation if really needed — the expectation
 * is that they don't.
 */
export function drawSceneBackdrop(
  scene: Phaser.Scene,
  opts: SceneBackdropOptions,
): Phaser.GameObjects.Graphics {
  const { width, height, theme, drawAccents, pattern = 'grid', patternSeed = 0 } = opts;
  const g = scene.add.graphics().setDepth(0);

  // 1. Vertical gradient — approximate via 32 horizontal bands. Cheaper
  // and more deterministic than a texture-based gradient, and plenty
  // smooth at our scale.
  const bands = 32;
  const bandH = Math.ceil(height / bands);
  const ceiling = theme.backgroundColor;
  const floor = scaleChannels(theme.backgroundColor, 0.62);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const color = lerpColor(ceiling, floor, t);
    g.fillStyle(color, 1);
    g.fillRect(0, i * bandH, width, bandH + 1);
  }

  // 2. Themed pattern — 'grid' is the quiet default; floors may opt in
  // to blueprint / wood / terrazzo / dots for identity.
  drawFloorPattern(pattern, g, width, height, theme, patternSeed);

  // 3. Vignette — four edge fades using triangle strips so the darkening
  // tapers off toward the centre instead of reading as bars. 12 strips
  // per edge is enough resolution at 64-px edge depth.
  const edge = 64;
  const strips = 12;
  const vignetteColor = 0x000000;
  for (let i = 0; i < strips; i++) {
    const t = i / strips;
    // Quadratic ease so the innermost strips are near-invisible.
    const alpha = 0.35 * Math.pow(1 - t, 2);
    const inset = Math.round(t * edge);
    const h = Math.max(1, Math.round(edge / strips));
    g.fillStyle(vignetteColor, alpha);
    g.fillRect(0, inset, width, h);                      // top
    g.fillRect(0, height - inset - h, width, h);         // bottom
    g.fillRect(inset, 0, h, height);                     // left
    g.fillRect(width - inset - h, 0, h, height);         // right
  }

  // 4. Subtle accent border — one-pixel platform-tinted line, tamer than
  // the legacy 4-px stroke.
  g.lineStyle(1, theme.platformColor, 0.55);
  g.strokeRect(0.5, 0.5, width - 1, height - 1);

  // 5. Bottom-edge floor glow — a soft band tinted with the floor's accent
  // color, fading from ~18% alpha at the very bottom to 0 about 100 px up.
  // Grounds the room so platforms + props don't float over the vignette.
  const glowHeight = 100;
  const glowBands = 20;
  const glowBandH = Math.ceil(glowHeight / glowBands);
  const glowTop = height - glowHeight;
  for (let i = 0; i < glowBands; i++) {
    // t in (0,1]: darker at the top of the band, brightest at the bottom.
    const t = (i + 1) / glowBands;
    const alpha = 0.18 * Math.pow(t, 2);
    const yTop = glowTop + i * glowBandH;
    g.fillStyle(theme.platformColor, alpha);
    g.fillRect(0, yTop, width, glowBandH);
  }

  drawAccents?.(g);

  return g;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// Exported for unit tests — keeps lerpColor internal without dup code.
export const _internals = { lerpColor };
