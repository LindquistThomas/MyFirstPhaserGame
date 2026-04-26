/**
 * Outer-building façade rendered in the hallway strips on either side of
 * the elevator shaft. Gives the spaces between floor slabs a believable
 * "inside a lit office tower at night" backdrop — a dark wall with
 * pinstripe structural ribs, per-floor colour wash, and a grid of small
 * lit / dim / dark windows.
 *
 * Beyond the base "mostly dark with scattered warm squares" grid, lit
 * windows come in three tints (warm / cool / green) and three kinds
 * (plain / blinds / monitor). A handful of render-time effects are
 * layered on top with strict per-façade budgets so total motion cost
 * stays bounded regardless of shaft height:
 *
 *   - twinkle    — quick alpha yoyo (most lit windows eligible).
 *   - flicker    — quick fluorescent stutter on a short irregular interval.
 *   - switch     — discrete on/off toggle on a short 1.5–6s cycle.
 *   - occupant   — tiny dark silhouette briefly crosses a lit window.
 *   - monitor    — fast subtle alpha jitter on cool/green monitor windows.
 *   - blinds     — stripe overlay slowly scales open/closed (rare).
 *   - ride drift — selected visible windows wrap vertically while the cab moves.
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
  /** Max quick alpha-yoyo windows across the whole façade. */
  twinkleBudget?: number;
  /** Max fluorescent-flicker windows across the whole façade. */
  flickerBudget?: number;
  /** Max lit windows that discretely toggle on/off across the whole façade. */
  switchBudget?: number;
  /** Max windows that host an occupant silhouette crosser. */
  occupantBudget?: number;
  /** Max cool/green windows that receive a fast monitor-glow flicker. */
  monitorBudget?: number;
  /** Max blinds windows where the stripe overlay slowly scales open/closed. */
  blindsAnimBudget?: number;
  /** Max visible windows that drift as an arcade ride-motion layer. */
  motionBudget?: number;
  /** Multiplier applied to elevator velocity for ride-time window drift. */
  motionSpeedMultiplier?: number;
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
  updateMotion(deltaMs: number, elevatorVelocityY: number): void;
}

export type FacadeWindowTint = 'warm' | 'cool' | 'green';
export type FacadeWindowKind = 'plain' | 'blinds' | 'monitor';

export interface FacadeWindowMotionSpec {
  /** Per-window speed multiplier applied to the global ride-motion speed. */
  speedMultiplier: number;
  /** Overlay alpha used for the moving copy of the window. */
  alpha: number;
  /** Stable phase slot reserved for future small idle offsets / testability. */
  phase: number;
}

const WINDOW_WIDTH = 8;
const WINDOW_HEIGHT = 11;
const WINDOW_GUTTER_X = 9;
const WINDOW_GUTTER_Y = 9;
const WINDOW_MARGIN_X = 12;
const WINDOW_MARGIN_Y = 14;

const FLICKER_PAUSE_MIN_MS = 600;
const FLICKER_PAUSE_SPREAD_MS = 1400;
const SWITCH_DELAY_MIN_MS = 1500;
const SWITCH_DELAY_SPREAD_MS = 4500;
const OCCUPANT_DELAY_MIN_MS = 3000;
const OCCUPANT_DELAY_SPREAD_MS = 6000;
const MOTION_IDLE_VELOCITY_EPSILON = 8;
const MOTION_DEPTH = 0.49;

interface FacadeMotionWindow {
  rect: Phaser.GameObjects.Rectangle;
  y: number;
  yTop: number;
  yBottom: number;
  height: number;
  speedMultiplier: number;
}

export interface FacadeWindowSpec {
  /** Local x, relative to the side's xLeft + band's yTop. */
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'lit' | 'dim' | 'dark';
  /** Colour family for lit windows only. Ignored visually for `dim` + `dark`. */
  tint: FacadeWindowTint;
  /** Rendering variant for lit windows. `dim` + `dark` always read as plain. */
  kind: FacadeWindowKind;
  /** Twinklers get their own GameObject + tween. */
  twinkle: boolean;
  /** Flickerers get their own GameObject + timer chain. */
  flicker: boolean;
  /** Moving overlay metadata. Present only for bounded ride-motion windows. */
  motion?: FacadeWindowMotionSpec;
}

