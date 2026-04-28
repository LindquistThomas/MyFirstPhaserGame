/**
 * Thin orchestrator for the elevator scene's visual construction.
 * Coordinates calls to focused sibling modules:
 *
 *   - `./skyBackdrop`       — night sky, moon, stars
 *   - `./distantSkyline`    — far city silhouette
 *   - `./buildingFacade`    — outer-wall windows (parallax)
 *   - `./floorBackdrops`    — per-floor near-layer backdrops
 *   - `./shaftWalls`        — shaft structure, rooftop, machine room,
 *                             cable, LEDs, dust motes, shaft doors
 *   - `./platformTiles`     — hallway floor tiles + walkable strips
 *   - `./floorDecorations`  — lobby and per-floor decoration sprites
 *
 * The caller (`ElevatorScene`) owns collision groups; this class only builds
 * imagery and static physics bodies for walkable surfaces.
 */
import * as Phaser from 'phaser';
import { GAME_WIDTH, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { ElevatorShaftDoors } from './ElevatorShaftDoors';
import { ElevatorController } from './ElevatorController';
import { drawSkyBackdrop } from './skyBackdrop';
import { drawDistantSkyline } from './distantSkyline';
import { drawBuildingFacade, type BuildingFacadeHandle, type FacadeBand } from './buildingFacade';
import { drawFloorBackdrops, type FloorBackdropBand, type BlockedRange } from './floorBackdrops';
import { ProductDoorManager } from './ProductDoorManager';
import {
  drawShaftBackground,
  drawShaftCaps,
  drawRooftop,
  drawMachineRoom,
  drawShaftDustMotes,
  buildShaftDoors,
  buildShaftCable,
  buildShaftLEDs,
  type FloorLEDMap,
} from './shaftWalls';
import { buildPlatformTiles } from './platformTiles';
import { drawAllDecorations } from './floorDecorations';

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
  floorYPositions: Record<FloorId, number>;
  floorLabels: Record<number, string>;
}

/**
 * Orchestrates the elevator scene's visual scaffolding. Each concern is
 * delegated to a focused sibling module; this class stores only the
 * inter-frame mutable state that the scene queries on every update.
 */
export class ElevatorSceneLayout {
  readonly platforms: Phaser.Physics.Arcade.StaticGroup;
  readonly shaftDoors: ElevatorShaftDoors[] = [];
  private shaftCable?: Phaser.GameObjects.TileSprite;
  private facade?: BuildingFacadeHandle;
  private facadeLastCabY?: number;
  /** Y where the shaft cable anchors. Set in `build()` via `drawMachineRoom`. */
  private pulleyAnchorY = 0;
  private floorLEDs: FloorLEDMap = new Map();
  private geirBounds?: { x: number; y: number; width: number; height: number };
  private sofaBounds?: { x: number; y: number; width: number; height: number };
  private sofaSitPoint?: { x: number; y: number };
  private receptionBounds?: { x: number; y: number; width: number; height: number };
  private receptionistBubble?: Phaser.GameObjects.Container;
  private setClockSpeedFn?: (multiplier: number) => void;

  constructor(private readonly deps: ElevatorSceneLayoutDeps) {
    this.platforms = deps.scene.physics.add.staticGroup();
  }

  /** Build the entire elevator-scene visual scaffolding in order. */
  build(): void {
    this.pulleyAnchorY = this.deps.shaftExtent.top;
    this.createExteriorBackdrop();
    drawShaftBackground(this.deps.scene, this.deps);
    drawShaftCaps(this.deps.scene, this.deps);
    drawRooftop(this.deps.scene, this.deps);
    this.pulleyAnchorY = drawMachineRoom(this.deps.scene, this.deps);
    buildPlatformTiles(this.deps.scene, this.deps, this.platforms);
    const decor = drawAllDecorations(this.deps.scene, this.deps);
    this.geirBounds = decor.geirBounds;
    this.receptionBounds = decor.receptionBounds;
    this.receptionistBubble = decor.receptionistBubble;
    this.sofaBounds = decor.sofaBounds;
    this.sofaSitPoint = decor.sofaSitPoint;
    this.setClockSpeedFn = decor.setClockSpeed;
    this.shaftDoors.push(...buildShaftDoors(this.deps.scene, this.deps));
    this.shaftCable = buildShaftCable(this.deps.scene, this.pulleyAnchorY);
    this.floorLEDs = buildShaftLEDs(this.deps.scene, this.deps);
    drawShaftDustMotes(this.deps.scene, this.deps);
  }

