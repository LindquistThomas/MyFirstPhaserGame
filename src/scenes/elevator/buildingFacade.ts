/**
 * Outer-building façade rendered in the hallway strips on either side of
 * the elevator shaft. Gives the spaces between floor slabs a believable
 * "inside a lit office tower at night" backdrop — a dark wall with
 * pinstripe structural ribs, per-floor colour wash, and a grid of small
 * lit / dim / dark windows. A handful of windows tween alpha slowly so
 * the building feels occupied.
 *
 * Everything is painted (no cutouts) — windows don't reveal the actual
 * sky/skyline behind them. Rationale: the player is *inside* this
 * building, so the side-of-shaft walls represent interior architecture,
 * not an exterior curtain wall. The real city view lives above the
 * rooftop (skyline layer added in phase 2).
 *
 * Depth 0.4 sits above the sky gradient (−20) and skyline (−15), below
 * hallway floor tiles (2), outer shaft pillars (2.1), and decor (3+).
 */
import type * as Phaser from 'phaser';
import { theme } from '../../style/theme';

export interface FacadeBand {
  /** Y top of this band (world coords). */
  yTop: number;
  /** Y bottom of this band (world coords, > yTop). */
  yBottom: number;
  /** Per-floor wall tint applied as a low-alpha wash over the base. */
  wallColor: number;
  /** Deterministic seed — stable windows per floor across reloads. */
  seed: number;
}

export interface FacadeSide {
  /** X left edge (world coords). */
  xLeft: number;
  /** X right edge (world coords, > xLeft). */
  xRight: number;
}

export interface BuildingFacadeOptions {
  /** Two hallway strips to fill — left and right of the shaft. */
  sides: [FacadeSide, FacadeSide];
  /** Per-floor bands, sorted by yTop ascending. */
  bands: FacadeBand[];
  /** Max twinkling windows (alpha tweens) across the whole façade, to keep the motion budget honest. */
  twinkleBudget?: number;
  /** Max flickering windows (brief alpha dips) across the whole façade. */
  flickerBudget?: number;
  /**
   * Vertical parallax factor applied to every façade element so the outer
   * wall reads as "behind" the shaft. 1 = scrolls with the shaft (no depth);
   * < 1 = drifts slower than the shaft as the camera moves. Default: 0.72.
   * The horizontal factor is always 1 — the shaft doesn't pan horizontally.
   */
  scrollFactorY?: number;
}

export interface BuildingFacadeHandle {
  objects: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
  timers: Phaser.Time.TimerEvent[];
}

export interface FacadeWindowSpec {
  /** Local x, relative to the side's xLeft + band's yTop. */
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'lit' | 'dim' | 'dark';
  /** Twinklers get their own GameObject + tween. */
  twinkle: boolean;
  /** Flickerers get their own GameObject + timer chain. */
  flicker: boolean;
}

function rng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 0x12345678;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Deterministically generate a grid of windows that fits inside a
 * rectangle of the given dimensions, with sensible margins. Distribution:
 * ~28% lit, ~22% dim, ~50% dark.
 */
export function generateFacadeWindows(
  width: number,
  height: number,
  seed: number,
  opts: { twinkles?: number; flickers?: number } = {},
): FacadeWindowSpec[] {
  const rand = rng(seed);
  const { twinkles = 1, flickers = 0 } = opts;

  const winW = 5;
  const winH = 7;
  const gutterX = 7;
  const gutterY = 8;
  const marginX = 10;
  const marginY = 12;

  const cols = Math.max(0, Math.floor((width - marginX * 2 + gutterX) / (winW + gutterX)));
  const rows = Math.max(0, Math.floor((height - marginY * 2 + gutterY) / (winH + gutterY)));

  const windows: FacadeWindowSpec[] = [];
  let twinklesPlaced = 0;
  let flickersPlaced = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rand();
      let state: FacadeWindowSpec['state'];
      if (roll > 0.72) state = 'lit';
      else if (roll > 0.50) state = 'dim';
      else state = 'dark';

      const canTwinkle = state === 'lit' && twinklesPlaced < twinkles && rand() < 0.18;
      // Flickers only on windows that aren't already twinkling — avoid
      // layered alpha animations fighting over the same rectangle.
      const canFlicker =
        !canTwinkle && state === 'lit' && flickersPlaced < flickers && rand() < 0.08;
      windows.push({
        x: marginX + c * (winW + gutterX),
        y: marginY + r * (winH + gutterY),
        width: winW,
        height: winH,
        state,
        twinkle: canTwinkle,
        flicker: canFlicker,
      });
      if (canTwinkle) twinklesPlaced++;
      if (canFlicker) flickersPlaced++;
    }
  }

  return windows;
}