export function wrapFacadeMotionY(
  centerY: number,
  yTop: number,
  yBottom: number,
  windowHeight: number,
): number {
  const halfH = windowHeight / 2;
  const minY = yTop + halfH;
  const maxY = yBottom - halfH;
  if (maxY <= minY) return (yTop + yBottom) / 2;
  if (centerY >= minY && centerY <= maxY) return centerY;

  const span = maxY - minY;
  let wrapped = (centerY - minY) % span;
  if (wrapped < 0) wrapped += span;
  return minY + wrapped;
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

function pickTint(roll: number): FacadeWindowTint {
  // 70% warm, 20% cool, 10% green — warm is the default "occupied office".
  if (roll < 0.70) return 'warm';
  if (roll < 0.90) return 'cool';
  return 'green';
}

function tintColor(tint: FacadeWindowTint): number {
  switch (tint) {
    case 'cool':
      return theme.color.sky.windowLitCool;
    case 'green':
      return theme.color.sky.windowLitGreen;
    case 'warm':
    default:
      return theme.color.sky.windowLit;
  }
}

/**
 * Deterministically generate a grid of windows that fits inside a
 * rectangle of the given dimensions, with sensible margins. Distribution:
 * ~38% lit, ~22% dim, ~40% dark. Lit windows receive a stable tint + kind.
 */
export function generateFacadeWindows(
  width: number,
  height: number,
  seed: number,
  opts: { twinkles?: number; flickers?: number; movers?: number } = {},
): FacadeWindowSpec[] {
  const rand = rng(seed);
  const { twinkles = 1, flickers = 0, movers = 0 } = opts;

  const cols = Math.max(
    0,
    Math.floor((width - WINDOW_MARGIN_X * 2 + WINDOW_GUTTER_X) / (WINDOW_WIDTH + WINDOW_GUTTER_X)),
  );
  const rows = Math.max(
    0,
    Math.floor((height - WINDOW_MARGIN_Y * 2 + WINDOW_GUTTER_Y) / (WINDOW_HEIGHT + WINDOW_GUTTER_Y)),
  );

  const windows: FacadeWindowSpec[] = [];
  let twinklesPlaced = 0;
  let flickersPlaced = 0;
  let moversPlaced = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rand();
      let state: FacadeWindowSpec['state'];
      if (roll > 0.62) state = 'lit';
      else if (roll > 0.40) state = 'dim';
      else state = 'dark';

      // Tint + kind decided up-front so later effect passes can key off
      // them (e.g. monitor-glow flicker only attaches to kind=monitor).
      const tint: FacadeWindowTint = pickTint(rand());
      let kind: FacadeWindowKind = 'plain';
      if (state === 'lit') {
        const kindRoll = rand();
        if (kindRoll < 0.70) kind = 'plain';
        else if (kindRoll < 0.90) kind = 'blinds';
        else kind = 'monitor';
      } else {
        // Consume an RNG draw so lit/non-lit windows advance the stream
        // by the same amount — avoids state distribution drift as the
        // effect set grows.
        rand();
      }

      const canTwinkle = state === 'lit' && twinklesPlaced < twinkles && rand() < 0.18;
      // Flickers only on windows that aren't already twinkling — avoid
      // layered alpha animations fighting over the same rectangle.
      const canFlicker =
        !canTwinkle && state === 'lit' && flickersPlaced < flickers && rand() < 0.08;
      const canMove =
        !canTwinkle
        && !canFlicker
        && state !== 'dark'
        && moversPlaced < movers
        && rand() < 0.24;
      const spec: FacadeWindowSpec = {
        x: WINDOW_MARGIN_X + c * (WINDOW_WIDTH + WINDOW_GUTTER_X),
        y: WINDOW_MARGIN_Y + r * (WINDOW_HEIGHT + WINDOW_GUTTER_Y),
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        state,
        tint,
        kind,
        twinkle: canTwinkle,
        flicker: canFlicker,
      };
      if (canMove) {
        spec.motion = {
          speedMultiplier: 0.85 + rand() * 0.9,
          alpha: state === 'lit' ? 0.70 + rand() * 0.22 : 0.34 + rand() * 0.18,
          phase: rand(),
        };
      }
      windows.push(spec);
      if (canTwinkle) twinklesPlaced++;
      if (canFlicker) flickersPlaced++;
      if (canMove) moversPlaced++;
    }
  }

  return windows;
}

