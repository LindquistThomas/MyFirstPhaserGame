/**
 * Platform-tile geometry for the elevator scene: hallway floor tiles, walkable
 * surface strips (with physics bodies), floor-signage plaques, and the
 * invisible shaft-wall segments that block airborne players from arcing across
 * the shaft gap.
 *
 * Extracted from `ElevatorSceneLayout` to keep that file as a thin
 * orchestrator. `computeShaftWallSegments` and `formatFloorLabel` are pure
 * helpers, unit-testable without a Phaser scene.
 */
import type * as Phaser from 'phaser';
import { GAME_WIDTH, TILE_SIZE, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { LEVEL_DATA } from '../../config/levelData';
import { ProgressionSystem } from '../../systems/ProgressionSystem';

// Mirrors ElevatorController.PLATFORM_HALF_WIDTH (= 80). Kept as a local
// constant to avoid importing ElevatorController (which pulls in Phaser at
// runtime and breaks unit tests running under jsdom).
const ELEVATOR_PLAT_HW = 80;

const FLOOR_TILE_ROWS = 2;
const FLOOR_H = FLOOR_TILE_ROWS * TILE_SIZE; // 256

/** Dependencies used by `buildPlatformTiles`. */
export interface PlatformTilesDeps {
  shaftWidth: number;
  shaftExtent: { top: number; bottom: number };
  floorYPositions: Record<FloorId, number>;
  floorLabels: Record<number, string>;
  progression: ProgressionSystem;
}

/**
 * One segment of an invisible vertical shaft-wall barrier.
 * Computed by `computeShaftWallSegments`.
 */
export interface WallSegment {
  yTop: number;
  yBottom: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Compute the vertical segment ranges for one invisible shaft-wall column.
 * Openings are cut at each floor's walking Y so the player can step
 * from the hallway onto the cab without the wall blocking them.
 *
 * @param walkYs      Sorted walking-surface Y values (one per floor).
 * @param shaftTop    Top world-Y boundary.
 * @param shaftBottom Bottom world-Y boundary.
 * @param openingAbove Pixels above each walkY to leave open.
 * @param openingBelow Pixels below each walkY to leave open.
 */
export function computeShaftWallSegments(
  walkYs: number[],
  shaftTop: number,
  shaftBottom: number,
  openingAbove: number,
  openingBelow: number,
): WallSegment[] {
  const segments: WallSegment[] = [];
  let cursor = shaftTop;
  for (const walkY of walkYs) {
    const yTop = cursor;
    const yBottom = walkY - openingAbove;
    if (yBottom > yTop) {
      segments.push({ yTop, yBottom });
    }
    cursor = walkY + openingBelow;
  }
  if (shaftBottom > cursor) {
    segments.push({ yTop: cursor, yBottom: shaftBottom });
  }
  return segments;
}

/**
 * Format the plaque label for a floor entry.  Returns `"<fNumber> · <roomName>"`.
 */
export function formatFloorLabel(fNumber: string, roomName: string): string {
  return `${fNumber} \u00B7 ${roomName}`;
}

// ---------------------------------------------------------------------------
// Phaser drawing functions
// ---------------------------------------------------------------------------

/**
 * Lay down hallway floor tiles, walkable strips (with physics bodies), floor
 * signage plaques, and invisible shaft-wall barriers for every floor in
 * `deps.floorYPositions`.  All physics bodies are added to `platforms`.
 */
export function buildPlatformTiles(
  scene: Phaser.Scene,
  deps: PlatformTilesDeps,
  platforms: Phaser.Physics.Arcade.StaticGroup,
): void {
  const positions = deps.floorYPositions;
  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const WALK_H = 8;
  const floorH = FLOOR_H;
  const elevHW = ELEVATOR_PLAT_HW;
  const elevLeft = cx - elevHW;
  const elevRight = cx + elevHW;

  const labels = deps.floorLabels;
  for (const [floorId, y] of Object.entries(positions)) {
    const fId = Number(floorId) as FloorId;
    const fd = LEVEL_DATA[fId];
    const unlocked = deps.progression.isFloorUnlocked(fId);

    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;

    for (let row = 0; row < FLOOR_TILE_ROWS; row++) {
      const tileY = y + row * TILE_SIZE + TILE_SIZE / 2;
      for (let tileRight = leftEdge; tileRight > 0; tileRight -= TILE_SIZE) {
        scene.add.image(tileRight - TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
      }
      for (let tileLeft = rightEdge; tileLeft < GAME_WIDTH; tileLeft += TILE_SIZE) {
        scene.add.image(tileLeft + TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
      }
    }

    const walkY = y + floorH;
    const WALK_OVERLAP = 4;
    const addWalkStrip = (
      visibleX: number,
      visibleW: number,
      collX: number,
      collW: number,
    ) => {
      if (visibleW > 0) {
        scene.add
          .rectangle(visibleX, walkY + WALK_H / 2, visibleW, WALK_H, 0x444466, 1)
          .setDepth(2);
      }
      const coll = scene.add.rectangle(collX, walkY + WALK_H / 2, collW, WALK_H, 0, 0);
      scene.physics.add.existing(coll, true);
      platforms.add(coll);
    };
    const leftVisibleW = leftEdge;
    const leftCollW = elevLeft + WALK_OVERLAP;
    addWalkStrip(leftVisibleW / 2, leftVisibleW, leftCollW / 2, leftCollW);
    const rightVisibleW = GAME_WIDTH - rightEdge;
    const rightCollW = GAME_WIDTH - (elevRight - WALK_OVERLAP);
    addWalkStrip(
      rightEdge + rightVisibleW / 2,
      rightVisibleW,
      (elevRight - WALK_OVERLAP + GAME_WIDTH) / 2,
      rightCollW,
    );

    const fNumber = labels[fId] ?? `F${fId}`;
    const plaqueY = walkY - 240;
    const leftPlaqueX = leftCollW / 2;
    const rightPlaqueX = (elevRight - WALK_OVERLAP + GAME_WIDTH) / 2;
    if (fd?.rooms) {
      _placeFloorPlaque(scene, leftPlaqueX, plaqueY, fNumber, fd.rooms.left, unlocked);
      _placeFloorPlaque(scene, rightPlaqueX, plaqueY, fNumber, fd.rooms.right, unlocked);
    } else {
      const name = fd?.name ?? fNumber;
      _placeFloorPlaque(scene, leftPlaqueX, plaqueY, fNumber, name, unlocked);
    }
  }

  // Invisible shaft walls — prevent airborne players from arcing across the
  // shaft. Opening cut at each floor's walkY so the player steps onto the cab.
  const WALL_W = 2;
  const OPENING_ABOVE = 120;
  const OPENING_BELOW = 24;
  const leftWallX = cx - sw / 2 - 1;
  const rightWallX = cx + sw / 2 + 1;

  const walkYs = Object.values(positions)
    .map((yy) => yy + floorH)
    .sort((a, b) => a - b);

  const addWallSegment = (xCenter: number, seg: WallSegment): void => {
    const h = seg.yBottom - seg.yTop;
    if (h <= 0) return;
    const rect = scene.add
      .rectangle(xCenter, seg.yTop + h / 2, WALL_W, h, theme.color.bg.dark, 0)
      .setDepth(0);
    scene.physics.add.existing(rect, true);
    platforms.add(rect);
  };

  const segments = computeShaftWallSegments(
    walkYs,
    deps.shaftExtent.top,
    deps.shaftExtent.bottom,
    OPENING_ABOVE,
    OPENING_BELOW,
  );

  for (const seg of segments) {
    addWallSegment(leftWallX, seg);
    addWallSegment(rightWallX, seg);
  }
}

/**
 * Draw a signage plaque (dark background + border + text) centred at the
 * given world position. Locked floors use a muted palette but remain legible.
 */
function _placeFloorPlaque(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  fNumber: string,
  roomName: string,
  unlocked: boolean,
): void {
  const label = formatFloorLabel(fNumber, roomName);
  const textColor = unlocked ? theme.color.css.textPrimary : theme.color.css.textMuted;
  const text = scene.add
    .text(centerX, centerY, label, {
      fontFamily: 'monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: textColor,
    })
    .setOrigin(0.5, 0.5);
  text.setStroke('#000000', 3);

  const padX = 14;
  const padY = 6;
  const plaqueW = Math.ceil(text.width) + padX * 2;
  const plaqueH = Math.ceil(text.height) + padY * 2;
  const bgColor = 0x0a1422;
  const bgAlpha = unlocked ? 0.9 : 0.75;
  const borderColor = unlocked ? 0x2a3a5a : 0x33333f;
  const plaque = scene.add
    .rectangle(centerX, centerY, plaqueW, plaqueH, bgColor, bgAlpha)
    .setStrokeStyle(1, borderColor, 1)
    .setDepth(5);
  text.setDepth(plaque.depth + 1);
}
