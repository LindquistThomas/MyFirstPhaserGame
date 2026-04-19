import * as Phaser from 'phaser';
import { GAME_WIDTH } from '../../config/gameConfig';

/**
 * Side-view landing doorways at one floor of the elevator shaft.
 *
 * Viewed from the side, the two "doors" read as rectangular openings cut
 * into the shaft walls at the walking surface — one on the left wall, one
 * on the right. When closed they are filled with a steel door panel that
 * matches the surrounding wall. When the cab docks at this floor, the
 * panel retracts upward into a header slot above the opening, revealing
 * the dark passage the player then walks through.
 *
 * The controller animates `openAmount` toward 1 (open) when the cab's
 * platform Y is within `PROXIMITY` of this floor's dock Y, and toward 0
 * otherwise.
 */
export class ElevatorShaftDoors {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly leftX: number;
  private readonly rightX: number;
  private readonly openingTop: number;
  private readonly openingBottom: number;

  /** 0 = fully closed, 1 = fully open. */
  private openAmount = 0;
  private target = 0;

  private static readonly OPENING_WIDTH = 48;
  private static readonly OPENING_HEIGHT = 132;
  /** Cab must be within this Y distance of dock to open. */
  private static readonly PROXIMITY = 28;
  /** Open/close speed, amount-per-ms. */
  private static readonly RATE = 1 / 350;

  constructor(
    scene: Phaser.Scene,
    shaftLeftEdge: number,
    shaftRightEdge: number,
    walkY: number,
    private readonly dockY: number,
  ) {
    // Place the left doorway straddling the left shaft wall; same on right.
    this.leftX = shaftLeftEdge;
    this.rightX = shaftRightEdge;
    this.openingBottom = walkY;
    this.openingTop = walkY - ElevatorShaftDoors.OPENING_HEIGHT;

    // Depth 2.5: above the concrete back wall + steel pillars (depth 0/1)
    // AND above the hallway floor tiles (depth 2) so the doorway frame and
    // panel are always visible on both sides. Still below the cab (depth
    // 3/4) so doors don't appear in front of the cab when it's adjacent.
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(2.5);
    this.draw();
  }

  update(cabY: number, deltaMs: number): void {
    const dist = Math.abs(cabY - this.dockY);
    this.target = dist < ElevatorShaftDoors.PROXIMITY ? 1 : 0;

    const step = ElevatorShaftDoors.RATE * deltaMs;
    if (this.openAmount < this.target) {
      this.openAmount = Math.min(this.target, this.openAmount + step);
    } else if (this.openAmount > this.target) {
      this.openAmount = Math.max(this.target, this.openAmount - step);
    }

    this.draw();
  }

  destroy(): void {
    this.gfx.destroy();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    this.drawOpening(g, this.leftX);
    this.drawOpening(g, this.rightX);
  }

  /** Draw a single doorway (opening + header slot + retractable panel) at centerX. */
  private drawOpening(g: Phaser.GameObjects.Graphics, centerX: number): void {
    const w = ElevatorShaftDoors.OPENING_WIDTH;
    const h = ElevatorShaftDoors.OPENING_HEIGHT;
    const x = centerX - w / 2;
    const yTop = this.openingTop;
    const yBot = this.openingBottom;

    // 1) The passage cavity (visible when the panel is retracted). Tinted
    //    slightly darker than the hallway background so the opening reads
    //    as "hallway interior behind the shaft wall" — a subtle depth cue
    //    rather than a near-black hole. Clip so it doesn't spill outside
    //    the shaft/hallway boundaries (the GAME_WIDTH edges).
    const cavityX = Math.max(0, x);
    const cavityRight = Math.min(GAME_WIDTH, x + w);
    g.fillStyle(0x12121f, 1);
    g.fillRect(cavityX, yTop, cavityRight - cavityX, h);

    // 2) Header slot above the opening (where the door retracts into).
    const headerH = 8;
    g.fillStyle(0x15151c, 1);
    g.fillRect(cavityX, yTop - headerH, cavityRight - cavityX, headerH);

    // 3) Retracting door panel — slides up into the header as openAmount
    //    grows. At openAmount=0 it covers the full opening; at 1 it's fully
    //    lifted above the opening top.
    const panelH = h;
    const panelY = yTop + panelH * (1 - this.openAmount) - panelH;
    // Clip panel so the visible portion is only what still overlaps the
    // cavity (the rest has "slid up" behind the header).
    const visibleTop = Math.max(panelY, yTop);
    const visibleBottom = Math.min(panelY + panelH, yBot);
    if (visibleBottom > visibleTop) {
      this.drawDoorPanel(g, cavityX, visibleTop, cavityRight - cavityX, visibleBottom - visibleTop);
    }

    // 4) Door frame (thin steel trim around the opening — always visible).
    g.lineStyle(2, 0x55606e, 1);
    g.strokeRect(cavityX, yTop, cavityRight - cavityX, h);
    // Frame highlight
    g.lineStyle(1, 0x88909c, 0.8);
    g.lineBetween(cavityX + 1, yTop + 1, cavityX + 1, yBot - 1);
    // Header lip (bottom edge of the retracted-door pocket)
    g.fillStyle(0x3a3a48, 1);
    g.fillRect(cavityX - 1, yTop - 2, (cavityRight - cavityX) + 2, 2);
    g.fillStyle(0x6a6a82, 1);
    g.fillRect(cavityX - 1, yTop - 2, (cavityRight - cavityX) + 2, 1);

    // 5) Threshold plate flush with the walking surface.
    g.fillStyle(0x6a6a82, 1);
    g.fillRect(cavityX - 2, yBot - 1, (cavityRight - cavityX) + 4, 2);
    g.lineStyle(1, 0x33333f, 1);
    for (let gx = cavityX; gx < cavityRight; gx += 6) {
      g.lineBetween(gx, yBot - 1, gx, yBot);
    }
  }

  /** Brushed-steel door panel fill. */
  private drawDoorPanel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (w <= 0 || h <= 0) return;
    // Base
    g.fillStyle(0x7a8494, 1);
    g.fillRect(x, y, w, h);
    // Highlight column
    g.fillStyle(0x9aa2b2, 0.85);
    g.fillRect(x + 3, y, 2, h);
    // Shadow column
    g.fillStyle(0x3a4250, 0.7);
    g.fillRect(x + w - 4, y, 2, h);
    // Brushed grain
    g.lineStyle(1, 0x6a7484, 0.45);
    for (let gx = x + 7; gx < x + w - 3; gx += 5) {
      g.lineBetween(gx, y + 2, gx, y + h - 2);
    }
    // Subtle inset panel outline (only if enough room vertically)
    if (h > 24) {
      g.lineStyle(1, 0x2a3240, 0.7);
      g.strokeRect(x + 5, y + 6, w - 10, h - 12);
    }
  }
}

