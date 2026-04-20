/**
 * Pure helpers + a thin Phaser renderer for the elevator scene's night-city
 * exterior backdrop. Split from `ElevatorSceneLayout` so the math (colour
 * interpolation, deterministic star placement) is unit-testable without
 * instantiating a Phaser scene.
 *
 * The backdrop is screen-locked (scrollFactor 0) — motion and parallax land
 * in later phases (skyline, façade). This phase only establishes the
 * atmosphere: a vertical gradient sky, a static moon with halo, and a
 * scattered starfield with a handful of slow twinklers.
 */
import type * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/** One placed star sprite's deterministic spec. */
export interface StarSpec {
  x: number;
  y: number;
  size: 1 | 2;
  bright: boolean;
  alpha: number;
}

/**
 * Linearly interpolate between two 24-bit RGB colours at parameter `t`
 * in `[0, 1]`. Channels are packed MSB→LSB as `0xRRGGBB`.
 */
export function lerpColor(a: number, b: number, t: number): number {
  const tt = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * tt);
  const g = Math.round(ag + (bg - ag) * tt);
  const bc = Math.round(ab + (bb - ab) * tt);
  return (r << 16) | (g << 8) | bc;
}

/**
 * 32-bit xorshift hash → pseudo-random float in `[0, 1)`. Deterministic for
 * a given seed so test snapshots and gameplay stay stable across reloads.
 */
function rng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 0x12345678;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    // Map to positive [0, 1)
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Produce a deterministic starfield across the given screen rectangle.
 * `count` stars roughly uniformly distributed, with a small fraction
 * upgraded to "bright" (2-px, white) while the rest are "dim" (1-px,
 * desaturated blue-white). Alpha varies per-star for depth.
 */
export function generateStars(
  count: number,
  width: number,
  height: number,
  seed = 0xcafef00d,
): StarSpec[] {
  const rand = rng(seed);
  const stars: StarSpec[] = [];
  for (let i = 0; i < count; i++) {
    const bright = rand() < 0.15;
    stars.push({
      x: Math.floor(rand() * width),
      y: Math.floor(rand() * height),
      size: bright ? 2 : 1,
      bright,
      alpha: 0.5 + rand() * 0.5,
    });
  }
  return stars;
}

/** Options for drawing the exterior backdrop. */
export interface SkyBackdropOptions {
  /** Screen-space width (usually GAME_WIDTH). */
  width: number;
  /** Screen-space height (usually GAME_HEIGHT). */
  height: number;
  /** Number of vertical gradient bands. More = smoother, fewer = chunkier. */
  gradientBands?: number;
  /** Star count. */
  starCount?: number;
  /** How many stars twinkle (alpha tween). Kept small to honour the motion budget. */
  twinkleCount?: number;
  /** Deterministic seed for starfield placement. */
  starSeed?: number;
}

/** Handles returned from {@link drawSkyBackdrop} so the caller can dispose tweens. */
export interface SkyBackdropHandle {
  /** Every game object that was added to the scene. */
  objects: Phaser.GameObjects.GameObject[];
  /** Active tweens (twinklers). The caller should add these to its own cleanup. */
  tweens: Phaser.Tweens.Tween[];
}

/**
 * Draw the night-city backdrop: gradient sky, moon, static stars, and a few
 * slow twinklers. Every object has `scrollFactor(0, 0)` so it stays glued to
 * the camera — the later skyline and façade layers are where parallax lives.
 *
 * Depths:
 *   -20  sky gradient
 *   -18  static stars
 *   -17  moon
 *   -17  twinkling stars (same plane as moon; they read as "near the moon")
 */
export function drawSkyBackdrop(
  scene: Phaser.Scene,
  opts: SkyBackdropOptions,
): SkyBackdropHandle {
  const {
    width,
    height,
    gradientBands = 24,
    starCount = 40,
    twinkleCount = 4,
    starSeed,
  } = opts;

  const objects: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];

  // 1. Sky gradient — horizontal bands interpolated zenith→horizon.
  const sky = scene.add.graphics().setDepth(-20).setScrollFactor(0, 0);
  const bandH = height / gradientBands;
  for (let i = 0; i < gradientBands; i++) {
    const t = gradientBands === 1 ? 0 : i / (gradientBands - 1);
    const color = lerpColor(theme.color.sky.zenith, theme.color.sky.horizon, t);
    sky.fillStyle(color, 1);
    // +1 height overlap closes sub-pixel seams between bands.
    sky.fillRect(0, Math.floor(i * bandH), width, Math.ceil(bandH) + 1);
  }
  objects.push(sky);

  // 2. Static starfield.
  const stars = scene.add.graphics().setDepth(-18).setScrollFactor(0, 0);
  const starSpecs = generateStars(starCount, width, height, starSeed);
  for (const s of starSpecs) {
    const color = s.bright ? theme.color.sky.starBright : theme.color.sky.starDim;
    stars.fillStyle(color, s.alpha);
    stars.fillRect(s.x, s.y, s.size, s.size);
  }
  objects.push(stars);

  // 3. Moon with halo — upper-right third of the viewport.
  const moonX = Math.round(width - width * 0.18);
  const moonY = Math.round(height * 0.18);
  const moon = scene.add.graphics().setDepth(-17).setScrollFactor(0, 0);
  moon.fillStyle(theme.color.sky.moonHalo, 0.10);
  moon.fillCircle(moonX, moonY, 34);
  moon.fillStyle(theme.color.sky.moonHalo, 0.18);
  moon.fillCircle(moonX, moonY, 24);
  moon.fillStyle(theme.color.sky.moon, 1);
  moon.fillCircle(moonX, moonY, 16);
  // Subtle crescent shadow so the moon isn't a flat disc.
  moon.fillStyle(theme.color.sky.horizon, 0.55);
  moon.fillCircle(moonX + 6, moonY - 2, 14);
  objects.push(moon);

  // 4. Twinkling stars — deterministic positions distinct from the static field.
  const twinkleSpecs = generateStars(twinkleCount, width, height, (starSeed ?? 0) ^ 0x9e3779b1);
  for (let i = 0; i < twinkleSpecs.length; i++) {
    const s = twinkleSpecs[i];
    const rect = scene.add
      .rectangle(s.x, s.y, 2, 2, theme.color.sky.starBright, 0.9)
      .setDepth(-17)
      .setScrollFactor(0, 0);
    objects.push(rect);
    const tw = scene.tweens.add({
      targets: rect,
      alpha: { from: 0.9, to: 0.25 },
      duration: 1800 + i * 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    tweens.push(tw);
  }

  return { objects, tweens };
}