  // ---------------------------------------------------------------------------
  // Exterior backdrop (sky + horizon glow + distant skyline + building facade)
  // ---------------------------------------------------------------------------

  private createExteriorBackdrop(): void {
    drawSkyBackdrop(this.deps.scene, {
      width: GAME_WIDTH,
      height: this.deps.scene.scale.height,
    });
    this.createHorizonGlow();
    this.createDistantSkyline();
    this.createBuildingFacade();
  }

  /**
   * Warm city-lights haze sitting directly behind the distant skyline.
   * Parallaxes with the skyline (scrollFactor 0, 0.35) and is painted
   * as a soft-edged horizontal band at the skyline baseline.
   */
  private createHorizonGlow(): void {
    const scene = this.deps.scene;
    const baselineY = this.deps.shaftExtent.top + 2;
    const glow = scene.add.graphics().setDepth(-16).setScrollFactor(0, 0.35);
    const bands: Array<{ yOffset: number; h: number; alpha: number }> = [
      { yOffset: -8,  h: 10, alpha: 0.28 },
      { yOffset: -28, h: 24, alpha: 0.14 },
      { yOffset: -56, h: 40, alpha: 0.06 },
    ];
    for (const b of bands) {
      glow.fillStyle(theme.color.sky.moonHalo, b.alpha);
      glow.fillRect(0, baselineY + b.yOffset, GAME_WIDTH, b.h);
    }
  }

  private createDistantSkyline(): void {
    drawDistantSkyline(this.deps.scene, {
      width: GAME_WIDTH,
      baselineY: this.deps.shaftExtent.top + 2,
    });
  }

  /**
   * Outer-building façade on both sides of the shaft. Parallaxes at 0.85× so
   * it reads as "behind" the shaft. Per-floor band seeds vary window patterns
   * while every band shares the same neutral wallColor to avoid parallax
   * misalignment artefacts.
   */
  private createBuildingFacade(): void {
    const sw = this.deps.shaftWidth;
    const cx = GAME_WIDTH / 2;
    const leftEdge = cx - sw / 2;
    const rightEdge = cx + sw / 2;
    const sides: [{ xLeft: number; xRight: number }, { xLeft: number; xRight: number }] = [
      { xLeft: 0, xRight: leftEdge - 12 },
      { xLeft: rightEdge + 12, xRight: GAME_WIDTH },
    ];

    const positions = this.deps.floorYPositions;
    const sorted = Object.entries(positions)
      .map(([id, y]) => ({ id: Number(id) as FloorId, y }))
      .sort((a, b) => a.y - b.y);
    const { top, bottom } = this.deps.shaftExtent;

    const wallColor = theme.color.bg.mid;
    const bands: FacadeBand[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const yTop = i === 0 ? top : sorted[i]!.y;
      const yBottom = i < sorted.length - 1 ? sorted[i + 1]!.y : bottom;
      bands.push({
        yTop,
        yBottom,
        wallColor,
        seed: 0xabc123 ^ (sorted[i]!.id * 0x9e3779b1),
      });
    }

    this.facade = drawBuildingFacade(this.deps.scene, {
      sides,
      bands,
      motionBudget: 110,
      motionSpeedMultiplier: 3.2,
    });

    this.createFloorBackdrops(sides, sorted, top, bottom);
  }

