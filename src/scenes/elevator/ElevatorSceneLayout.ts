import * as Phaser from 'phaser';
import { GAME_WIDTH, FLOORS, TILE_SIZE, COLORS, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { LEVEL_DATA } from '../../config/levelData';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { ElevatorShaftDoors } from './ElevatorShaftDoors';
import { ElevatorController } from './ElevatorController';

const FLOOR_TILE_ROWS = 2;
const FLOOR_H = FLOOR_TILE_ROWS * TILE_SIZE; // 256

export interface ShaftExtent {
  top: number;
  bottom: number;
  height: number;
}

export interface ElevatorSceneLayoutDeps {
  scene: Phaser.Scene;
  progression: ProgressionSystem;
  shaftWidth: number;
  shaftExtent: ShaftExtent;
  floorYPositions: Record<number, number>;
  floorLabels: Record<number, string>;
}

/**
 * Pure visual construction for the elevator scene: shaft walls, caps,
 * floor slabs, decorations, shaft doors, cable, and floor LEDs. The
 * caller owns collision groups; this helper only builds imagery and
 * static physics bodies for walkable surfaces.
 */
export class ElevatorSceneLayout {
  readonly platforms: Phaser.Physics.Arcade.StaticGroup;
  readonly shaftDoors: ElevatorShaftDoors[] = [];
  private shaftCable?: Phaser.GameObjects.TileSprite;
  private floorLEDs = new Map<number, {
    gfx: Phaser.GameObjects.Graphics; x: number; y: number; dockY: number;
  }>();

  constructor(private readonly deps: ElevatorSceneLayoutDeps) {
    this.platforms = deps.scene.physics.add.staticGroup();
  }

  /** Build the entire elevator-scene visual scaffolding in order. */
  build(): void {
    this.createShaftBackground();
    this.createShaftCaps();
    this.createPlatforms();
    this.createLobbyDecorations();
    this.createBelowLobbyFoundation();
    this.createFloorDecorations();
    this.createShaftDoors();
    this.createShaftCable();
    this.createFloorLEDs();
  }

  updateShaftCable(controller: ElevatorController | undefined): void {
    if (!this.shaftCable || !controller) return;
    // Approximate cab top: platform Y minus the cab height (see Elevator.CAB_H=172).
    const cabTop = controller.elevator.getY() - 172;
    const h = Math.max(0, cabTop - this.deps.shaftExtent.top);
    this.shaftCable.setSize(4, h);
  }

  updateFloorLEDs(controller: ElevatorController | undefined): void {
    if (!controller) return;
    const cabY = controller.elevator.getY();
    for (const { gfx, x, y, dockY } of this.floorLEDs.values()) {
      const lit = Math.abs(cabY - dockY) <= 12;
      const color = lit ? 0x00ff66 : 0x335533;
      gfx.clear();
      gfx.fillStyle(0x111118, 1);
      gfx.fillRect(x - 1, y - 1, 12, 6);
      gfx.fillStyle(color, 1);
      gfx.fillCircle(x + 2, y + 2, 2);
      gfx.fillCircle(x + 8, y + 2, 2);
      if (lit) {
        gfx.fillStyle(0x00ff66, 0.35);
        gfx.fillCircle(x + 2, y + 2, 4);
        gfx.fillCircle(x + 8, y + 2, 4);
      }
    }
  }

  private createShaftBackground(): void {
    const scene = this.deps.scene;
    const { top, bottom } = this.deps.shaftExtent;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
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
    walls.setDepth(1);

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

  private createShaftCaps(): void {
    const scene = this.deps.scene;
    const { top, bottom } = this.deps.shaftExtent;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
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

    this.drawPitBottom(g, leftEdge, bottom, capW);
  }

  /**
   * Bottom-of-shaft detailing drawn INSIDE the shaft (above `bottom`) so the
   * camera, which clamps at `shaftExtent.bottom`, actually shows it. Reads as
   * an industrial elevator pit: concrete floor, buffer springs under the cab
   * rails, ladder rungs on the left wall, oil puddle, and a hazard chevron.
   */
  private drawPitBottom(
    g: Phaser.GameObjects.Graphics,
    leftEdge: number,
    bottom: number,
    capW: number,
  ): void {
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const rightEdge = leftEdge + sw;

    const floorH = 16;
    const floorTop = bottom - floorH;

    // Concrete pit slab.
    g.fillStyle(0x2a2a32, 1);
    g.fillRect(leftEdge, floorTop, sw, floorH);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(leftEdge, floorTop, sw, 2);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(leftEdge, bottom - 2, sw, 2);
    // Speckle for concrete texture.
    g.fillStyle(0x4a4a55, 1);
    for (let i = 0; i < 18; i++) {
      const sx = leftEdge + 6 + ((i * 53) % (sw - 12));
      const sy = floorTop + 4 + ((i * 7) % (floorH - 6));
      g.fillRect(sx, sy, 1, 1);
    }

    // Hazard chevron strip just above the pit floor.
    const chevY = floorTop - 6;
    g.fillStyle(0x111114, 1);
    g.fillRect(leftEdge, chevY, sw, 4);
    g.fillStyle(0xffcc33, 1);
    for (let x = leftEdge; x < rightEdge; x += 12) {
      g.fillTriangle(x, chevY, x + 6, chevY, x + 3, chevY + 4);
    }

    // Buffer springs under the cab rails. Cab rails live at cx ± (sw/2 - 18)
    // (see createShaftBackground); place buffers slightly inboard of those.
    const bufferOffsets = [-40, 40];
    for (const off of bufferOffsets) {
      const bx = cx + off;
      const springTop = floorTop - 42;
      const baseTop = floorTop - 6;
      // Cylindrical base.
      g.fillStyle(0x1a1a20, 1);
      g.fillRect(bx - 10, baseTop, 20, 8);
      g.fillStyle(0x3a3a46, 1);
      g.fillRect(bx - 10, baseTop, 20, 2);
      // Coiled spring (zig-zag).
      g.lineStyle(2, 0x88909c, 1);
      g.beginPath();
      g.moveTo(bx - 7, baseTop);
      for (let i = 0; i < 6; i++) {
        const y = baseTop - (i + 1) * 6;
        g.lineTo(bx + (i % 2 === 0 ? 7 : -7), y);
      }
      g.strokePath();
      // Cap plate on top of spring.
      g.fillStyle(0x55606e, 1);
      g.fillRect(bx - 9, springTop, 18, 3);
      g.fillStyle(0x88909c, 1);
      g.fillRect(bx - 9, springTop, 18, 1);
    }

    // Oil puddle to one side of the buffers.
    g.fillStyle(0x0a0a12, 0.9);
    g.fillEllipse(cx - 12, bottom - 5, 34, 6);
    g.fillStyle(0x1a1a2a, 0.9);
    g.fillEllipse(cx - 12, bottom - 6, 20, 3);
    g.fillStyle(0x3a4a6a, 0.6);
    g.fillEllipse(cx - 14, bottom - 7, 6, 1);

    // Ladder rungs embedded in the left shaft wall, above the pit floor.
    const rungX = leftEdge + 8;
    for (let i = 0; i < 4; i++) {
      const ry = floorTop - 14 - i * 14;
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(rungX - 2, ry, 14, 4);
      g.fillStyle(0x88909c, 1);
      g.fillRect(rungX, ry + 1, 10, 1);
    }
    // Ladder stringers (vertical rails) behind the rungs.
    g.fillStyle(0x55606e, 1);
    g.fillRect(rungX - 2, floorTop - 14 - 3 * 14 - 4, 2, 3 * 14 + 10);
    g.fillRect(rungX + 10, floorTop - 14 - 3 * 14 - 4, 2, 3 * 14 + 10);

    // Thin lip outside the shaft at the very bottom, keeps the original
    // "sealed shaft" read along the edges where the ceiling cap has a twin.
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(leftEdge - 12, bottom - 2, capW, 2);
  }

  private createPlatforms(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const WALK_H = 8;
    const floorH = FLOOR_H;
    const elevHW = ElevatorController.PLATFORM_HALF_WIDTH;
    const elevLeft = cx - elevHW;
    const elevRight = cx + elevHW;

    const labels = this.deps.floorLabels;
    for (const [floorId, y] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      const fd = LEVEL_DATA[fId];
      const unlocked = this.deps.progression.isFloorUnlocked(fId);

      const leftEdge = cx - sw / 2;
      const rightEdge = cx + sw / 2;

      for (let row = 0; row < FLOOR_TILE_ROWS; row++) {
        const tileY = y + row * TILE_SIZE + TILE_SIZE / 2;
        for (let tileLeft = 0; tileLeft + TILE_SIZE <= leftEdge; tileLeft += TILE_SIZE) {
          scene.add.image(tileLeft + TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
        }
        for (let tileLeft = rightEdge; tileLeft < GAME_WIDTH; tileLeft += TILE_SIZE) {
          scene.add.image(tileLeft + TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
        }
      }

      const ledgeColor = 0x3a3a55;
      const ledgeGapL = elevLeft - leftEdge;
      const ledgeGapR = rightEdge - elevRight;
      if (ledgeGapL > 0) {
        scene.add.rectangle(leftEdge + ledgeGapL / 2, y + floorH + WALK_H / 2,
          ledgeGapL, WALK_H, ledgeColor, 1).setDepth(2);
      }
      if (ledgeGapR > 0) {
        scene.add.rectangle(elevRight + ledgeGapR / 2, y + floorH + WALK_H / 2,
          ledgeGapR, WALK_H, ledgeColor, 1).setDepth(2);
      }

      // Walking surfaces: 4 px overlap into the cab zone closes the seam
      // when the cab is docked.
      const walkY = y + floorH;
      const WALK_OVERLAP = 4;
      const addWalkSurface = (rx: number, rw: number) => {
        const rect = scene.add.rectangle(rx, walkY + WALK_H / 2, rw, WALK_H, 0x444466, 1).setDepth(2);
        scene.physics.add.existing(rect, true);
        this.platforms.add(rect);
      };
      const leftRw = elevLeft + WALK_OVERLAP;
      const rightRw = GAME_WIDTH - (elevRight - WALK_OVERLAP);
      addWalkSurface(leftRw / 2, leftRw);
      addWalkSurface((elevRight - WALK_OVERLAP + GAME_WIDTH) / 2, rightRw);

      scene.add.text(20, y + 10, labels[fId] ?? `F${fId}`, {
        fontFamily: 'monospace', fontSize: '28px',
        color: COLORS.hudText, fontStyle: 'bold',
      }).setDepth(5);

      if (fd) {
        const nameColor = unlocked ? '#8899bb' : '#664444';
        scene.add.text(80, y + 14, fd.name, {
          fontFamily: 'monospace', fontSize: '18px', color: nameColor,
        }).setDepth(5);
      }

      if (fId !== FLOORS.LOBBY) {
        const arrowColor = unlocked ? '#00ff88' : '#ff4444';
        if (unlocked && fId === FLOORS.PLATFORM_TEAM) {
          scene.add.text(leftEdge - 20, walkY + 20, 'PLATFORM \u2190', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setOrigin(1, 0).setDepth(5);
          scene.add.text(rightEdge + 20, walkY + 20, '\u2192 ARCHITECTURE', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setDepth(5);
        } else if (unlocked && fId === FLOORS.BUSINESS) {
          scene.add.text(leftEdge - 20, walkY + 20, 'FINANCE \u2190', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setOrigin(1, 0).setDepth(5);
          scene.add.text(rightEdge + 20, walkY + 20, '\u2192 PRODUCT', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setDepth(5);
        } else if (unlocked && fId === FLOORS.PRODUCTS) {
          scene.add.text(rightEdge + 20, walkY + 20, '\u2192 PRODUCTS', {
            fontFamily: 'monospace', fontSize: '14px', color: arrowColor,
          }).setDepth(5);
        } else {
          const label = unlocked ? '\u2192 ENTER' : `LOCKED: ${this.deps.progression.getAUNeededForFloor(fId)} AU`;
          scene.add.text(rightEdge + 20, walkY + 20, label, {
            fontFamily: 'monospace', fontSize: '15px', color: arrowColor,
          }).setDepth(5);
        }
      }
    }

    // Invisible shaft walls: prevent airborne players from arcing across the
    // shaft from one floor's walk surface onto the other. Each wall is a stack
    // of vertical segments with an opening at every floor's walking Y.
    const WALL_W = 2;
    const OPENING_ABOVE = 120;
    const OPENING_BELOW = 24;
    const leftWallX = cx - sw / 2 - 1;
    const rightWallX = cx + sw / 2 + 1;

    const walkYs = Object.values(positions)
      .map((yy) => yy + floorH)
      .sort((a, b) => a - b);

    const addWallSegment = (xCenter: number, yTop: number, yBottom: number): void => {
      const h = yBottom - yTop;
      if (h <= 0) return;
      const rect = scene.add.rectangle(xCenter, yTop + h / 2, WALL_W, h, theme.color.bg.dark, 0).setDepth(0);
      scene.physics.add.existing(rect, true);
      this.platforms.add(rect);
    };

    const buildWallColumn = (xCenter: number): void => {
      let cursor = this.deps.shaftExtent.top;
      for (const walkY of walkYs) {
        addWallSegment(xCenter, cursor, walkY - OPENING_ABOVE);
        cursor = walkY + OPENING_BELOW;
      }
      addWallSegment(xCenter, cursor, this.deps.shaftExtent.bottom);
    };

    buildWallColumn(leftWallX);
    buildWallColumn(rightWallX);
  }

  private createLobbyDecorations(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const lobbyY = positions[FLOORS.LOBBY];
    const floorBottom = lobbyY + FLOOR_H;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;

    scene.add.image(80, floorBottom - 32, 'plant_tall').setDepth(3);
    scene.add.image(leftEdge - 140, floorBottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(rightEdge + 140, floorBottom - 40, 'plant_tall').setDepth(3);

    scene.add.image(leftEdge - 60, floorBottom - 32, 'plant_small').setDepth(11);
    scene.add.image(rightEdge + 60, floorBottom - 32, 'plant_small').setDepth(11);
    scene.add.image(GAME_WIDTH - 80, floorBottom - 32, 'plant_tall').setDepth(11);

    scene.add.image(300, floorBottom - 60, 'info_board').setDepth(3);
  }

  /**
   * Concrete foundation block + vent grates beneath the lobby walkway, on
   * both sides of the shaft. Reads as "ground floor" — the building sits on
   * top of something solid instead of floating over the scene background.
   */
  private createBelowLobbyFoundation(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const lobbyY = positions[FLOORS.LOBBY];
    const walkY = lobbyY + FLOOR_H;
    const bottom = this.deps.shaftExtent.bottom;
    const h = bottom - walkY;
    if (h <= 0) return;

    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;

    const leftWidth = leftEdge - 12;
    const rightX = rightEdge + 12;
    const rightWidth = GAME_WIDTH - rightX;

    const g = scene.add.graphics().setDepth(1);

    const paintBand = (x: number, w: number): void => {
      if (w <= 0) return;
      // Foundation base slab.
      g.fillStyle(0x2b2b33, 1);
      g.fillRect(x, walkY, w, h);
      // Soft inset shadow right under the lobby walkway (grounds the floor).
      g.fillStyle(0x14141a, 0.55);
      g.fillRect(x, walkY, w, 4);
      // Upper seam — top of the foundation course.
      g.fillStyle(0x3d3d48, 1);
      g.fillRect(x, walkY + 6, w, 2);
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(x, walkY + 8, w, 1);
      // Mid-band horizontal seam line.
      const seamY = walkY + Math.floor(h * 0.55);
      g.fillStyle(0x3d3d48, 1);
      g.fillRect(x, seamY, w, 1);
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(x, seamY + 1, w, 1);
      // Bottom shadow where the foundation meets the floor.
      g.fillStyle(0x14141a, 0.8);
      g.fillRect(x, bottom - 3, w, 3);
      // Concrete speckle.
      g.fillStyle(0x444450, 1);
      for (let i = 0; i < Math.floor(w / 18); i++) {
        const sx = x + 4 + ((i * 47) % Math.max(1, w - 8));
        const sy = walkY + 12 + ((i * 11) % Math.max(1, h - 18));
        g.fillRect(sx, sy, 1, 1);
      }
    };

    const paintVent = (vx: number, vy: number, vw = 34, vh = 20): void => {
      // Recessed frame.
      g.fillStyle(0x0e0e14, 1);
      g.fillRect(vx - 1, vy - 1, vw + 2, vh + 2);
      // Vent interior.
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(vx, vy, vw, vh);
      // Horizontal louvres.
      g.fillStyle(0x55606e, 1);
      for (let ly = vy + 3; ly < vy + vh - 2; ly += 4) {
        g.fillRect(vx + 2, ly, vw - 4, 1);
      }
      // Highlight on the top edge of the frame.
      g.fillStyle(0x3d3d48, 1);
      g.fillRect(vx - 1, vy - 1, vw + 2, 1);
    };

    paintBand(0, leftWidth);
    paintBand(rightX, rightWidth);

    // One vent grate per side, vertically centred in the foundation band.
    const ventY = walkY + Math.max(14, Math.floor(h * 0.3));
    if (leftWidth >= 80) paintVent(leftEdge - 12 - 60, ventY);
    if (rightWidth >= 80) paintVent(rightX + 26, ventY);

    // Second vent further out on the wide right side, for visual rhythm.
    if (rightWidth >= 260) paintVent(rightX + 200, ventY + 6, 40, 16);
    if (leftWidth >= 260) paintVent(80, ventY + 6, 40, 16);
  }

  private createFloorDecorations(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const rightEdge = cx + sw / 2;

    // F1 — Platform Team
    const f1Bottom = positions[FLOORS.PLATFORM_TEAM] + FLOOR_H;
    scene.add.image(120, f1Bottom - 50, 'server_rack').setDepth(3);
    scene.add.image(180, f1Bottom - 50, 'server_rack').setDepth(3);
    scene.add.image(300, f1Bottom - 36, 'desk_monitor').setDepth(3);
    scene.add.image(150, f1Bottom - 10, 'router').setDepth(3);
    scene.add.image(120, f1Bottom - 10, 'cables').setDepth(1);
    scene.add.image(rightEdge + 80, f1Bottom - 50, 'server_rack').setDepth(3);
    scene.add.image(rightEdge + 200, f1Bottom - 36, 'desk_monitor').setDepth(11);
    scene.add.image(rightEdge + 320, f1Bottom - 22, 'monitor_dash').setDepth(3);
    scene.add.image(rightEdge + 440, f1Bottom - 10, 'router').setDepth(3);

    // PRODUCTS — left-side ambience (doors are rendered by ProductDoorManager).
    const fProductsBottom = positions[FLOORS.PRODUCTS] + FLOOR_H;
    scene.add.image(150, fProductsBottom - 60, 'info_board').setDepth(3);
    scene.add.image(rightEdge + 100, fProductsBottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(rightEdge + 240, fProductsBottom - 32, 'plant_small').setDepth(11);

    // F3 — Business
    const f3Bottom = positions[FLOORS.BUSINESS] + FLOOR_H;
    scene.add.image(150, f3Bottom - 36, 'desk_monitor').setDepth(3);
    scene.add.image(310, f3Bottom - 22, 'monitor_dash').setDepth(3);
    scene.add.image(rightEdge + 120, f3Bottom - 36, 'desk_monitor').setDepth(3);
    scene.add.image(rightEdge + 280, f3Bottom - 22, 'monitor_dash').setDepth(11);
    scene.add.image(rightEdge + 440, f3Bottom - 40, 'plant_tall').setDepth(3);

    // F4 — Executive Suite
    const f4Bottom = positions[FLOORS.EXECUTIVE] + FLOOR_H;
    scene.add.image(120, f4Bottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(280, f4Bottom - 60, 'info_board').setDepth(3);
    scene.add.image(rightEdge + 120, f4Bottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(rightEdge + 280, f4Bottom - 36, 'desk_monitor').setDepth(3);
    scene.add.image(GAME_WIDTH - 100, f4Bottom - 40, 'plant_tall').setDepth(11);
  }

  private createShaftDoors(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;
    for (const [, y] of Object.entries(positions)) {
      const walkY = y + FLOOR_H;
      const dockY = walkY + 8;
      this.shaftDoors.push(new ElevatorShaftDoors(scene, leftEdge, rightEdge, walkY, dockY));
    }
  }

  private createShaftCable(): void {
    const scene = this.deps.scene;
    const cx = GAME_WIDTH / 2;
    // Depth 1.7: above shaft back wall / rails / beams / shaft doors,
    // below the cab graphics (2) and platform (3).
    this.shaftCable = scene.add.tileSprite(cx, this.deps.shaftExtent.top, 4, 1, 'elevator_cable')
      .setOrigin(0.5, 0)
      .setDepth(1.7);
  }

  private createFloorLEDs(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const rightEdge = cx + sw / 2;

    for (const [idStr, yTop] of Object.entries(positions)) {
      const id = Number(idStr);
      const walkY = yTop + FLOOR_H;
      const dockY = walkY + 8;
      const ledX = rightEdge - 12;
      const ledY = walkY - 148;
      const gfx = scene.add.graphics();
      gfx.setDepth(5);
      this.floorLEDs.set(id, { gfx, x: ledX, y: ledY, dockY });
    }
  }
}
