/**
 * Per-floor silhouette accents painted on top of the scene backdrop's
 * gradient + pattern + vignette. Each floor gets one large background
 * motif and exactly one ambient tween so the rooms feel inhabited
 * without competing with the foreground decor.
 *
 * All silhouettes are drawn at depth 0 (same as the backdrop), which
 * puts them behind tiles (depth 1+), props, and the HUD. The static
 * silhouette goes onto the shared Graphics passed by `sceneBackdrop`;
 * the animated element is its own Rectangle so a tween can animate it.
 *
 * Tweens are created via `scene.tweens.add` — Phaser auto-kills them on
 * scene shutdown, so no manual teardown is required.
 */
import type * as Phaser from 'phaser';
import { FLOORS, FloorId } from '../../../config/gameConfig';

export interface AccentTheme {
  backgroundColor: number;
  wallColor: number;
  platformColor: number;
  tokenColor: number;
}

export interface FloorAccentArgs {
  scene: Phaser.Scene;
  g: Phaser.GameObjects.Graphics;
  width: number;
  height: number;
  theme: AccentTheme;
}

type AccentFn = (args: FloorAccentArgs) => void;

/**
 * Distant city silhouette + one slow-blinking skyscraper window — reads
 * as "view through a lobby window" without clashing with the foreground
 * concierge desk / plants.
 */