  /**
   * Per-floor themed near-layer backdrop (depth 0.5) locked to the real floor
   * slabs via scrollFactor 1. See `./floorBackdrops` for the full spec.
   */
  private createFloorBackdrops(
    sides: { xLeft: number; xRight: number }[],
    sortedFloors: { id: FloorId; y: number }[],
    shaftTop: number,
    shaftBottom: number,
  ): void {
    const left = sides[0];
    const right = sides[1];
    if (!left || !right) return;

    const bands: FloorBackdropBand[] = [];
    for (let i = 0; i < sortedFloors.length; i++) {
      const cur = sortedFloors[i];
      if (!cur) continue;
      const next = sortedFloors[i + 1];
      const yTop = i === 0 ? shaftTop : cur.y;
      const yBottom = next ? next.y : shaftBottom;
      bands.push({ floorId: cur.id, yTop, yBottom });
    }

    const DOOR_KEEPOUT_HALF_WIDTH = 60;
    const blockedRanges: BlockedRange[] = ProductDoorManager.doors.map((d) => ({
      xMin: d.x - DOOR_KEEPOUT_HALF_WIDTH,
      xMax: d.x + DOOR_KEEPOUT_HALF_WIDTH,
    }));

    drawFloorBackdrops(this.deps.scene, {
      sides: [left, right],
      bands,
      blockedRanges,
    });
  }

  // ---------------------------------------------------------------------------
  // Per-frame update methods (called by ElevatorScene.update)
  // ---------------------------------------------------------------------------

  updateShaftCable(controller: ElevatorController | undefined): void {
    if (!this.shaftCable || !controller) return;
    const cabTop = controller.elevator.getY() - 172;
    const h = Math.max(0, cabTop - this.pulleyAnchorY);
    this.shaftCable.setSize(4, h);
  }

  updateFacadeMotion(controller: ElevatorController | undefined, delta: number): void {
    if (!this.facade || !controller) return;
    const cabY = controller.elevator.getY();
    const dt = delta / 1000;
    const velocityY =
      this.facadeLastCabY === undefined || dt <= 0
        ? 0
        : (cabY - this.facadeLastCabY) / dt;
    this.facadeLastCabY = cabY;
    this.facade.updateMotion(delta, controller.isMoving ? velocityY : 0);
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

  // ---------------------------------------------------------------------------
  // Getters / setters queried by ElevatorScene / ElevatorZones
  // ---------------------------------------------------------------------------

  /** Y coordinate at which the shaft cable and twin cab cables anchor. */
  getPulleyAnchorY(): number {
    return this.pulleyAnchorY;
  }

  /**
   * World-space bounds of Geir Harald's pacing area on the F4 walkway.
   * Used by `ElevatorZones` to register the proximity zone.
   */
  getGeirBounds(): { x: number; y: number; width: number; height: number } | undefined {
    return this.geirBounds;
  }

  /**
   * World-space bounds of the reception desk proximity area. Consumed by
   * `ElevatorZones` to register the "Hello!" greeting zone.
   */
  getReceptionBounds(): { x: number; y: number; width: number; height: number } | undefined {
    return this.receptionBounds;
  }

  /** The receptionist's speech-bubble container — shown on zone:enter. */
  getReceptionistBubble(): Phaser.GameObjects.Container | undefined {
    return this.receptionistBubble;
  }

  /**
   * World-space bounds of the lobby sofa proximity area. Consumed by
   * `ElevatorZones` to register the "Press Enter to sit" zone.
   */
  getSofaBounds(): { x: number; y: number; width: number; height: number } | undefined {
    return this.sofaBounds;
  }

  /**
   * World-space point where the player stands while seated on the sofa.
   * Returns undefined if the sofa hasn't been placed.
   */
  getSofaSitPoint(): { x: number; y: number } | undefined {
    return this.sofaSitPoint;
  }

  /**
   * Adjust the lobby wall clock's virtual time speed. 1 = real time;
   * >1 fast-forwards (e.g. 10 = 10× faster).
   */
  setClockSpeed(multiplier: number): void {
    this.setClockSpeedFn?.(multiplier);
  }
}
