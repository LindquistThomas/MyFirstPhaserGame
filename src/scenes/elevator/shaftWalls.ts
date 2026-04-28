/**
 * Shaft structural drawing: background walls, caps, rooftop props, machine
 * room, dust motes, shaft doors, cable, and floor LEDs.
 *
 * Extracted from `ElevatorSceneLayout` to keep that file as a thin
 * orchestrator. Pure helpers (e.g. `generateDustMoteSpecs`) are unit-testable
 * without instantiating a Phaser scene; the Phaser-dependent drawing
 * functions accept a `scene` parameter and use `scene.add.*` exclusively so
 * tests can mock or skip them.
 */
import type * as Phaser from 'phaser';
import { GAME_WIDTH, TILE_SIZE, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { LEVEL_DATA } from '../../config/levelData';
import { ElevatorShaftDoors } from './ElevatorShaftDoors';

const FLOOR_TILE_ROWS = 2;
const FLOOR_H = FLOOR_TILE_ROWS * TILE_SIZE; // 256

/** Dependencies shared by every shaft-wall draw function. */
export interface ShaftWallsDeps {
  shaftWidth: number;
  shaftExtent: { top: number; bottom: number };
  floorYPositions: Record<FloorId, number>;
}

/**
 * Spec for one deterministic dust mote, fully computable without Phaser.
 * Positions and animation params are pure math so they can be unit-tested.
 */
export interface DustMoteSpec {
  x: number;
  y: number;
  size: 1 | 2;
  baseAlpha: number;
  drift: number;
  duration: number;
  delay: number;
}

/**
 * Map keyed by floor id holding the LED cluster Graphics refs and the cab
 * docking Y for that floor. Updated each frame by
 * `ElevatorSceneLayout.updateFloorLEDs`.
 */
export type FloorLEDMap = Map<
  number,
  {
    clusters: { gfx: Phaser.GameObjects.Graphics; x: number; y: number }[];
    dockY: number;
  }
>;

// ---------------------------------------------------------------------------
// Pure helpers (no Phaser dependency)
// ---------------------------------------------------------------------------

/**
 * Produce deterministic dust-mote layout specs for the given shaft geometry.
 * All randomness comes from a seeded xorshift RNG so results are stable across
 * reloads and fully unit-testable.
 *
 * @param count   Number of motes to generate.
 * @param xMin    Left inset boundary (world space).
 * @param xMax    Right inset boundary (world space).
 * @param top     Top of the shaft (world space y).
 * @param shaftH  Height of the shaft in pixels.
 */
export function generateDustMoteSpecs(
  count: number,
  xMin: number,
  xMax: number,
  top: number,
  shaftH: number,
): DustMoteSpec[] {
  // Seed from shaft height so the pattern stays the same across sessions.
  let s = (shaftH | 0) ^ 0x5eed_d057;
  if (s === 0) s = 0x1234_5678;
  const rand = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };

  const specs: DustMoteSpec[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(xMin + rand() * (xMax - xMin));
    const y = Math.round(top + 40 + rand() * (shaftH - 80));
    const size = rand() < 0.35 ? 2 : 1;
    const baseAlpha = 0.18 + rand() * 0.18;
    const drift = 18 + Math.floor(rand() * 22);
    const duration = 4200 + Math.floor(rand() * 2800);
    const delay = Math.floor(rand() * duration);
    specs.push({ x, y, size: size as 1 | 2, baseAlpha, drift, duration, delay });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Phaser drawing functions
// ---------------------------------------------------------------------------

/**
 * Draw the shaft interior: tile background, inner-wall shadows, outer pillars,
 * guide rails, cross-beams, and a hazard chevron strip.
 */
export function drawShaftBackground(scene: Phaser.Scene, deps: ShaftWallsDeps): void {
  const { top, bottom } = deps.shaftExtent;
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const leftEdge = cx - sw / 2;
  const rightEdge = cx + sw / 2;
  const shaftH = bottom - top;

  for (let y = top; y < bottom; y += TILE_SIZE) {
    const tileH = Math.min(TILE_SIZE, bottom - y);
    scene.add.tileSprite(cx, y + tileH / 2, sw, tileH, 'elevator_shaft').setDepth(0);
  }

  const shadow = scene.add.graphics();
  shadow.fillStyle(theme.color.bg.dark, 0.45);
  shadow.fillRect(leftEdge, top, 8, shaftH);
  shadow.fillRect(rightEdge - 8, top, 8, shaftH);
  shadow.setDepth(0);

  const walls = scene.add.graphics();
  walls.fillStyle(0x1a1a22, 1);
  walls.fillRect(leftEdge - 12, top, 12, shaftH);
  walls.fillRect(rightEdge, top, 12, shaftH);
  walls.fillStyle(0x33333f, 1);
  walls.fillRect(leftEdge - 12, top, 2, shaftH);
  walls.fillRect(rightEdge + 10, top, 2, shaftH);
  // Depth 2.1: above hallway floor tiles (depth 2) so dark outer shaft pillars
  // stay visible at every floor row. Still below shaft doors (depth 2.5).
  walls.setDepth(2.1);

  const rails = scene.add.graphics();
  const railOffsets = [-sw / 2 + 18, sw / 2 - 18];
  for (const off of railOffsets) {
    const rx = cx + off;
    rails.fillStyle(0x0d0d12, 0.8);
    rails.fillRect(rx - 3, top, 8, shaftH);
    rails.fillStyle(0x55606e, 1);
    rails.fillRect(rx - 2, top, 4, shaftH);
    rails.fillStyle(0x88909c, 1);
    rails.fillRect(rx - 1, top, 1, shaftH);
  }
  rails.setDepth(1);

  const beams = scene.add.graphics();
  for (let y = top + 60; y < bottom; y += 240) {
    beams.fillStyle(0x3a3a48, 1);
    beams.fillRect(leftEdge + 2, y, sw - 4, 4);
    beams.fillStyle(0x55556a, 1);
    beams.fillRect(leftEdge + 2, y, sw - 4, 1);
    beams.fillStyle(0x1a1a22, 1);
    beams.fillRect(leftEdge + 2, y + 4, sw - 4, 1);
    beams.fillStyle(0x88909c, 1);
    beams.fillCircle(leftEdge + 10, y + 2, 1.2);
    beams.fillCircle(rightEdge - 10, y + 2, 1.2);
  }
  beams.setDepth(1);

  const chev = scene.add.graphics();
  chev.fillStyle(0xffcc33, 0.25);
  for (let y = top + 120; y < bottom; y += 480) {
    for (let i = 0; i < 3; i++) {
      chev.fillTriangle(leftEdge + 26 + i * 6, y, leftEdge + 32 + i * 6, y, leftEdge + 29 + i * 6, y + 8);
    }
  }
  chev.setDepth(1);
}

/**
 * Draw shaft top/bottom caps: ceiling header, pit floor, buffer springs,
 * oil puddle, and ladder rungs.
 */
export function drawShaftCaps(scene: Phaser.Scene, deps: ShaftWallsDeps): void {
  const { top, bottom } = deps.shaftExtent;
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const leftEdge = cx - sw / 2;
  const capW = sw + 24;

  const g = scene.add.graphics().setDepth(1);

  const ceilH = 24;
  g.fillStyle(0x1a1a22, 1);
  g.fillRect(leftEdge - 12, top - ceilH, capW, ceilH);
  g.fillStyle(0x3a3a48, 1);
  g.fillRect(leftEdge - 12, top - 6, capW, 2);
  g.fillStyle(0x88909c, 1);
  for (let rx = leftEdge + 4; rx < leftEdge + capW - 16; rx += 16) {
    g.fillCircle(rx, top - 5, 1.2);
  }
  g.fillStyle(0x33333f, 1);
  g.fillRect(leftEdge - 12, top - ceilH, capW, 2);

  _drawPitBottom(g, leftEdge, bottom, capW, cx, sw);
}

/** Internal pit-bottom details (concrete, chevron, springs, oil, ladder). */
function _drawPitBottom(
  g: Phaser.GameObjects.Graphics,
  leftEdge: number,
  bottom: number,
  capW: number,
  cx: number,
  sw: number,
): void {
  const rightEdge = leftEdge + sw;
  const floorH = 16;
  const floorTop = bottom - floorH;

  g.fillStyle(0x2a2a32, 1);
  g.fillRect(leftEdge, floorTop, sw, floorH);
  g.fillStyle(0x3a3a46, 1);
  g.fillRect(leftEdge, floorTop, sw, 2);
  g.fillStyle(0x1a1a22, 1);
  g.fillRect(leftEdge, bottom - 2, sw, 2);
  g.fillStyle(0x4a4a55, 1);
  for (let i = 0; i < 18; i++) {
    const sx = leftEdge + 6 + ((i * 53) % (sw - 12));
    const sy = floorTop + 4 + ((i * 7) % (floorH - 6));
    g.fillRect(sx, sy, 1, 1);
  }

  const chevY = floorTop - 6;
  g.fillStyle(0x111114, 1);
  g.fillRect(leftEdge, chevY, sw, 4);
  g.fillStyle(0xffcc33, 1);
  for (let x = leftEdge; x < rightEdge; x += 12) {
    g.fillTriangle(x, chevY, x + 6, chevY, x + 3, chevY + 4);
  }

  const bufferOffsets = [-40, 40];
  for (const off of bufferOffsets) {
    const bx = cx + off;
    const springTop = floorTop - 42;
    const baseTop = floorTop - 6;
    g.fillStyle(0x1a1a20, 1);
    g.fillRect(bx - 10, baseTop, 20, 8);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(bx - 10, baseTop, 20, 2);
    g.lineStyle(2, 0x88909c, 1);
    g.beginPath();
    g.moveTo(bx - 7, baseTop);
    for (let i = 0; i < 6; i++) {
      const y = baseTop - (i + 1) * 6;
      g.lineTo(bx + (i % 2 === 0 ? 7 : -7), y);
    }
    g.strokePath();
    g.fillStyle(0x55606e, 1);
    g.fillRect(bx - 9, springTop, 18, 3);
    g.fillStyle(0x88909c, 1);
    g.fillRect(bx - 9, springTop, 18, 1);
  }

  g.fillStyle(0x0a0a12, 0.9);
  g.fillEllipse(cx - 12, bottom - 5, 34, 6);
  g.fillStyle(0x1a1a2a, 0.9);
  g.fillEllipse(cx - 12, bottom - 6, 20, 3);
  g.fillStyle(0x3a4a6a, 0.6);
  g.fillEllipse(cx - 14, bottom - 7, 6, 1);

  const rungX = leftEdge + 8;
  for (let i = 0; i < 4; i++) {
    const ry = floorTop - 14 - i * 14;
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(rungX - 2, ry, 14, 4);
    g.fillStyle(0x88909c, 1);
    g.fillRect(rungX, ry + 1, 10, 1);
  }
  g.fillStyle(0x55606e, 1);
  g.fillRect(rungX - 2, floorTop - 14 - 3 * 14 - 4, 2, 3 * 14 + 10);
  g.fillRect(rungX + 10, floorTop - 14 - 3 * 14 - 4, 2, 3 * 14 + 10);

  g.fillStyle(0x1a1a22, 1);
  g.fillRect(leftEdge - 12, bottom - 2, capW, 2);
}

/**
 * Draw the rooftop deck on both sides of the shaft (above the topmost floor
 * slab) with parapets and rooftop props (HVAC vent, exhaust pipes, antenna,
 * satellite dish).
 */
export function drawRooftop(scene: Phaser.Scene, deps: ShaftWallsDeps): void {
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const leftEdge = cx - sw / 2;
  const rightEdge = cx + sw / 2;
  const roofY = deps.shaftExtent.top;

  const g = scene.add.graphics().setDepth(3);

  const drawDeck = (x0: number, x1: number): void => {
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(x0, roofY - 4, x1 - x0, 4);
    g.fillStyle(0x2a2a34, 1);
    g.fillRect(x0, roofY, x1 - x0, 6);
    g.fillStyle(0x4a4a55, 1);
    for (let i = 0; i < 40; i++) {
      const sx = x0 + ((i * 41) % Math.max(1, x1 - x0));
      g.fillRect(sx, roofY - 3 + (i % 4), 1, 1);
    }
  };
  drawDeck(0, leftEdge);
  drawDeck(rightEdge, GAME_WIDTH);

  g.fillStyle(0x333344, 1);
  g.fillRect(0, roofY - 18, 12, 18);
  g.fillRect(GAME_WIDTH - 12, roofY - 18, 12, 18);
  g.fillStyle(0x55556a, 1);
  g.fillRect(0, roofY - 18, 12, 2);
  g.fillRect(GAME_WIDTH - 12, roofY - 18, 12, 2);

  g.fillStyle(0x2a2a36, 1);
  g.fillRect(leftEdge - 36, roofY - 12, 24, 12);
  g.fillRect(rightEdge + 12, roofY - 12, 24, 12);
  g.fillStyle(0x55556a, 1);
  g.fillRect(leftEdge - 36, roofY - 12, 24, 2);
  g.fillRect(rightEdge + 12, roofY - 12, 24, 2);

  _drawHvacVent(g, 140, roofY);
  _drawExhaustPipes(g, 320, roofY);
  _drawAntenna(g, rightEdge + 120, roofY);
  _drawSatelliteDish(g, rightEdge + 280, roofY);
}

function _drawHvacVent(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
  g.fillStyle(0x22222c, 1);
  g.fillRect(x, roofY - 6, 96, 6);
  g.fillStyle(0x3a3a46, 1);
  g.fillRect(x, roofY - 6, 96, 2);
  g.fillStyle(0x6a6a78, 1);
  g.fillRect(x + 4, roofY - 46, 88, 40);
  g.fillStyle(0x88889a, 1);
  g.fillRect(x + 4, roofY - 46, 88, 2);
  g.fillStyle(0x3a3a46, 1);
  g.fillRect(x + 4, roofY - 8, 88, 2);
  g.fillStyle(0x1a1a22, 1);
  for (let i = 0; i < 5; i++) {
    g.fillRect(x + 12, roofY - 40 + i * 7, 72, 3);
  }
  g.fillStyle(0x55556a, 1);
  g.fillRect(x, roofY - 56, 96, 10);
  g.fillStyle(0x88899a, 1);
  g.fillRect(x, roofY - 56, 96, 2);
  g.fillStyle(0x33333f, 1);
  g.fillRect(x + 40, roofY - 70, 16, 14);
  g.fillStyle(0x55556a, 1);
  g.fillRect(x + 40, roofY - 70, 16, 2);
  g.fillStyle(0xffcc33, 0.85);
  g.fillRect(x + 12, roofY - 18, 20, 4);
}

function _drawExhaustPipes(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
  g.fillStyle(0x22222c, 1);
  g.fillRect(x - 4, roofY - 6, 60, 6);
  g.fillStyle(0x3a3a46, 1);
  g.fillRect(x - 4, roofY - 6, 60, 2);

  const heights = [62, 86, 46, 70];
  for (let i = 0; i < heights.length; i++) {
    const px = x + i * 14;
    const ph = heights[i]!;
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(px, roofY - ph, 8, ph);
    g.fillStyle(0x55556a, 1);
    g.fillRect(px + 1, roofY - ph, 2, ph);
    g.fillStyle(0x33333f, 1);
    g.fillRect(px + 6, roofY - ph, 1, ph);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(px - 1, roofY - ph - 4, 10, 4);
    g.fillStyle(0x88909c, 1);
    g.fillRect(px - 1, roofY - ph - 4, 10, 1);
    if (i < heights.length - 1) {
      g.fillStyle(0x55556a, 1);
      g.fillRect(px + 7, roofY - 14, 7, 2);
    }
  }
}

function _drawAntenna(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
  g.fillStyle(0x22222c, 1);
  g.fillRect(x - 12, roofY - 4, 28, 4);
  g.fillStyle(0x3a3a46, 1);
  g.fillRect(x - 12, roofY - 4, 28, 1);
  g.fillStyle(0x88909c, 1);
  g.fillRect(x + 1, roofY - 110, 2, 106);
  g.fillStyle(0x55606e, 1);
  g.fillRect(x + 3, roofY - 110, 1, 106);
  g.lineStyle(1, 0x55606e, 1);
  g.beginPath();
  g.moveTo(x - 10, roofY - 4); g.lineTo(x + 2, roofY - 32);
  g.moveTo(x + 14, roofY - 4); g.lineTo(x + 2, roofY - 32);
  g.strokePath();
  const bars: Array<[number, number]> = [
    [roofY - 40, 18],
    [roofY - 56, 14],
    [roofY - 72, 10],
    [roofY - 88, 6],
  ];
  g.fillStyle(0x88909c, 1);
  for (const [by, half] of bars) {
    g.fillRect(x + 2 - half, by, half * 2, 1);
  }
  g.fillStyle(0xff8888, 0.5);
  g.fillCircle(x + 2, roofY - 112, 5);
  g.fillStyle(0xff3333, 1);
  g.fillCircle(x + 2, roofY - 112, 2);
}

function _drawSatelliteDish(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
  g.fillStyle(0x22222c, 1);
  g.fillRect(x - 18, roofY - 4, 38, 4);
  g.fillStyle(0x3a3a46, 1);
  g.fillRect(x - 18, roofY - 4, 38, 1);
  g.lineStyle(2, 0x55606e, 1);
  g.beginPath();
  g.moveTo(x - 12, roofY - 4); g.lineTo(x + 1, roofY - 30);
  g.moveTo(x + 12, roofY - 4); g.lineTo(x + 1, roofY - 30);
  g.strokePath();
  g.fillStyle(0x55606e, 1);
  g.fillRect(x - 3, roofY - 38, 6, 14);
  g.fillStyle(0x88909c, 1);
  g.fillRect(x - 3, roofY - 38, 6, 1);
  g.fillStyle(0xbfbfcf, 1);
  g.fillEllipse(x + 10, roofY - 50, 44, 36);
  g.fillStyle(0x88909c, 1);
  g.fillEllipse(x + 12, roofY - 50, 36, 30);
  g.fillStyle(0x55606e, 1);
  g.fillEllipse(x + 14, roofY - 50, 28, 22);
  g.lineStyle(2, 0x55606e, 1);
  g.beginPath();
  g.moveTo(x + 14, roofY - 50); g.lineTo(x + 32, roofY - 68);
  g.strokePath();
  g.fillStyle(0x33333f, 1);
  g.fillRect(x + 30, roofY - 72, 7, 7);
  g.fillStyle(0x88909c, 1);
  g.fillRect(x + 30, roofY - 72, 7, 1);
}

/**
 * Draw the machine room above the shaft ceiling cap. Returns the Y coordinate
 * of the pulley's bottom tangent (i.e. where the shaft cable anchors).
 */
export function drawMachineRoom(scene: Phaser.Scene, deps: ShaftWallsDeps): number {
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const top = deps.shaftExtent.top;
  const capTop = top - 24;
  const roomH = 92;
  const roomW = sw + 40;
  const roomLeft = cx - roomW / 2;
  const roomTop = capTop - roomH;
  const wallT = 4;

  const bg = scene.add.graphics().setDepth(1);
  bg.fillStyle(0x16161c, 1);
  bg.fillRect(roomLeft, roomTop, roomW, roomH);
  bg.fillStyle(0x2a2a34, 1);
  bg.fillRect(roomLeft, roomTop, roomW, wallT);
  bg.fillRect(roomLeft, roomTop, wallT, roomH);
  bg.fillRect(roomLeft + roomW - wallT, roomTop, wallT, roomH);
  bg.fillStyle(0x55556a, 1);
  bg.fillRect(roomLeft, roomTop, roomW, 1);
  bg.fillStyle(0x1a1a22, 1);
  bg.fillRect(roomLeft, roomTop + wallT - 1, roomW, 1);

  bg.fillStyle(0x33333f, 1);
  for (let i = 0; i < 4; i++) {
    bg.fillRect(roomLeft + 8, roomTop + 18 + i * 12, 18, 3);
    bg.fillRect(roomLeft + roomW - 26, roomTop + 18 + i * 12, 18, 3);
  }

  const chevY = roomTop + roomH - 6;
  bg.fillStyle(0x111114, 1);
  bg.fillRect(roomLeft + wallT, chevY, roomW - 2 * wallT, 4);
  bg.fillStyle(0xffcc33, 1);
  for (let xx = roomLeft + wallT; xx < roomLeft + roomW - wallT; xx += 12) {
    bg.fillTriangle(xx, chevY, xx + 6, chevY, xx + 3, chevY + 4);
  }

  const motorX = cx - 64;
  const motorY = roomTop + 34;
  bg.fillStyle(0x3a3a48, 1);
  bg.fillRect(motorX, motorY, 44, 44);
  bg.fillStyle(0x55556a, 1);
  bg.fillRect(motorX, motorY, 44, 3);
  bg.fillStyle(0x1a1a22, 1);
  bg.fillRect(motorX, motorY + 41, 44, 3);
  bg.fillStyle(0x22222a, 1);
  for (let i = 0; i < 6; i++) bg.fillRect(motorX + 4 + i * 6, motorY + 8, 2, 28);
  bg.fillStyle(0x00ff66, 0.35);
  bg.fillCircle(motorX + 38, motorY + 10, 4);
  bg.fillStyle(0x00ff66, 1);
  bg.fillCircle(motorX + 38, motorY + 10, 2);
  bg.fillStyle(0x88909c, 1);
  bg.fillRect(motorX + 2, motorY + 2, 2, 2);
  bg.fillRect(motorX + 40, motorY + 2, 2, 2);
  bg.fillRect(motorX + 2, motorY + 40, 2, 2);
  bg.fillRect(motorX + 40, motorY + 40, 2, 2);

  const pulleyR = 18;
  const pulleyX = cx;
  const pulleyY = roomTop + 54;
  bg.fillStyle(0x111114, 1);
  bg.fillRect(motorX + 44, pulleyY - 2, pulleyX - (motorX + 44), 4);
  bg.fillStyle(0x33333f, 1);
  bg.fillRect(motorX + 44, pulleyY - 2, pulleyX - (motorX + 44), 1);

  bg.fillStyle(0x33333f, 1);
  bg.fillRect(pulleyX - 14, roomTop + wallT, 28, 10);
  bg.fillStyle(0x55556a, 1);
  bg.fillRect(pulleyX - 14, roomTop + wallT, 28, 2);
  bg.fillStyle(0x88909c, 1);
  bg.fillCircle(pulleyX - 10, roomTop + wallT + 5, 1);
  bg.fillCircle(pulleyX + 10, roomTop + wallT + 5, 1);

  const pulley = scene.add.graphics().setDepth(2);
  pulley.fillStyle(0x1a1a22, 1);
  pulley.fillCircle(pulleyX, pulleyY, pulleyR);
  pulley.fillStyle(0x55606e, 1);
  pulley.fillCircle(pulleyX, pulleyY, pulleyR - 3);
  pulley.fillStyle(0x2a2a32, 1);
  pulley.fillCircle(pulleyX, pulleyY, 6);
  pulley.fillStyle(0x88909c, 1);
  pulley.fillCircle(pulleyX, pulleyY, 2);
  pulley.lineStyle(2, 0x33333f, 1);
  pulley.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    pulley.moveTo(pulleyX + Math.cos(a) * 5, pulleyY + Math.sin(a) * 5);
    pulley.lineTo(
      pulleyX + Math.cos(a) * (pulleyR - 4),
      pulleyY + Math.sin(a) * (pulleyR - 4),
    );
  }
  pulley.strokePath();
  pulley.lineStyle(1, 0x1a1a22, 1);
  pulley.strokeCircle(pulleyX, pulleyY, pulleyR - 6);

  return pulleyY + pulleyR - 1;
}

/**
 * Spawn slow-drifting dust motes inside the shaft volume. Purely atmospheric;
 * motes are deterministic in position so the scene is stable across reloads.
 */
export function drawShaftDustMotes(scene: Phaser.Scene, deps: ShaftWallsDeps): void {
  const sw = deps.shaftWidth;
  const cx = GAME_WIDTH / 2;
  const leftEdge = cx - sw / 2;
  const { top, bottom } = deps.shaftExtent;
  const shaftH = bottom - top;

  const xMin = leftEdge + 26;
  const xMax = leftEdge + sw - 26;
  const specs = generateDustMoteSpecs(14, xMin, xMax, top, shaftH);

  for (const spec of specs) {
    const mote = scene.add
      .rectangle(spec.x, spec.y, spec.size, spec.size, 0xffffff, spec.baseAlpha)
      .setDepth(1.3)
      .setScrollFactor(1, 1);
    scene.tweens.add({
      targets: mote,
      y: { from: spec.y - spec.drift / 2, to: spec.y + spec.drift / 2 },
      alpha: { from: spec.baseAlpha * 0.5, to: spec.baseAlpha },
      duration: spec.duration,
      delay: spec.delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }
}

/**
 * Create one `ElevatorShaftDoors` instance per floor, returning the array.
 * The caller is expected to push these onto `ElevatorSceneLayout.shaftDoors`.
 */
export function buildShaftDoors(scene: Phaser.Scene, deps: ShaftWallsDeps): ElevatorShaftDoors[] {
  const positions = deps.floorYPositions;
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const leftEdge = cx - sw / 2;
  const rightEdge = cx + sw / 2;

  const doors: ElevatorShaftDoors[] = [];
  for (const [floorIdStr, y] of Object.entries(positions)) {
    const fId = Number(floorIdStr) as FloorId;
    const walkY = y + FLOOR_H;
    const dockY = walkY + 8;
    const cavityColor = LEVEL_DATA[fId]?.theme.backgroundColor ?? 0x1a1a2e;
    doors.push(new ElevatorShaftDoors(scene, leftEdge, rightEdge, walkY, dockY, cavityColor));
  }
  return doors;
}

/**
 * Build the shaft cable TileSprite anchored at `pulleyAnchorY`. The cable
 * is rendered with depth 1.7 so it appears to emerge from under the pulley.
 * Its height is updated each frame by `ElevatorSceneLayout.updateShaftCable`.
 */
export function buildShaftCable(
  scene: Phaser.Scene,
  pulleyAnchorY: number,
): Phaser.GameObjects.TileSprite {
  // scene.add.tileSprite returns TileSprite at runtime; the 'phaser' import
  // is type-only so we cast via unknown to satisfy strict types.
  return scene.add.tileSprite(GAME_WIDTH / 2, pulleyAnchorY, 4, 1, 'elevator_cable')
    .setOrigin(0.5, 0)
    .setDepth(1.7) as unknown as Phaser.GameObjects.TileSprite;
}

/**
 * Place LED cluster Graphics objects at the indicator position for every
 * floor in `deps.floorYPositions`. Returns the map keyed by floor id so
 * the caller (`ElevatorSceneLayout.updateFloorLEDs`) can redraw each
 * cluster in its per-frame update.
 */
export function buildShaftLEDs(scene: Phaser.Scene, deps: ShaftWallsDeps): FloorLEDMap {
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const leftEdge = cx - sw / 2;
  const rightEdge = cx + sw / 2;

  const map: FloorLEDMap = new Map();
  for (const [idStr, yTop] of Object.entries(deps.floorYPositions)) {
    const id = Number(idStr);
    const walkY = yTop + FLOOR_H;
    const dockY = walkY + 8;
    const rightLedX = rightEdge - 12;
    const leftLedX = leftEdge + 2;
    const ledY = walkY - 148;
    const rightGfx = scene.add.graphics().setDepth(5);
    const leftGfx = scene.add.graphics().setDepth(5);
    map.set(id, {
      clusters: [
        { gfx: leftGfx, x: leftLedX, y: ledY },
        { gfx: rightGfx, x: rightLedX, y: ledY },
      ],
      dockY,
    });
  }
  return map;
}