const lobbyAccent: AccentFn = ({ scene, g, width, height, theme }) => {
  const baseY = Math.round(height * 0.78);
  const silhouetteColor = 0x000000;
  g.fillStyle(silhouetteColor, 0.45);
  // Five rectangular towers of varying heights, deterministic layout.
  const towers = [
    { x: 40, w: 60, h: 140 },
    { x: 140, w: 90, h: 220 },
    { x: 280, w: 50, h: 100 },
    { x: 380, w: 110, h: 260 },
    { x: 540, w: 70, h: 170 },
    { x: 680, w: 40, h: 90 },
    { x: 760, w: 120, h: 200 },
    { x: 920, w: 60, h: 140 },
    { x: 1020, w: 80, h: 230 },
    { x: 1160, w: 100, h: 180 },
  ];
  for (const t of towers) {
    const x = (t.x / 1280) * width;
    const w = (t.w / 1280) * width;
    g.fillRect(x, baseY - t.h, w, t.h + 4);
  }
  // Dim specks of "windows" on the biggest tower.
  g.fillStyle(theme.tokenColor, 0.25);
  const bigTowerX = (380 / 1280) * width;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 3; col++) {
      if ((row * 3 + col) % 5 === 0) continue; // scattered gaps
      g.fillRect(
        bigTowerX + 8 + col * 18,
        baseY - 260 + 20 + row * 18,
        4,
        6,
      );
    }
  }
  // Animated: one window slowly pulsing.
  const pulse = scene.add
    .rectangle(bigTowerX + 8, baseY - 260 + 56, 4, 6, theme.tokenColor, 0.8)
    .setOrigin(0, 0)
    .setDepth(0);
  scene.tweens.add({
    targets: pulse,
    alpha: { from: 0.9, to: 0.25 },
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
};

/**
 * Platform team — server-rack silhouettes along the back wall with one
 * blinking status LED.
 */
const platformAccent: AccentFn = ({ scene, g, width, height, theme }) => {
  const rackTop = Math.round(height * 0.18);
  const rackBottom = Math.round(height * 0.62);
  const rackH = rackBottom - rackTop;
  const rackW = 88;
  const gap = 22;
  const total = Math.floor(width / (rackW + gap));
  const startX = (width - (total * (rackW + gap) - gap)) / 2;
  for (let i = 0; i < total; i++) {
    const x = startX + i * (rackW + gap);
    // Rack body.
    g.fillStyle(0x000000, 0.4);
    g.fillRect(x, rackTop, rackW, rackH);
    // Front-panel seams.
    g.fillStyle(theme.wallColor, 0.25);
    for (let u = 1; u < 10; u++) {
      g.fillRect(x + 6, rackTop + (rackH / 10) * u, rackW - 12, 1);
    }
    // Tiny static status dots (dark red / dim green).
    g.fillStyle(0x3aff6f, 0.35);
    g.fillRect(x + 10, rackTop + 10, 2, 2);
    g.fillStyle(0xff5555, 0.25);
    g.fillRect(x + 16, rackTop + 10, 2, 2);
  }
  // Animated: single blinking LED on the middle rack.
  const midX = startX + Math.floor(total / 2) * (rackW + gap);
  const led = scene.add
    .rectangle(midX + 10, rackTop + 10, 2, 2, 0x3aff6f, 1)
    .setOrigin(0, 0)
    .setDepth(0);
  scene.tweens.add({
    targets: led,
    alpha: { from: 1, to: 0.15 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Cubic.inOut',
  });
};

/**
 * Business — a wall-mounted bar chart silhouette with one bar that
 * subtly pulses up and down, implying a live dashboard.
 */
const businessAccent: AccentFn = ({ scene, g, width, height, theme }) => {
  const chartX = Math.round(width * 0.32);
  const chartY = Math.round(height * 0.22);
  const chartW = Math.round(width * 0.36);
  const chartH = Math.round(height * 0.30);
  // Frame.
  g.fillStyle(0x000000, 0.30);
  g.fillRect(chartX, chartY, chartW, chartH);
  g.lineStyle(2, theme.platformColor, 0.35);
  g.strokeRect(chartX, chartY, chartW, chartH);
  // Bars.
  const barCount = 7;
  const barGap = 8;
  const barW = Math.floor((chartW - 40 - barGap * (barCount - 1)) / barCount);
  const heights = [0.35, 0.55, 0.45, 0.72, 0.60, 0.88, 0.50];
  for (let i = 0; i < barCount; i++) {
    const bx = chartX + 20 + i * (barW + barGap);
    const bh = Math.round(heights[i]! * (chartH - 40));
    g.fillStyle(theme.tokenColor, 0.45);
    g.fillRect(bx, chartY + chartH - 20 - bh, barW, bh);
  }
  // Animated: pulse the tallest bar (index 5).
  const pulseI = 5;
  const pulseX = chartX + 20 + pulseI * (barW + barGap);
  const maxH = Math.round(heights[pulseI]! * (chartH - 40));
  const bar = scene.add
    .rectangle(pulseX, chartY + chartH - 20, barW, maxH, theme.tokenColor, 0.85)
    .setOrigin(0, 1)
    .setDepth(0);
  scene.tweens.add({
    targets: bar,
    scaleY: { from: 1, to: 0.7 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
};

/**
 * Executive — arched window on the back wall with a moon and horizon,
 * plus a slow halo breathe on the moon.
 */
const executiveAccent: AccentFn = ({ scene, g, width, height, theme }) => {
  const cx = width / 2;
  const archW = Math.round(width * 0.48);
  const archH = Math.round(height * 0.55);
  const archX = cx - archW / 2;
  const archY = Math.round(height * 0.12);
  const windowTop = archY + archH / 4;
  // Arched window: rectangle body + half-circle top, both filled with
  // a deep night-sky tone.
  g.fillStyle(0x0a0f22, 0.85);
  g.fillRect(archX, windowTop, archW, (3 * archH) / 4);
  g.fillCircle(cx, windowTop, archW / 2);
  // Distant horizon band across the bottom of the window.
  g.fillStyle(0x000000, 0.5);
  g.fillRect(archX, archY + archH - 24, archW, 24);
  // Frame + mullions, tinted with the floor's platform colour.
  g.lineStyle(3, theme.platformColor, 0.55);
  g.strokeRect(archX, windowTop, archW, (3 * archH) / 4);
  g.lineStyle(2, theme.platformColor, 0.35);
  g.lineBetween(cx, windowTop, cx, archY + archH);
  g.lineBetween(archX, windowTop + archH * 0.30, archX + archW, windowTop + archH * 0.30);
  // Static moon disc.
  const moonX = cx + archW * 0.18;
  const moonY = windowTop + archH * 0.20;
  g.fillStyle(0xf2ead0, 0.85);
  g.fillCircle(moonX, moonY, 18);
  // Animated: a breathing halo around the moon — scale + alpha.
  const halo = scene.add.circle(moonX, moonY, 28, 0xf2ead0, 0.22).setDepth(0);
  scene.tweens.add({
    targets: halo,
    scale: { from: 1.0, to: 1.35 },
    alpha: { from: 0.28, to: 0.08 },
    duration: 3400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
};

/**
 * Products — wall of numbered crate silhouettes with one crate that
 * subtly pulses brighter, hinting at "new arrival".
 */
const productsAccent: AccentFn = ({ scene, g, width, height, theme }) => {
  const rows = 3;
  const cols = 8;
  const crateW = 100;
  const crateH = 70;
  const gapX = 12;
  const gapY = 14;
  const gridW = cols * crateW + (cols - 1) * gapX;
  const startX = (width - gridW) / 2;
  const startY = Math.round(height * 0.18);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (crateW + gapX);
      const y = startY + r * (crateH + gapY);
      g.fillStyle(0x000000, 0.35);
      g.fillRect(x, y, crateW, crateH);
      g.lineStyle(1, theme.wallColor, 0.45);
      g.strokeRect(x + 0.5, y + 0.5, crateW - 1, crateH - 1);
      // Cross strap.
      g.lineStyle(1, theme.platformColor, 0.35);
      g.lineBetween(x, y, x + crateW, y + crateH);
      g.lineBetween(x + crateW, y, x, y + crateH);
    }
  }
  // Animated: a single crate's outline pulses brighter.
  const pickR = 1;
  const pickC = 5;
  const px = startX + pickC * (crateW + gapX);
  const py = startY + pickR * (crateH + gapY);
  const highlight = scene.add
    .rectangle(px + crateW / 2, py + crateH / 2, crateW, crateH)
    .setStrokeStyle(2, theme.tokenColor, 0.9)
    .setFillStyle()
    .setDepth(0);
  scene.tweens.add({
    targets: highlight,
    alpha: { from: 1, to: 0.25 },
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
};

const ACCENTS: Partial<Record<FloorId, AccentFn>> = {
  [FLOORS.LOBBY]: lobbyAccent,
  [FLOORS.PLATFORM_TEAM]: platformAccent,
  [FLOORS.BUSINESS]: businessAccent,
  [FLOORS.EXECUTIVE]: executiveAccent,
  [FLOORS.PRODUCTS]: productsAccent,
};

/**
 * Dispatch to the floor's accent function if one is registered.
 * No-op for floors without a motif — they get the base backdrop only.
 */
export function drawFloorAccents(floorId: FloorId, args: FloorAccentArgs): void {
  ACCENTS[floorId]?.(args);
}

/** Exported for tests. */
export const _accents = ACCENTS;