/** Render the façade. See module docstring for layer semantics. */
export function drawBuildingFacade(
  scene: Phaser.Scene,
  opts: BuildingFacadeOptions,
): BuildingFacadeHandle {
  const { sides, bands, twinkleBudget = 10, flickerBudget = 4, scrollFactorY = 0.72 } = opts;

  const objects: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];
  let twinklesRemaining = twinkleBudget;
  let flickersRemaining = flickerBudget;

  for (const side of sides) {
    const sideW = side.xRight - side.xLeft;
    if (sideW <= 0) continue;

    const gfx = scene.add.graphics().setDepth(0.4).setScrollFactor(1, scrollFactorY);
    objects.push(gfx);

    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const bandH = band.yBottom - band.yTop;
      if (bandH <= 0) continue;

      // Base fill — near-black interior wall.
      gfx.fillStyle(theme.color.bg.dark, 1);
      gfx.fillRect(side.xLeft, band.yTop, sideW, bandH);

      // Per-floor wall tint, low alpha so it reads as atmosphere, not wallpaper.
      gfx.fillStyle(band.wallColor, 0.14);
      gfx.fillRect(side.xLeft, band.yTop, sideW, bandH);

      // Vertical structural ribs — subtle 1-px pinstripes every 32px.
      gfx.fillStyle(theme.color.bg.mid, 0.35);
      for (let rx = side.xLeft + 16; rx < side.xRight - 8; rx += 32) {
        gfx.fillRect(rx, band.yTop, 1, bandH);
      }

      // NOTE: No explicit horizontal "slab seam" line between adjacent bands.
      // Previous revision drew one for visual separation, but once the façade
      // has scrollFactor < 1, seam lines authored at slab Y positions drift
      // out of alignment with the actual slabs and visibly lag behind. The
      // pinstripe ribs and window grid carry the vertical rhythm on their own.

      // Window grid.
      const windows = generateFacadeWindows(sideW, bandH, band.seed ^ (side.xLeft | 0), {
        twinkles: Math.max(0, twinklesRemaining),
        flickers: Math.max(0, flickersRemaining),
      });
      for (const w of windows) {
        if (w.twinkle || w.flicker) continue;
        if (w.state === 'dark') {
          // Dark frame so an "empty office" still reads as a window, not a blank wall.
          gfx.fillStyle(theme.color.bg.mid, 0.35);
          gfx.fillRect(side.xLeft + w.x, band.yTop + w.y, w.width, w.height);
          continue;
        }
        const color = w.state === 'lit' ? theme.color.sky.windowLit : theme.color.sky.windowDim;
        const alpha = w.state === 'lit' ? 0.80 : 0.45;
        gfx.fillStyle(color, alpha);
        gfx.fillRect(side.xLeft + w.x, band.yTop + w.y, w.width, w.height);
        // Warm halo under lit windows to imply interior glow spilling onto the sill.
        if (w.state === 'lit') {
          gfx.fillStyle(color, 0.15);
          gfx.fillRect(side.xLeft + w.x - 1, band.yTop + w.y + w.height, w.width + 2, 1);
        }
      }

      // Twinklers as individual Rectangles so a tween can animate alpha.
      for (const w of windows) {
        if (!w.twinkle || twinklesRemaining <= 0) continue;
        const rect = scene.add
          .rectangle(
            side.xLeft + w.x + w.width / 2,
            band.yTop + w.y + w.height / 2,
            w.width,
            w.height,
            theme.color.sky.windowLit,
            0.85,
          )
          .setDepth(0.41)
          .setScrollFactor(1, scrollFactorY);
        objects.push(rect);
        const tw = scene.tweens.add({
          targets: rect,
          alpha: { from: 0.85, to: 0.3 },
          duration: 2400 + twinklesRemaining * 330,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        tweens.push(tw);
        twinklesRemaining--;
      }

      // Flickers: quick alpha dip (fluorescent stutter) with a long random
      // pause in between. Implemented as a chained TimerEvent so each
      // window keeps its own irregular cadence without a shared tween.
      for (const w of windows) {
        if (!w.flicker || flickersRemaining <= 0) continue;
        const rect = scene.add
          .rectangle(
            side.xLeft + w.x + w.width / 2,
            band.yTop + w.y + w.height / 2,
            w.width,
            w.height,
            theme.color.sky.windowLit,
            0.80,
          )
          .setDepth(0.41)
          .setScrollFactor(1, scrollFactorY);
        objects.push(rect);

        // xorshift-ish: seed derived from window position so flicker cadence is stable.
        const seed = (band.seed ^ (w.x * 73856093) ^ (w.y * 19349663)) >>> 0;
        const pauseRand = rng(seed);
        const nextPause = (): number => 4000 + Math.floor(pauseRand() * 5000);

        // One reserved slot per flicker window — always holds the single
        // pending TimerEvent. Swapping in place prevents the array from
        // growing over time (each flicker spawns two timers per cycle).
        const slot = timers.length;
        let pending: Phaser.Time.TimerEvent | null = null;
        const setPending = (t: Phaser.Time.TimerEvent): void => {
          pending = t;
          timers[slot] = t;
        };

        const doFlicker = (): void => {
          pending = null;
          if (!rect.active) return;
          rect.setAlpha(0.20);
          setPending(
            scene.time.delayedCall(60, () => {
              pending = null;
              if (!rect.active) return;
              rect.setAlpha(0.80);
              setPending(scene.time.delayedCall(nextPause(), doFlicker));
            }),
          );
        };

        // Stagger initial fires so they don't all pop at t=0.
        setPending(
          scene.time.delayedCall(1000 + Math.floor(pauseRand() * 4000), doFlicker),
        );
        // Reference `pending` once so TS doesn't flag it as write-only — it
        // exists as a debug-friendly handle on the latest timer.
        void pending;
        flickersRemaining--;
      }
    }
  }

  return { objects, tweens, timers };
}