/** Render the façade. See module docstring for layer semantics. */
export function drawBuildingFacade(
  scene: Phaser.Scene,
  opts: BuildingFacadeOptions,
): BuildingFacadeHandle {
  const {
    sides,
    bands,
    twinkleBudget = 36,
    flickerBudget = 18,
    switchBudget = 28,
    occupantBudget = 12,
    monitorBudget = 18,
    blindsAnimBudget = 10,
    motionBudget = 90,
    motionSpeedMultiplier = 2.8,
    scrollFactorY = 0.72,
  } = opts;

  const objects: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];
  const motionWindows: FacadeMotionWindow[] = [];

  let twinklesRemaining = twinkleBudget;
  let flickersRemaining = flickerBudget;
  let switchesRemaining = switchBudget;
  let occupantsRemaining = occupantBudget;
  let monitorsRemaining = monitorBudget;
  let blindsAnimsRemaining = blindsAnimBudget;
  let motionsRemaining = motionBudget;

  // Seeded per-façade RNG for effect selection so which lit windows get
  // which effect is stable per build. Tween/timer *timing* uses
  // Math.random — invisible drift, no determinism needed.
  const effectRand = rng(
    0xfacade ^
      (sides[0].xLeft | 0) ^
      ((sides[1].xRight | 0) << 3) ^
      (bands.length * 0x9e3779b1),
  );

  for (const side of sides) {
    const sideW = side.xRight - side.xLeft;
    if (sideW <= 0) continue;

    const gfx = scene.add.graphics().setDepth(0.4).setScrollFactor(1, scrollFactorY);
    objects.push(gfx);

    for (let i = 0; i < bands.length; i++) {
      const band = bands[i]!;
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
        movers: Math.max(0, motionsRemaining),
      });

      // Static paint pass (everything except twinkle/flicker, which own
      // their own Rectangle so a tween/timer can manipulate alpha).
      for (const w of windows) {
        if (w.twinkle || w.flicker) continue;
        if (w.state === 'dark') {
          // Dark frame so an "empty office" still reads as a window, not a blank wall.
          gfx.fillStyle(theme.color.bg.mid, 0.50);
          gfx.fillRect(side.xLeft + w.x, band.yTop + w.y, w.width, w.height);
          continue;
        }
        const baseColor =
          w.state === 'lit' ? tintColor(w.tint) : theme.color.sky.windowDim;
        // Monitor windows read slightly softer so the flicker tween has
        // somewhere to travel without clipping.
        const alpha =
          w.state === 'lit' ? (w.kind === 'monitor' ? 0.86 : 0.94) : 0.56;
        gfx.fillStyle(baseColor, alpha);
        gfx.fillRect(side.xLeft + w.x, band.yTop + w.y, w.width, w.height);

        // Bright top edge so lit windows read at elevator-ride speed.
        if (w.state === 'lit') {
          gfx.fillStyle(theme.color.sky.starBright, 0.18);
          gfx.fillRect(side.xLeft + w.x, band.yTop + w.y, w.width, 1);
        }

        // Static blinds stripes — thin dark horizontals drawn over the lit
        // fill so the window reads as "shade drawn".
        if (w.state === 'lit' && w.kind === 'blinds') {
          gfx.fillStyle(theme.color.sky.windowBlinds, 0.55);
          for (let sy = 1; sy < w.height; sy += 2) {
            gfx.fillRect(side.xLeft + w.x, band.yTop + w.y + sy, w.width, 1);
          }
        }

        // Warm halo under lit windows to imply interior glow spilling onto the sill.
        if (w.state === 'lit') {
          gfx.fillStyle(baseColor, 0.24);
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
            tintColor(w.tint),
            0.96,
          )
          .setDepth(0.41)
          .setScrollFactor(1, scrollFactorY);
        objects.push(rect);
        const tw = scene.tweens.add({
          targets: rect,
          alpha: { from: 0.96, to: 0.12 },
          duration: 520 + (twinklesRemaining % 7) * 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        tweens.push(tw);
        twinklesRemaining--;
      }

      // Flickers: quick alpha dip (fluorescent stutter) with a short random
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
            tintColor(w.tint),
            0.96,
          )
          .setDepth(0.41)
          .setScrollFactor(1, scrollFactorY);
        objects.push(rect);

        // xorshift-ish: seed derived from window position so flicker cadence is stable.
        const seed = (band.seed ^ (w.x * 73856093) ^ (w.y * 19349663)) >>> 0;
        const pauseRand = rng(seed);
        const nextPause = (): number =>
          FLICKER_PAUSE_MIN_MS + Math.floor(pauseRand() * FLICKER_PAUSE_SPREAD_MS);

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
          rect.setAlpha(0.08);
          setPending(
            scene.time.delayedCall(55, () => {
              pending = null;
              if (!rect.active) return;
              rect.setAlpha(0.96);
              setPending(scene.time.delayedCall(90, () => {
                pending = null;
                if (!rect.active) return;
                rect.setAlpha(0.30);
                setPending(scene.time.delayedCall(70, () => {
                  pending = null;
                  if (!rect.active) return;
                  rect.setAlpha(0.96);
                  setPending(scene.time.delayedCall(nextPause(), doFlicker));
                }));
              }));
            }),
          );
        };

        // Stagger initial fires so they don't all pop at t=0.
        setPending(
          scene.time.delayedCall(80 + Math.floor(pauseRand() * 700), doFlicker),
        );
        // Reference `pending` once so TS doesn't flag it as write-only — it
        // exists as a debug-friendly handle on the latest timer.
        void pending;
        flickersRemaining--;
      }

      // Moving overlays. These are intentionally separate from the baked
      // graphics layer so ride-time motion can be exaggerated without
      // redrawing the whole façade each frame.
      for (const w of windows) {
        if (!w.motion || motionsRemaining <= 0) continue;
        const cx = side.xLeft + w.x + w.width / 2;
        const cy = band.yTop + w.y + w.height / 2;
        const color = w.state === 'lit' ? tintColor(w.tint) : theme.color.sky.windowDim;
        const rect = scene.add
          .rectangle(cx, cy, w.width, w.height, color, w.motion.alpha)
          .setDepth(MOTION_DEPTH)
          .setScrollFactor(1, scrollFactorY);
        objects.push(rect);
        motionWindows.push({
          rect,
          y: cy,
          yTop: band.yTop,
          yBottom: band.yBottom,
          height: w.height,
          speedMultiplier: w.motion.speedMultiplier,
        });
        motionsRemaining--;
      }

      // Extra dynamic layers — switch / monitor / blinds-anim / occupant.
      // All attach to lit windows that aren't already twinkling or flickering
      // so competing animations don't stack on the same rectangle.
      for (const w of windows) {
        if (w.state !== 'lit' || w.twinkle || w.flicker) continue;
        const cx = side.xLeft + w.x + w.width / 2;
        const cy = band.yTop + w.y + w.height / 2;
        const baseColor = tintColor(w.tint);

        // Light switches on/off. An "off" overlay (dark body + thin frame)
        // is drawn on top of the static lit paint and toggled visible on
        // each timer fire. Cheaper than managing two competing paints.
        if (
          switchesRemaining > 0 &&
          w.kind !== 'monitor' &&
          effectRand() < 0.10
        ) {
          const offPatch = scene.add
            .rectangle(cx, cy, w.width, w.height, theme.color.bg.dark, 0.92)
            .setDepth(0.405)
            .setScrollFactor(1, scrollFactorY)
            .setVisible(false);
          const offFrame = scene.add
            .rectangle(cx, cy, w.width, w.height, theme.color.bg.mid, 0.60)
            .setDepth(0.406)
            .setScrollFactor(1, scrollFactorY)
            .setVisible(false);
          objects.push(offPatch, offFrame);
          const fire = (): void => {
            if (!offPatch.active) return;
            const isOffVisible = offPatch.visible;
            offPatch.setVisible(!isOffVisible);
            offFrame.setVisible(!isOffVisible);
          };
          timers.push(
            scene.time.addEvent({
              delay: SWITCH_DELAY_MIN_MS + Math.random() * SWITCH_DELAY_SPREAD_MS,
              loop: true,
              callback: fire,
            }),
          );
          switchesRemaining--;
          continue;
        }

        // Monitor glow — fast subtle alpha jitter on cool/green monitors.
        if (
          monitorsRemaining > 0 &&
          w.kind === 'monitor' &&
          (w.tint === 'cool' || w.tint === 'green')
        ) {
          const rect = scene.add
            .rectangle(cx, cy, w.width, w.height, baseColor, 0.86)
            .setDepth(0.412)
            .setScrollFactor(1, scrollFactorY);
          objects.push(rect);
          tweens.push(
            scene.tweens.add({
              targets: rect,
              alpha: { from: 0.30, to: 1 },
              duration: 55 + Math.floor(Math.random() * 80),
              yoyo: true,
              repeat: -1,
              ease: 'Sine.inOut',
            }),
          );
          monitorsRemaining--;
          continue;
        }

        // Animated blinds — a solid shade block occasionally slides from
        // fully closed (scaleY 1) to nearly open (scaleY 0.1). Static stripe
        // detail is already baked into the underlying window by the paint pass.
        if (
          blindsAnimsRemaining > 0 &&
          w.kind === 'blinds' &&
          effectRand() < 0.35
        ) {
          const blind = scene.add
            .rectangle(cx, cy, w.width, w.height, theme.color.sky.windowBlinds, 0.55)
            .setDepth(0.413)
            .setScrollFactor(1, scrollFactorY);
          objects.push(blind);
          tweens.push(
            scene.tweens.add({
              targets: blind,
              scaleY: { from: 1, to: 0.1 },
              duration: 900 + Math.floor(Math.random() * 600),
              yoyo: true,
              repeat: -1,
              delay: 700 + Math.floor(Math.random() * 1100),
              repeatDelay: 2500 + Math.floor(Math.random() * 2500),
              ease: 'Sine.inOut',
            }),
          );
          blindsAnimsRemaining--;
          continue;
        }

        // Occupant silhouette — rare crosser. Tiny dark figure slides from
        // one edge of the window to the other on an irregular interval.
        if (
          occupantsRemaining > 0 &&
          w.kind !== 'monitor' &&
          effectRand() < 0.10
        ) {
          const figureW = Math.max(3, Math.ceil(w.width * 0.55));
          const figureH = Math.max(5, w.height);
          const leftEdge = side.xLeft + w.x - figureW;
          const rightEdge = side.xLeft + w.x + w.width + figureW;
          const figure = scene.add
            .rectangle(leftEdge, cy, figureW, figureH, theme.color.bg.dark, 0.9)
            .setDepth(0.414)
            .setScrollFactor(1, scrollFactorY)
            .setVisible(false);
          objects.push(figure);
          const cross = (): void => {
            if (!figure.active) return;
            const direction = Math.random() < 0.5 ? 1 : -1;
            const fromX = direction === 1 ? leftEdge : rightEdge;
            const toX = direction === 1 ? rightEdge : leftEdge;
            figure.x = fromX;
            figure.setVisible(true);
            const tween = scene.tweens.add({
              targets: figure,
              x: toX,
              duration: 650 + Math.floor(Math.random() * 600),
              ease: 'Linear',
              onComplete: () => figure.setVisible(false),
            });
            tweens.push(tween);
          };
          timers.push(
            scene.time.addEvent({
              delay: OCCUPANT_DELAY_MIN_MS + Math.random() * OCCUPANT_DELAY_SPREAD_MS,
              loop: true,
              callback: cross,
            }),
          );
          occupantsRemaining--;
        }
      }
    }
  }

  const updateMotion = (deltaMs: number, elevatorVelocityY: number): void => {
    if (motionWindows.length === 0 || Math.abs(elevatorVelocityY) < MOTION_IDLE_VELOCITY_EPSILON) {
      return;
    }
    const dt = Math.min(Math.max(deltaMs, 0), 64) / 1000;
    if (dt === 0) return;

    const travel = -elevatorVelocityY * motionSpeedMultiplier * dt;
    for (const w of motionWindows) {
      w.y = wrapFacadeMotionY(
        w.y + travel * w.speedMultiplier,
        w.yTop,
        w.yBottom,
        w.height,
      );
      w.rect.setY(w.y);
    }
  };

  return { objects, tweens, timers, updateMotion };
}
