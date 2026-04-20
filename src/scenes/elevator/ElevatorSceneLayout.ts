import * as Phaser from 'phaser';
import { GAME_WIDTH, FLOORS, TILE_SIZE, FloorId } from '../../config/gameConfig';
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
  /**
   * Y coordinate at which the cable anchors (bottom tangent of the pulley
   * wheel inside the machine room). Initialised in `createMachineRoom()`
   * before `createShaftCable()` runs. Falls back to the shaft top if the
   * machine room isn't built for some reason.
   */
  private pulleyAnchorY = 0;
  private floorLEDs = new Map<number, {
    clusters: { gfx: Phaser.GameObjects.Graphics; x: number; y: number }[];
    dockY: number;
  }>();
  /**
   * World-space bounds of the F4 walkway area where Geir Harald paces, for
   * the elevator scene's proximity zone. Populated when Geir is drawn in
   * {@link createFloorDecorations}.
   */
  private geirBounds?: { x: number; y: number; width: number; height: number };

  /**
   * World-space bounds of the receptionist desk proximity area in the lobby,
   * for the "Hello!" greeting zone. Populated in
   * {@link createLobbyDecorations}.
   */
  private receptionBounds?: { x: number; y: number; width: number; height: number };

  /** Container holding the receptionist's "Hello!" speech bubble. Hidden by default. */
  private receptionistBubble?: Phaser.GameObjects.Container;

  constructor(private readonly deps: ElevatorSceneLayoutDeps) {
    this.platforms = deps.scene.physics.add.staticGroup();
  }

  /** Build the entire elevator-scene visual scaffolding in order. */
  build(): void {
    this.pulleyAnchorY = this.deps.shaftExtent.top;
    this.createShaftBackground();
    this.createShaftCaps();
    this.createRooftop();
    this.createMachineRoom();
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
    const h = Math.max(0, cabTop - this.pulleyAnchorY);
    this.shaftCable.setSize(4, h);
  }

  /** Y coordinate at which the shaft cable and twin cab cables anchor. */
  getPulleyAnchorY(): number {
    return this.pulleyAnchorY;
  }

  /**
   * World-space bounds of Geir Harald's pacing area on the F4 walkway in
   * the elevator scene. Used by {@link ElevatorZones} to register a
   * proximity zone the player can reach by stepping off the cab at F4.
   */
  getGeirBounds(): { x: number; y: number; width: number; height: number } | undefined {
    return this.geirBounds;
  }

  /**
   * World-space bounds of the reception desk proximity area. Consumed by
   * {@link ElevatorZones} to register the "Hello!" greeting zone.
   */
  getReceptionBounds(): { x: number; y: number; width: number; height: number } | undefined {
    return this.receptionBounds;
  }

  /** The receptionist's speech-bubble container — shown on zone:enter. */
  getReceptionistBubble(): Phaser.GameObjects.Container | undefined {
    return this.receptionistBubble;
  }

  updateFloorLEDs(controller: ElevatorController | undefined): void {
    if (!controller) return;
    const cabY = controller.elevator.getY();
    for (const { clusters, dockY } of this.floorLEDs.values()) {
      const lit = Math.abs(cabY - dockY) <= 12;
      const color = lit ? 0x00ff66 : 0x335533;
      for (const { gfx, x, y } of clusters) {
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
    // Depth 2.1: above the hallway floor tiles (depth 2) so the dark
    // outer shaft pillars stay visible at every floor row (otherwise
    // purple hallway tiles cover them and the shaft's outer edge appears
    // to "notch inward" at each floor). Still below the shaft doors
    // (depth 2.5) so the doorway visually cuts through the pillar.
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

  /**
   * Building rooftop drawn to the LEFT and RIGHT of the shaft, in the band
   * above the F4 floor slab (y < shaftExtent.top). Gives the top floor a
   * believable "top of the building" look with parapets and rooftop props
   * (HVAC vent, exhaust pipes, antenna, satellite dish).
   */
  private createRooftop(): void {
    const scene = this.deps.scene;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;
    const roofY = this.deps.shaftExtent.top;

    const g = scene.add.graphics().setDepth(3);

    const drawDeck = (x0: number, x1: number): void => {
      // Darker seam line right at the top of the roof (the "edge" the
      // parapet sits on).
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(x0, roofY - 4, x1 - x0, 4);
      // Tar deck surface — only needs to be a few px tall since the F4
      // floor slab starts at roofY and covers everything below.
      g.fillStyle(0x2a2a34, 1);
      g.fillRect(x0, roofY, x1 - x0, 6);
      // Gravel speckle for texture.
      g.fillStyle(0x4a4a55, 1);
      for (let i = 0; i < 40; i++) {
        const sx = x0 + ((i * 41) % Math.max(1, x1 - x0));
        g.fillRect(sx, roofY - 3 + (i % 4), 1, 1);
      }
    };
    drawDeck(0, leftEdge);
    drawDeck(rightEdge, GAME_WIDTH);

    // Outer parapets at the far edges so the rooftop reads as enclosed.
    g.fillStyle(0x333344, 1);
    g.fillRect(0, roofY - 18, 12, 18);
    g.fillRect(GAME_WIDTH - 12, roofY - 18, 12, 18);
    g.fillStyle(0x55556a, 1);
    g.fillRect(0, roofY - 18, 12, 2);
    g.fillRect(GAME_WIDTH - 12, roofY - 18, 12, 2);

    // Short parapets adjacent to the shaft lintel.
    g.fillStyle(0x2a2a36, 1);
    g.fillRect(leftEdge - 36, roofY - 12, 24, 12);
    g.fillRect(rightEdge + 12, roofY - 12, 24, 12);
    g.fillStyle(0x55556a, 1);
    g.fillRect(leftEdge - 36, roofY - 12, 24, 2);
    g.fillRect(rightEdge + 12, roofY - 12, 24, 2);

    // Props — left side
    this.drawHvacVent(g, 140, roofY);
    this.drawExhaustPipes(g, 320, roofY);
    // Props — right side
    this.drawAntenna(g, rightEdge + 120, roofY);
    this.drawSatelliteDish(g, rightEdge + 280, roofY);
  }

  private drawHvacVent(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
    // Base plinth on the roof deck.
    g.fillStyle(0x22222c, 1);
    g.fillRect(x, roofY - 6, 96, 6);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(x, roofY - 6, 96, 2);
    // Main box body.
    g.fillStyle(0x6a6a78, 1);
    g.fillRect(x + 4, roofY - 46, 88, 40);
    g.fillStyle(0x88889a, 1);
    g.fillRect(x + 4, roofY - 46, 88, 2);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(x + 4, roofY - 8, 88, 2);
    // Louvers.
    g.fillStyle(0x1a1a22, 1);
    for (let i = 0; i < 5; i++) {
      g.fillRect(x + 12, roofY - 40 + i * 7, 72, 3);
    }
    // Top cowling.
    g.fillStyle(0x55556a, 1);
    g.fillRect(x, roofY - 56, 96, 10);
    g.fillStyle(0x88899a, 1);
    g.fillRect(x, roofY - 56, 96, 2);
    // Small exhaust stack on top.
    g.fillStyle(0x33333f, 1);
    g.fillRect(x + 40, roofY - 70, 16, 14);
    g.fillStyle(0x55556a, 1);
    g.fillRect(x + 40, roofY - 70, 16, 2);
    // Warning label (orange band).
    g.fillStyle(0xffcc33, 0.85);
    g.fillRect(x + 12, roofY - 18, 20, 4);
  }

  private drawExhaustPipes(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
    // Shared pipe bank base.
    g.fillStyle(0x22222c, 1);
    g.fillRect(x - 4, roofY - 6, 60, 6);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(x - 4, roofY - 6, 60, 2);

    const heights = [62, 86, 46, 70];
    for (let i = 0; i < heights.length; i++) {
      const px = x + i * 14;
      const ph = heights[i];
      // Pipe body.
      g.fillStyle(0x1a1a22, 1);
      g.fillRect(px, roofY - ph, 8, ph);
      g.fillStyle(0x55556a, 1);
      g.fillRect(px + 1, roofY - ph, 2, ph);
      g.fillStyle(0x33333f, 1);
      g.fillRect(px + 6, roofY - ph, 1, ph);
      // Cap.
      g.fillStyle(0x3a3a46, 1);
      g.fillRect(px - 1, roofY - ph - 4, 10, 4);
      g.fillStyle(0x88909c, 1);
      g.fillRect(px - 1, roofY - ph - 4, 10, 1);
      // Connecting band near the base.
      if (i < heights.length - 1) {
        g.fillStyle(0x55556a, 1);
        g.fillRect(px + 7, roofY - 14, 7, 2);
      }
    }
  }

  private drawAntenna(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
    // Base plate.
    g.fillStyle(0x22222c, 1);
    g.fillRect(x - 12, roofY - 4, 28, 4);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(x - 12, roofY - 4, 28, 1);
    // Main mast.
    g.fillStyle(0x88909c, 1);
    g.fillRect(x + 1, roofY - 110, 2, 106);
    g.fillStyle(0x55606e, 1);
    g.fillRect(x + 3, roofY - 110, 1, 106);
    // Tripod supports.
    g.lineStyle(1, 0x55606e, 1);
    g.beginPath();
    g.moveTo(x - 10, roofY - 4); g.lineTo(x + 2, roofY - 32);
    g.moveTo(x + 14, roofY - 4); g.lineTo(x + 2, roofY - 32);
    g.strokePath();
    // Dipole cross-bars, decreasing in length toward the top.
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
    // Red aviation warning light.
    g.fillStyle(0xff8888, 0.5);
    g.fillCircle(x + 2, roofY - 112, 5);
    g.fillStyle(0xff3333, 1);
    g.fillCircle(x + 2, roofY - 112, 2);
  }

  private drawSatelliteDish(g: Phaser.GameObjects.Graphics, x: number, roofY: number): void {
    // Base sled.
    g.fillStyle(0x22222c, 1);
    g.fillRect(x - 18, roofY - 4, 38, 4);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(x - 18, roofY - 4, 38, 1);
    // Tripod legs.
    g.lineStyle(2, 0x55606e, 1);
    g.beginPath();
    g.moveTo(x - 12, roofY - 4); g.lineTo(x + 1, roofY - 30);
    g.moveTo(x + 12, roofY - 4); g.lineTo(x + 1, roofY - 30);
    g.strokePath();
    // Pedestal neck.
    g.fillStyle(0x55606e, 1);
    g.fillRect(x - 3, roofY - 38, 6, 14);
    g.fillStyle(0x88909c, 1);
    g.fillRect(x - 3, roofY - 38, 6, 1);
    // Dish (off-axis ellipse giving it a tilted look).
    g.fillStyle(0xbfbfcf, 1);
    g.fillEllipse(x + 10, roofY - 50, 44, 36);
    g.fillStyle(0x88909c, 1);
    g.fillEllipse(x + 12, roofY - 50, 36, 30);
    g.fillStyle(0x55606e, 1);
    g.fillEllipse(x + 14, roofY - 50, 28, 22);
    // Feed arm + LNB.
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
   * Machine room directly above the shaft ceiling cap. Houses the pulley
   * and motor that the elevator cable wraps over, so the cable has a
   * visible anchor instead of disappearing into a blank ceiling.
   * Publishes {@link pulleyAnchorY} for {@link createShaftCable}.
   */
  private createMachineRoom(): void {
    const scene = this.deps.scene;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const top = this.deps.shaftExtent.top;
    const capTop = top - 24;            // top edge of existing ceiling cap
    const roomH = 92;
    const roomW = sw + 40;
    const roomLeft = cx - roomW / 2;
    const roomTop = capTop - roomH;
    const wallT = 4;

    // Interior + walls — depth 1 so the cable (1.7) renders in front.
    const bg = scene.add.graphics().setDepth(1);
    bg.fillStyle(0x16161c, 1);
    bg.fillRect(roomLeft, roomTop, roomW, roomH);
    bg.fillStyle(0x2a2a34, 1);
    bg.fillRect(roomLeft, roomTop, roomW, wallT);                     // ceiling
    bg.fillRect(roomLeft, roomTop, wallT, roomH);                     // left wall
    bg.fillRect(roomLeft + roomW - wallT, roomTop, wallT, roomH);     // right wall
    bg.fillStyle(0x55556a, 1);
    bg.fillRect(roomLeft, roomTop, roomW, 1);                         // top highlight
    bg.fillStyle(0x1a1a22, 1);
    bg.fillRect(roomLeft, roomTop + wallT - 1, roomW, 1);             // ceiling shadow

    // External vent louvers on the room's left & right walls.
    bg.fillStyle(0x33333f, 1);
    for (let i = 0; i < 4; i++) {
      bg.fillRect(roomLeft + 8, roomTop + 18 + i * 12, 18, 3);
      bg.fillRect(roomLeft + roomW - 26, roomTop + 18 + i * 12, 18, 3);
    }

    // Hazard chevron along the inside bottom of the room (above the cap).
    const chevY = roomTop + roomH - 6;
    bg.fillStyle(0x111114, 1);
    bg.fillRect(roomLeft + wallT, chevY, roomW - 2 * wallT, 4);
    bg.fillStyle(0xffcc33, 1);
    for (let xx = roomLeft + wallT; xx < roomLeft + roomW - wallT; xx += 12) {
      bg.fillTriangle(xx, chevY, xx + 6, chevY, xx + 3, chevY + 4);
    }

    // Motor housing to the left of the pulley.
    const motorX = cx - 64;
    const motorY = roomTop + 34;
    bg.fillStyle(0x3a3a48, 1);
    bg.fillRect(motorX, motorY, 44, 44);
    bg.fillStyle(0x55556a, 1);
    bg.fillRect(motorX, motorY, 44, 3);
    bg.fillStyle(0x1a1a22, 1);
    bg.fillRect(motorX, motorY + 41, 44, 3);
    // Cooling fins.
    bg.fillStyle(0x22222a, 1);
    for (let i = 0; i < 6; i++) bg.fillRect(motorX + 4 + i * 6, motorY + 8, 2, 28);
    // Status LED.
    bg.fillStyle(0x00ff66, 0.35);
    bg.fillCircle(motorX + 38, motorY + 10, 4);
    bg.fillStyle(0x00ff66, 1);
    bg.fillCircle(motorX + 38, motorY + 10, 2);
    // Mount bolts.
    bg.fillStyle(0x88909c, 1);
    bg.fillRect(motorX + 2, motorY + 2, 2, 2);
    bg.fillRect(motorX + 40, motorY + 2, 2, 2);
    bg.fillRect(motorX + 2, motorY + 40, 2, 2);
    bg.fillRect(motorX + 40, motorY + 40, 2, 2);

    // Drive belt from motor to pulley hub.
    const pulleyR = 18;
    const pulleyX = cx;
    const pulleyY = roomTop + 54;
    bg.fillStyle(0x111114, 1);
    bg.fillRect(motorX + 44, pulleyY - 2, pulleyX - (motorX + 44), 4);
    bg.fillStyle(0x33333f, 1);
    bg.fillRect(motorX + 44, pulleyY - 2, pulleyX - (motorX + 44), 1);

    // Pulley mount bracket bolted to the ceiling.
    bg.fillStyle(0x33333f, 1);
    bg.fillRect(pulleyX - 14, roomTop + wallT, 28, 10);
    bg.fillStyle(0x55556a, 1);
    bg.fillRect(pulleyX - 14, roomTop + wallT, 28, 2);
    bg.fillStyle(0x88909c, 1);
    bg.fillCircle(pulleyX - 10, roomTop + wallT + 5, 1);
    bg.fillCircle(pulleyX + 10, roomTop + wallT + 5, 1);

    // Pulley wheel — depth 2 so the cable (1.7) passes BEHIND it,
    // reading as wrapped under the wheel.
    const pulley = scene.add.graphics().setDepth(2);
    pulley.fillStyle(0x1a1a22, 1);
    pulley.fillCircle(pulleyX, pulleyY, pulleyR);
    pulley.fillStyle(0x55606e, 1);
    pulley.fillCircle(pulleyX, pulleyY, pulleyR - 3);
    pulley.fillStyle(0x2a2a32, 1);
    pulley.fillCircle(pulleyX, pulleyY, 6);
    pulley.fillStyle(0x88909c, 1);
    pulley.fillCircle(pulleyX, pulleyY, 2);
    // Spokes.
    pulley.lineStyle(2, 0x33333f, 1);
    pulley.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      pulley.moveTo(pulleyX + Math.cos(a) * 5, pulleyY + Math.sin(a) * 5);
      pulley.lineTo(pulleyX + Math.cos(a) * (pulleyR - 4), pulleyY + Math.sin(a) * (pulleyR - 4));
    }
    pulley.strokePath();
    // Groove ring.
    pulley.lineStyle(1, 0x1a1a22, 1);
    pulley.strokeCircle(pulleyX, pulleyY, pulleyR - 6);

    // The cable anchors at the pulley's bottom tangent.
    this.pulleyAnchorY = pulleyY + pulleyR - 1;
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
        // Tile the LEFT hallway outward from the shaft wall (mirror of the
        // right-side loop below) so the tile row meets the shaft flush on
        // both sides. Any partial tile past x=0 gets clipped by the scene
        // edge, not by the shaft edge — this keeps the two door openings
        // visually the same width.
        for (let tileRight = leftEdge; tileRight > 0; tileRight -= TILE_SIZE) {
          scene.add.image(tileRight - TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
        }
        for (let tileLeft = rightEdge; tileLeft < GAME_WIDTH; tileLeft += TILE_SIZE) {
          scene.add.image(tileLeft + TILE_SIZE / 2, tileY, 'platform_tile').setDepth(2);
        }
      }

      // Walking surfaces. Visible strip stays in the hallway (colour
      // 0x444466 overlapping the shaft interior would look like purple
      // bleeding onto the concrete shaft). Physics body is a separate
      // invisible rectangle that spans into the cab zone (WALK_OVERLAP = 4
      // closes the seam with the cab when docked) so the player can walk
      // across the shaft gap onto the cab.
      const walkY = y + floorH;
      const WALK_OVERLAP = 4;
      const addWalkStrip = (visibleX: number, visibleW: number, collX: number, collW: number) => {
        if (visibleW > 0) {
          scene.add.rectangle(visibleX, walkY + WALK_H / 2, visibleW, WALK_H, 0x444466, 1).setDepth(2);
        }
        const coll = scene.add.rectangle(collX, walkY + WALK_H / 2, collW, WALK_H, 0, 0);
        scene.physics.add.existing(coll, true);
        this.platforms.add(coll);
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

      // Floor signage plaques on the outer walkways (outside the shaft).
      // If the floor hosts two distinct rooms (rooms.left / rooms.right),
      // render one plaque above each walkway. Otherwise a single plaque
      // on the left walkway names the whole floor.
      const fNumber = labels[fId] ?? `F${fId}`;
      // Anchored near the top of the floor's open air (just below the
      // ceiling slab of the floor above) so the plaques read as signage
      // rather than floating mid-room.
      const plaqueY = walkY - 240;
      const leftPlaqueX = leftCollW / 2;
      const rightPlaqueX = (elevRight - WALK_OVERLAP + GAME_WIDTH) / 2;
      if (fd?.rooms) {
        this.placeFloorPlaque(leftPlaqueX, plaqueY, fNumber, fd.rooms.left, unlocked);
        this.placeFloorPlaque(rightPlaqueX, plaqueY, fNumber, fd.rooms.right, unlocked);
      } else {
        const name = fd?.name ?? fNumber;
        this.placeFloorPlaque(leftPlaqueX, plaqueY, fNumber, name, unlocked);
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

  /**
   * Draws a signage plaque (dark plate + bordered rect + bright stroked text)
   * anchored at {@link centerY}. Used for per-floor labels on the outer
   * walkways. Locked floors render at reduced alpha with a muted palette
   * but remain legible.
   */
  private placeFloorPlaque(
    centerX: number,
    centerY: number,
    fNumber: string,
    roomName: string,
    unlocked: boolean,
  ): void {
    const scene = this.deps.scene;
    const label = `${fNumber} \u00B7 ${roomName}`;
    const textColor = unlocked ? theme.color.css.textPrimary : theme.color.css.textMuted;
    const text = scene.add.text(centerX, centerY, label, {
      fontFamily: 'monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: textColor,
    }).setOrigin(0.5, 0.5);
    text.setStroke('#000000', 3);

    const padX = 14;
    const padY = 6;
    const plaqueW = Math.ceil(text.width) + padX * 2;
    const plaqueH = Math.ceil(text.height) + padY * 2;
    const bgColor = 0x0a1422;
    const bgAlpha = unlocked ? 0.9 : 0.75;
    const borderColor = unlocked ? 0x2a3a5a : 0x33333f;
    const plaque = scene.add.rectangle(centerX, centerY, plaqueW, plaqueH, bgColor, bgAlpha)
      .setStrokeStyle(1, borderColor, 1)
      .setDepth(5);
    text.setDepth(plaque.depth + 1);
  }

  private createLobbyDecorations(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const lobbyY = positions[FLOORS.LOBBY];
    const floorBottom = lobbyY + FLOOR_H;

    // Left walkway — reception side.
    // Wall-mounted Norconsult Digital sign (anchored to the lobby band).
    const signY = lobbyY + 50;
    const signX = 260;
    scene.add.image(signX, signY, 'lobby_logo').setDepth(2);
    scene.add.text(signX + 60, signY - 6, 'Norconsult', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f5f5f5',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(3);
    scene.add.text(signX + 60, signY + 14, 'Digital', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: theme.color.css.textAccent,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(3);

    scene.add.image(60, floorBottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(100, floorBottom - 32, 'plant_small').setDepth(3);

    // Reception desk with the seated receptionist tucked behind it.
    const deskX = 200;
    const deskY = floorBottom - 45;
    // Seated behind counter. Desk texture is 160x90 so the counter top
    // sits around deskY - 35; place her head a few px above that so her
    // upper body clears while the counter occludes the rest.
    scene.add.image(deskX, deskY - 30, 'receptionist').setDepth(2);
    scene.add.image(deskX, deskY, 'reception_desk').setDepth(3);

    // Blue entry rug in front of the desk (reuse welcome_mat, tinted).
    scene.add.image(deskX + 30, floorBottom - 6, 'welcome_mat')
      .setDepth(2)
      .setTint(0x1a237e);

    // Proximity area for the "Hello!" bubble (centred on the desk).
    this.receptionBounds = { x: deskX - 80, y: deskY - 60, width: 160, height: 120 };
    this.receptionistBubble = this.createSpeechBubble(scene, deskX + 40, deskY - 90, 'Hello!');
    this.receptionistBubble.setVisible(false);

    scene.add.image(355, floorBottom - 60, 'info_board').setDepth(3);
    scene.add.image(425, floorBottom - 32, 'plant_small').setDepth(3);
    scene.add.image(485, floorBottom - 40, 'plant_tall').setDepth(11);

    // Right walkway — waiting area.
    // Wall-mounted clock (anchored to lobbyY band).
    scene.add.image(1000, lobbyY + 60, 'wall_clock').setDepth(2);
    scene.add.image(790, floorBottom - 8, 'welcome_mat').setDepth(4);
    // Moved from x=870 -> x=820 so it no longer overlaps the sofa.
    scene.add.image(820, floorBottom - 32, 'plant_small').setDepth(11);
    scene.add.image(960, floorBottom - 30, 'sofa').setDepth(3);
    scene.add.image(1070, floorBottom - 14, 'coffee_table').setDepth(3);
    scene.add.image(1120, floorBottom - 48, 'floor_lamp').setDepth(3);
    scene.add.image(1210, floorBottom - 40, 'plant_tall').setDepth(3);
  }

  /**
   * Build a small rounded-rect speech bubble with a downward tail, anchored
   * at (x, y) as the bottom-centre of the tail. Used for the receptionist's
   * "Hello!" greeting — purely decorative, no input.
   */
  private createSpeechBubble(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
  ): Phaser.GameObjects.Container {
    const padX = 10;
    const padY = 6;
    const txt = scene.make.text({
      x: 0,
      y: 0,
      text: message,
      style: {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#102027',
        fontStyle: 'bold',
      },
    }).setOrigin(0.5);
    const w = Math.ceil(txt.width) + padX * 2;
    const h = Math.ceil(txt.height) + padY * 2;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0xffffff, 0.96);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    gfx.lineStyle(2, 0x102027, 1);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    // Downward tail.
    gfx.fillStyle(0xffffff, 0.96);
    gfx.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 8);
    gfx.lineStyle(2, 0x102027, 1);
    gfx.strokeTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 8);

    const container = scene.add.container(x, y - h / 2 - 6, [gfx, txt]);
    container.setDepth(12);
    return container;
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
    const rightEdge = GAME_WIDTH / 2 + this.deps.shaftWidth / 2;

    // F1 — Platform Team
    const f1Bottom = positions[FLOORS.PLATFORM_TEAM] + FLOOR_H;
    this.createF1PlatformDecorations(f1Bottom);
    this.createF1ArchitectureDecorations(f1Bottom, rightEdge);

    // PRODUCTS — doors are rendered by ProductDoorManager across both sides
    // of the shaft, so keep ambient dressing minimal to avoid visual clash.
    const fProductsBottom = positions[FLOORS.PRODUCTS] + FLOOR_H;
    scene.add.image(150, fProductsBottom - 60, 'info_board').setDepth(3);
    scene.add.image(rightEdge + 440, fProductsBottom - 40, 'plant_tall').setDepth(3);

    // F3 — Business (Product Leadership on the left, Customer Success on the right)
    const f3Bottom = positions[FLOORS.BUSINESS] + FLOOR_H;
    this.createF3ProductLeadershipDecorations(f3Bottom);
    this.createF3CustomerSuccessDecorations(f3Bottom, rightEdge);

    // F4 — Executive Suite
    const f4Bottom = positions[FLOORS.EXECUTIVE] + FLOOR_H;
    scene.add.image(120, f4Bottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(280, f4Bottom - 60, 'info_board').setDepth(3);
    // Geir Harald — pacing the walkway in the F4 shaft preview. Sprite origin
    // is bottom-center so his feet sit on the walkable surface.
    const GEIR_MIN_X = 150;
    const GEIR_MAX_X = 260;
    const geir = scene.add.sprite(200, f4Bottom, 'npc_geir', 0)
      .setOrigin(0.5, 1)
      .setDepth(3);
    geir.play('geir_walk');
    scene.tweens.add({
      targets: geir,
      x: { from: GEIR_MIN_X, to: GEIR_MAX_X },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      onYoyo: () => geir.setFlipX(true),
      onRepeat: () => geir.setFlipX(false),
    });
    const label = scene.add.text(200, f4Bottom - 140, 'Geir Harald', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: theme.color.css.textPale,
      fontStyle: 'bold',
      backgroundColor: theme.color.css.bgPanel,
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(4);
    // Keep the label pinned above Geir as he walks.
    scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
      label.x = geir.x;
    });
    // Padded bounds around his pacing range — player proximity opens the
    // OKR dialog via ElevatorZones.
    const pad = 50;
    this.geirBounds = {
      x: GEIR_MIN_X - pad,
      y: f4Bottom - 140,
      width: (GEIR_MAX_X - GEIR_MIN_X) + pad * 2,
      height: 150,
    };
    scene.add.image(rightEdge + 120, f4Bottom - 40, 'plant_tall').setDepth(3);
    scene.add.image(rightEdge + 280, f4Bottom - 36, 'desk_monitor').setDepth(3);
    scene.add.image(GAME_WIDTH - 100, f4Bottom - 40, 'plant_tall').setDepth(11);
  }

  private createF1PlatformDecorations(f1Bottom: number): void {
    const scene = this.deps.scene;

    scene.add.image(100, f1Bottom - 50, 'server_rack')
      .setDepth(3)
      .setName('f1-left-server-rack-1');
    scene.add.image(170, f1Bottom - 50, 'server_rack')
      .setDepth(3)
      .setName('f1-left-server-rack-2');
    scene.add.image(290, f1Bottom - 36, 'desk_monitor')
      .setDepth(3)
      .setName('f1-left-desk-monitor');
    const dashMonitor = scene.add.image(400, f1Bottom - 22, 'monitor_dash')
      .setDepth(3)
      .setName('f1-left-monitor-dash');
    scene.add.image(480, f1Bottom - 10, 'router')
      .setDepth(3)
      .setName('f1-left-router');

    scene.tweens.add({
      targets: dashMonitor,
      alpha: 0.65,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createF1ArchitectureDecorations(f1Bottom: number, rightEdge: number): void {
    const scene = this.deps.scene;

    const c4Board = scene.add.rectangle(rightEdge + 90, f1Bottom - 56, 120, 86, 0xf0eee2, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0xa8a79a, 1)
      .setName('f1-right-c4-board');
    scene.add.text(c4Board.x, c4Board.y - 30, 'C4 CONTEXT', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#3a4a66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    const adrBody = scene.add.rectangle(rightEdge + 250, f1Bottom - 58, 110, 92, 0x2a1e12, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x7a5e36, 1)
      .setName('f1-right-adr-terminal');
    scene.add.rectangle(adrBody.x, adrBody.y - 26, 90, 44, 0x08140a, 1).setDepth(4);
    scene.add.text(adrBody.x, adrBody.y + 14, 'ADR LOG', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f5c36a',
    }).setOrigin(0.5).setDepth(4);
    const cursor = scene.add.rectangle(adrBody.x + 34, adrBody.y - 6, 4, 10, 0xe0b860, 1)
      .setDepth(5)
      .setName('f1-right-adr-cursor');
    scene.tweens.add({
      targets: cursor,
      alpha: 0.15,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const slicePanel = scene.add.rectangle(rightEdge + 410, f1Bottom - 58, 120, 94, 0x1a2238, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x3b5a8a, 1)
      .setName('f1-right-slice-panel');
    scene.add.text(slicePanel.x, slicePanel.y - 34, 'SLICES', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#e8f1ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    const highlight = scene.add.rectangle(slicePanel.x, slicePanel.y - 10, 96, 14, 0xfff2b0, 0.4)
      .setDepth(5)
      .setName('f1-right-slice-highlight');
    scene.tweens.add({
      targets: highlight,
      y: highlight.y + 28,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createF3ProductLeadershipDecorations(f3Bottom: number): void {
    const scene = this.deps.scene;

    // Roadmap / OKR board — three swim lanes with milestone pegs and an
    // animated "now" marker sweeping across the quarters.
    const boardX = 160;
    const boardY = f3Bottom - 58;
    const board = scene.add.rectangle(boardX, boardY, 220, 110, 0xf4ecd8, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x8a6a3a, 1)
      .setName('f3-left-roadmap-board');
    scene.add.text(board.x, board.y - 44, 'ROADMAP', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#5a3a1a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    // Three swim lanes
    const laneColors = [0xc98b5b, 0x5e8d6e, 0x5b7ac9];
    for (let i = 0; i < 3; i++) {
      const laneY = board.y - 18 + i * 18;
      scene.add.rectangle(board.x, laneY, 200, 12, laneColors[i], 0.35)
        .setDepth(4)
        .setName(`f3-left-roadmap-lane-${i}`);
      // Milestone pegs per lane
      for (let j = 0; j < 4; j++) {
        const pegX = board.x - 80 + j * 54;
        scene.add.circle(pegX, laneY, 3, laneColors[i], 1).setDepth(5);
      }
    }

    // Animated "now" marker — vertical bar sweeping left→right.
    const nowMarker = scene.add.rectangle(board.x - 96, board.y - 10, 2, 66, 0xd23a3a, 0.9)
      .setDepth(6)
      .setName('f3-left-roadmap-now-marker');
    scene.tweens.add({
      targets: nowMarker,
      x: board.x + 96,
      duration: 4800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Customer-outcomes post-it wall — small coloured squares in a grid.
    const wallX = 360;
    const wallY = f3Bottom - 58;
    const wallBg = scene.add.rectangle(wallX, wallY, 120, 100, 0x2d2520, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x4a3b2a, 1)
      .setName('f3-left-outcomes-wall');
    scene.add.text(wallBg.x, wallBg.y - 38, 'OUTCOMES', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#e8d4a8',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    const postitColors = [0xffe066, 0xff9f66, 0x9be37a, 0x66c3ff, 0xffa8d0, 0xffe066];
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      scene.add.rectangle(
        wallBg.x - 32 + col * 32,
        wallBg.y - 10 + row * 24,
        22,
        18,
        postitColors[i],
        0.95,
      ).setDepth(4).setName(`f3-left-outcomes-postit-${i}`);
    }

    // Plant for warmth.
    scene.add.image(480, f3Bottom - 40, 'plant_tall')
      .setDepth(3)
      .setName('f3-left-plant');
  }

  private createF3CustomerSuccessDecorations(f3Bottom: number, rightEdge: number): void {
    const scene = this.deps.scene;

    // NPS gauge with oscillating needle.
    const gaugeX = rightEdge + 90;
    const gaugeY = f3Bottom - 60;
    const gaugeBody = scene.add.rectangle(gaugeX, gaugeY, 120, 96, 0x1a2a3a, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x3a6a9a, 1)
      .setName('f3-right-nps-gauge');
    scene.add.text(gaugeBody.x, gaugeBody.y - 34, 'NPS', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#e8f1ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    // Gauge arc — three-segment colored band.
    scene.add.rectangle(gaugeBody.x - 28, gaugeBody.y - 6, 24, 8, 0xd23a3a, 1).setDepth(4);
    scene.add.rectangle(gaugeBody.x, gaugeBody.y - 6, 24, 8, 0xe8c23a, 1).setDepth(4);
    scene.add.rectangle(gaugeBody.x + 28, gaugeBody.y - 6, 24, 8, 0x3aa85e, 1).setDepth(4);
    // Needle — pivot at bottom of gauge face, swing across segments.
    const needle = scene.add.rectangle(gaugeBody.x, gaugeBody.y - 6, 2, 34, 0xffffff, 1)
      .setOrigin(0.5, 1)
      .setDepth(5)
      .setName('f3-right-nps-needle');
    scene.tweens.add({
      targets: needle,
      angle: { from: -55, to: 55 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.add.text(gaugeBody.x, gaugeBody.y + 30, '+42', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#9be37a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    // Scrolling ticket-queue panel (mirrors F1 ADR kiosk idiom).
    const queueX = rightEdge + 250;
    const queueY = f3Bottom - 60;
    const queueBody = scene.add.rectangle(queueX, queueY, 120, 96, 0x0f1a22, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x2a5a7a, 1)
      .setName('f3-right-ticket-queue');
    scene.add.text(queueBody.x, queueBody.y - 34, 'TICKETS', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#6ec6ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    // Rows representing open tickets; one highlighted as "active".
    const rowColors = [0x2a3a4a, 0x2a3a4a, 0x2a3a4a, 0x2a3a4a];
    rowColors.forEach((color, i) => {
      scene.add.rectangle(queueBody.x, queueBody.y - 12 + i * 14, 100, 10, color, 1).setDepth(4);
    });
    const activeRow = scene.add.rectangle(queueBody.x, queueBody.y - 12, 100, 10, 0x6ec6ff, 0.35)
      .setDepth(5)
      .setName('f3-right-ticket-active-row');
    scene.tweens.add({
      targets: activeRow,
      y: queueBody.y + 30,
      duration: 2200,
      repeat: -1,
      ease: 'Linear',
      onRepeat: () => { activeRow.y = queueBody.y - 12; },
    });

    // SLA dashboard tile — pulsing green indicator.
    const slaX = rightEdge + 410;
    const slaY = f3Bottom - 60;
    const slaBody = scene.add.rectangle(slaX, slaY, 120, 96, 0x15221a, 1)
      .setDepth(3)
      .setStrokeStyle(2, 0x3aa85e, 1)
      .setName('f3-right-sla-tile');
    scene.add.text(slaBody.x, slaBody.y - 34, 'SLA', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#9be37a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    scene.add.text(slaBody.x, slaBody.y - 2, '99.9%', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#c8ffb0',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    const pulse = scene.add.circle(slaBody.x + 44, slaBody.y - 34, 4, 0x3aff6a, 1)
      .setDepth(5)
      .setName('f3-right-sla-pulse');
    scene.tweens.add({
      targets: pulse,
      alpha: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Plant to balance the space.
    scene.add.image(rightEdge + 500, f3Bottom - 40, 'plant_tall')
      .setDepth(3)
      .setName('f3-right-plant');
  }

  private createShaftDoors(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;
    for (const [floorIdStr, y] of Object.entries(positions)) {
      const fId = Number(floorIdStr) as FloorId;
      const walkY = y + FLOOR_H;
      const dockY = walkY + 8;
      const cavityColor = LEVEL_DATA[fId]?.theme.backgroundColor ?? 0x1a1a2e;
      this.shaftDoors.push(
        new ElevatorShaftDoors(scene, leftEdge, rightEdge, walkY, dockY, cavityColor),
      );
    }
  }

  private createShaftCable(): void {
    const scene = this.deps.scene;
    const cx = GAME_WIDTH / 2;
    // Depth 1.7: above shaft back wall / rails / beams / shaft doors and
    // machine-room interior (1), below the pulley wheel (2), the cab
    // graphics (2) and the platform (3). Origin Y is the pulley's bottom
    // tangent so the cable visibly emerges from under the wheel instead of
    // appearing at the top of the shaft.
    this.shaftCable = scene.add.tileSprite(cx, this.pulleyAnchorY, 4, 1, 'elevator_cable')
      .setOrigin(0.5, 0)
      .setDepth(1.7);
  }

  private createFloorLEDs(): void {
    const scene = this.deps.scene;
    const positions = this.deps.floorYPositions;
    const cx = GAME_WIDTH / 2;
    const sw = this.deps.shaftWidth;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;

    for (const [idStr, yTop] of Object.entries(positions)) {
      const id = Number(idStr);
      const walkY = yTop + FLOOR_H;
      const dockY = walkY + 8;
      // Mirror the LED cluster on both shaft walls. The cluster is 10px
      // wide (two 2px-radius circles at +2 and +8, inside a 12px backplate
      // drawn at x-1..x+11). Position right cluster 2px inside the inner
      // wall (original offset) and mirror the left cluster symmetrically.
      const rightLedX = rightEdge - 12;
      const leftLedX = leftEdge + 2;
      const ledY = walkY - 148;
      const rightGfx = scene.add.graphics();
      rightGfx.setDepth(5);
      const leftGfx = scene.add.graphics();
      leftGfx.setDepth(5);
      this.floorLEDs.set(id, {
        clusters: [
          { gfx: leftGfx, x: leftLedX, y: ledY },
          { gfx: rightGfx, x: rightLedX, y: ledY },
        ],
        dockY,
      });
    }
  }
}
