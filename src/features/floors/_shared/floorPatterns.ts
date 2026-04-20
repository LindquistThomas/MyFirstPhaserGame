/**
 * Themed decorative patterns layered on top of the floor-scene gradient.
 *
 * Each pattern is a pure `(g, width, height, theme, seed)` function that
 * draws low-alpha marks onto the scene backdrop. They replace the default
 * "soft grid" layer in `sceneBackdrop.ts` when a floor opts into a
 * specific motif via `LevelScene.getBackgroundPattern()`.
 *
 * Design constraints:
 *  - Deterministic per `seed` — no flicker between scene reloads.
 *  - Total alpha budget ~0.10 over any given pixel, so the pattern is
 *    atmosphere and not visual noise that competes with decor.
 *  - No allocations beyond trivial integers — drawn once at create().
 *  - Same call shape as the default grid so swapping is a one-liner.
 */
import type * as Phaser from 'phaser';

export type FloorPatternId = 'grid' | 'blueprint' | 'wood' | 'terrazzo' | 'dots';

export interface PatternTheme {
  backgroundColor: number;
  wallColor: number;
  platformColor: number;
}

export type FloorPatternFn = (
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  theme: PatternTheme,
  seed: number,
) => void;

/** Small deterministic RNG — xorshift, matches the pattern used elsewhere. */
function rng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 0x1f1f_1f1f;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Default: the legacy 64-px tech grid. Quiet baseline for the lobby. */
const grid: FloorPatternFn = (g, width, height, theme) => {
  g.lineStyle(1, theme.wallColor, 0.08);
  for (let x = 64; x < width; x += 64) g.lineBetween(x, 0, x, height);
  for (let y = 64; y < height; y += 64) g.lineBetween(0, y, width, y);
};

/**
 * Blueprint paper — fine 16-px minor grid + bold 64-px major grid,
 * plus a few axis-tick marks. Fits the Platform team's engineering
 * floor without replacing tile art.
 */
const blueprint: FloorPatternFn = (g, width, height, theme) => {
  // Minor grid.
  g.lineStyle(1, theme.wallColor, 0.05);
  for (let x = 16; x < width; x += 16) g.lineBetween(x, 0, x, height);
  for (let y = 16; y < height; y += 16) g.lineBetween(0, y, width, y);
  // Major grid — slightly bolder.
  g.lineStyle(1, theme.wallColor, 0.12);
  for (let x = 64; x < width; x += 64) g.lineBetween(x, 0, x, height);
  for (let y = 64; y < height; y += 64) g.lineBetween(0, y, width, y);
  // Axis-tick chevrons at 128-px intervals on top and left margins so
  // the frame reads as a technical drawing, not just lines.
  g.fillStyle(theme.platformColor, 0.35);
  for (let x = 128; x < width - 64; x += 128) {
    g.fillRect(x - 1, 4, 2, 6);
  }
  for (let y = 128; y < height - 64; y += 128) {
    g.fillRect(4, y - 1, 6, 2);
  }
};

/**
 * Wood-grain planks — horizontal stripes every 48px with slightly
 * varied alpha + a handful of deterministic "knots". Warm aesthetic
 * for the Business floor without needing raster textures.
 */
const wood: FloorPatternFn = (g, width, height, theme, seed) => {
  const rand = rng(seed ^ 0x77_6f_6f_64);
  const plankH = 48;
  for (let y = 0; y < height; y += plankH) {
    // Plank top edge — slightly darker.
    g.fillStyle(theme.wallColor, 0.10 + rand() * 0.04);
    g.fillRect(0, y, width, 2);
    // Grain line — one mid-plank faint line per plank.
    g.fillStyle(theme.wallColor, 0.05);
    g.fillRect(0, y + 20 + Math.floor(rand() * 8), width, 1);
  }
  // Sparse elliptical "knots" so it doesn't feel perfectly striped.
  const knots = Math.floor((width * height) / (640 * 360));
  for (let i = 0; i < knots; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    g.fillStyle(theme.wallColor, 0.18);
    g.fillEllipse(x, y, 8, 4);
    g.fillStyle(theme.wallColor, 0.10);
    g.fillEllipse(x, y, 14, 7);
  }
};

/**
 * Terrazzo speckle — scatter of tiny coloured chips on the base colour.
 * Subtle marble-floor vibe for the Executive suite.
 */
const terrazzo: FloorPatternFn = (g, width, height, theme, seed) => {
  const rand = rng(seed ^ 0x74_65_72_7a);
  const chips = Math.floor((width * height) / 900);
  for (let i = 0; i < chips; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const r = rand();
    const color =
      r < 0.45 ? theme.wallColor :
      r < 0.80 ? theme.platformColor :
      0xffffff;
    const alpha = 0.08 + rand() * 0.10;
    const size = 1 + Math.floor(rand() * 3);
    g.fillStyle(color, alpha);
    g.fillRect(x, y, size, size);
  }
};

/**
 * Peg-board dots — regular grid of small circles. Reads as modular
 * product shelving for the Products floor.
 */
const dots: FloorPatternFn = (g, width, height, theme) => {
  const step = 48;
  g.fillStyle(theme.wallColor, 0.12);
  for (let y = step; y < height; y += step) {
    for (let x = step; x < width; x += step) {
      g.fillCircle(x, y, 1.5);
    }
  }
  // Half-step offset second layer at lower alpha for visual depth.
  g.fillStyle(theme.platformColor, 0.06);
  for (let y = step + step / 2; y < height; y += step) {
    for (let x = step + step / 2; x < width; x += step) {
      g.fillCircle(x, y, 1);
    }
  }
};

const PATTERNS: Record<FloorPatternId, FloorPatternFn> = {
  grid, blueprint, wood, terrazzo, dots,
};

export function drawFloorPattern(
  id: FloorPatternId,
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  theme: PatternTheme,
  seed: number,
): void {
  PATTERNS[id](g, width, height, theme, seed);
}

/** Exported for unit tests only. */
export const _patternFns = PATTERNS;
