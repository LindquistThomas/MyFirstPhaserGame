import * as Phaser from 'phaser';
import { ELEVATOR_SPEED } from '../config/gameConfig';

/**
 * Impossible-Mission-style rideable elevator.
 *
 * The player stands on the platform and presses Up / Down to ride.
 * Movement uses smooth acceleration / deceleration; once the cab passes
 * a commit threshold while being driven in a direction, it auto-travels
 * to the next floor in that direction and docks there — even if the
 * player lets go of the controls. If the player releases before the
 * commit threshold is reached, the cab coasts to a stop and snaps to
 * the nearest floor.
 */
export class Elevator {
  public platform: Phaser.Physics.Arcade.Image;

  /** Visual cab walls drawn around the platform. */
  public cabGraphics: Phaser.GameObjects.Graphics;

  private scene: Phaser.Scene;
  private floorStops: Map<number, number> = new Map();
  private snapping = false;
  private currentFloor = 0;
  private direction: -1 | 0 | 1 = 0;

  /** Current velocity of the cab (px/s, separate from body.velocity so we can ramp). */
  private velocity = 0;
  /** Y-coord the cab is committed to reach (auto-dock). Null when free-riding. */
  private committedTargetY: number | null = null;
  private committedDir: -1 | 0 | 1 = 0;

  /** Bounds for vertical travel. */
  private minY = 0;
  private maxY = 9999;

  /** Width / height of the visible cab frame. */
  private static readonly CAB_W = 160;
  private static readonly CAB_H = 172;
  /** Small extension below the platform (machinery base). */
  private static readonly CAB_BASE = 12;

  /** Maximum travel speed in px/s. */
  private static readonly MAX_SPEED = ELEVATOR_SPEED;
  /** Acceleration while spinning up or reversing (px/s^2). */
  private static readonly ACCEL = 900;
  /** Deceleration while docking at a target floor (px/s^2). */
  private static readonly DECEL = 700;
  /** Coast deceleration when the rider lets go mid-shaft before committing. */
  private static readonly COAST_DECEL = 480;
  /**
   * Once the cab reaches this fraction of MAX_SPEED while being driven,
   * it auto-commits to riding to the next floor stop and docking.
   */
  private static readonly COMMIT_FRACTION = 0.6;

  constructor(scene: Phaser.Scene, x: number, startY: number) {
    this.scene = scene;

    this.platform = scene.physics.add.image(x, startY, 'elevator_platform');
    this.platform.setImmovable(true);
    (this.platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.platform.setDepth(3);

    // Cab frame (drawn each frame around the platform)
    this.cabGraphics = scene.add.graphics();
    this.cabGraphics.setDepth(2);
    this.drawCab();
  }

  /* ---- floor management ---- */

  addFloor(floorId: number, yPosition: number): void {
    this.floorStops.set(floorId, yPosition);
    this.recalcBounds();
  }

  private recalcBounds(): void {
    const ys = Array.from(this.floorStops.values());
    if (ys.length === 0) return;
    this.minY = Math.min(...ys);
    this.maxY = Math.max(...ys);
  }

  /* ---- riding controls (called from scene update) ---- */

  /**
   * Per-frame drive step. `up`/`down` are the held-direction inputs; `deltaMs`
   * is the frame delta in milliseconds (from Phaser's update(time, delta)).
   */
  ride(up: boolean, down: boolean, deltaMs: number = 16.67): void {
    // Any tween-driven motion (e.g. moveToFloor) takes over, so skip ramping.
    if (this.snapping) {
      this.direction = this.velocity < 0 ? -1 : this.velocity > 0 ? 1 : 0;
      return;
    }

    const dt = deltaMs / 1000;

    if (this.committedTargetY !== null) {
      // Allow the rider to cancel the auto-dock by firmly pressing the
      // opposite direction. This makes them "take over" the cab again.
      const reversing =
        (this.committedDir === -1 && down && !up)
        || (this.committedDir === 1 && up && !down);
      if (reversing) {
        this.committedTargetY = null;
        this.committedDir = 0;
      } else {
        this.driveCommitted(dt);
        this.applyVelocity();
        return;
      }
    }

    // --- free-ride mode ---
    const wantDir: -1 | 0 | 1 = up && !down ? -1 : down && !up ? 1 : 0;
    const targetVel = wantDir * Elevator.MAX_SPEED;
    const rate = wantDir === 0 ? Elevator.COAST_DECEL : Elevator.ACCEL;
    this.velocity = this.approach(this.velocity, targetVel, rate * dt);

    // Commit once the rider has pushed the cab past the threshold speed
    // in a consistent direction; from there it auto-docks at the next
    // floor stop in that direction.
    if (wantDir !== 0 && Math.abs(this.velocity) >= Elevator.MAX_SPEED * Elevator.COMMIT_FRACTION) {
      const nextStop = this.findNextStopInDirection(wantDir);
      if (nextStop !== null) {
        this.committedTargetY = nextStop;
        this.committedDir = wantDir;
      }
    }

    // If coasting to a halt between floors, snap to the nearest stop.
    if (wantDir === 0 && Math.abs(this.velocity) < 1) {
      this.velocity = 0;
      this.snapToNearest();
    }

    this.applyVelocity();
  }

  /** Drive the cab toward a committed floor target using a kinematic brake curve. */
  private driveCommitted(dt: number): void {
    const target = this.committedTargetY!;
    const dir = this.committedDir;
    const distance = (target - this.platform.y) * dir; // +ve while approaching

    if (distance <= 1 && Math.abs(this.velocity) < 8) {
      // Arrived — snap exactly onto the stop.
      this.platform.y = target;
      this.velocity = 0;
      this.committedTargetY = null;
      this.committedDir = 0;
      this.direction = 0;
      for (const [id, y] of this.floorStops) {
        if (Math.abs(y - target) < 0.5) this.currentFloor = id;
      }
      return;
    }

    // Speed we can have here and still brake to 0 at the target:
    //   v_brake = sqrt(2 * DECEL * distance)
    const vBrake = Math.sqrt(Math.max(0, 2 * Elevator.DECEL * Math.max(0, distance)));
    const cruise = Elevator.MAX_SPEED;
    const targetSpeed = Math.min(cruise, vBrake);
    const targetVel = dir * targetSpeed;

    // Accel toward target velocity (distinct rate for spinning up vs braking).
    const spinningUp = Math.abs(this.velocity) < Math.abs(targetVel);
    const rate = spinningUp ? Elevator.ACCEL : Elevator.DECEL;
    this.velocity = this.approach(this.velocity, targetVel, rate * dt);
    this.direction = dir;
  }

  /** Push the cab body with our ramped velocity and clamp at the shaft bounds. */
  private applyVelocity(): void {
    if (this.platform.y <= this.minY && this.velocity < 0) {
      this.platform.y = this.minY;
      this.velocity = 0;
      this.committedTargetY = null;
    }
    if (this.platform.y >= this.maxY && this.velocity > 0) {
      this.platform.y = this.maxY;
      this.velocity = 0;
      this.committedTargetY = null;
    }
    this.platform.setVelocityY(this.velocity);
    this.direction = this.velocity < 0 ? -1 : this.velocity > 0 ? 1 : 0;
  }

  private approach(current: number, target: number, maxStep: number): number {
    if (current === target) return current;
    const diff = target - current;
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
  }

  private findNextStopInDirection(dir: -1 | 1): number | null {
    let best: number | null = null;
    for (const y of this.floorStops.values()) {
      // A stop "in direction" must lie past the current position in that dir.
      if (dir === -1 && y < this.platform.y - 1) {
        if (best === null || y > best) best = y; // nearest above (highest y)
      } else if (dir === 1 && y > this.platform.y + 1) {
        if (best === null || y < best) best = y; // nearest below (lowest y)
      }
    }
    return best;
  }

  private snapToNearest(): void {
    let bestId = this.currentFloor;
    let bestDist = Infinity;
    for (const [id, y] of this.floorStops) {
      const d = Math.abs(this.platform.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }

    const snapY = this.floorStops.get(bestId)!;
    if (bestDist > 1) {
      this.snapping = true;
      const duration = Math.min((bestDist / Elevator.MAX_SPEED) * 1000, 400);
      this.scene.tweens.add({
        targets: this.platform,
        y: snapY,
        duration,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.snapping = false;
          this.currentFloor = bestId;
          this.platform.setVelocityY(0);
        },
      });
    } else {
      this.currentFloor = bestId;
      this.platform.setVelocityY(0);
    }
  }

  /** Move to a specific floor via tween (for panel / programmatic use). */
  moveToFloor(floorId: number, onArrive?: (floor: number) => void): void {
    const targetY = this.floorStops.get(floorId);
    if (targetY === undefined) return;
    if (this.snapping || this.committedTargetY !== null) return;

    this.snapping = true;
    this.velocity = 0;

    this.scene.tweens.add({
      targets: this.platform,
      y: targetY,
      duration: (Math.abs(this.platform.y - targetY) / Elevator.MAX_SPEED) * 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.snapping = false;
        this.currentFloor = floorId;
        this.platform.setVelocityY(0);
        if (onArrive) onArrive(this.currentFloor);
      },
    });
  }

  /* ---- visual update ---- */

  /** Redraw cab frame around the current platform position. Called in scene update(). */
  updateVisuals(): void {
    this.drawCab();
  }

  private drawCab(): void {
    const g = this.cabGraphics;
    g.clear();

    const px = this.platform.x;
    const py = this.platform.y;
    const hw = Elevator.CAB_W / 2;
    const ch = Elevator.CAB_H;
    const base = Elevator.CAB_BASE;

    const cabTop = py - ch;
    const cabBottom = py + base;
    const cabLeft = px - hw;
    const cabRight = px + hw;

    // --- suspension cables running up the shaft to the top of the world ---
    g.lineStyle(2, 0x222233, 0.9);
    g.lineBetween(px - 28, cabTop, px - 28, 0);
    g.lineBetween(px + 28, cabTop, px + 28, 0);
    g.lineStyle(1, 0x55556a, 0.6);
    g.lineBetween(px - 27, cabTop, px - 27, 0);
    g.lineBetween(px + 29, cabTop, px + 29, 0);

    // --- top header / hoist beam (where cables attach) ---
    g.fillStyle(0x2a2a36, 1);
    g.fillRect(cabLeft - 4, cabTop - 10, Elevator.CAB_W + 8, 10);
    g.fillStyle(0x444458, 1);
    g.fillRect(cabLeft - 4, cabTop - 10, Elevator.CAB_W + 8, 2);
    // Cable anchor bolts
    g.fillStyle(0x111118, 1);
    g.fillCircle(px - 28, cabTop - 5, 2);
    g.fillCircle(px + 28, cabTop - 5, 2);

    // --- cab outer frame (dark steel) ---
    g.fillStyle(0x1a1a24, 1);
    g.fillRect(cabLeft, cabTop, Elevator.CAB_W, ch + base);

    // --- side wall panels (metallic) ---
    const wallW = 18;
    this.drawMetalPanel(g, cabLeft + 2, cabTop + 2, wallW, ch + base - 4);
    this.drawMetalPanel(g, cabRight - wallW - 2, cabTop + 2, wallW, ch + base - 4);

    // --- ceiling (interior top) with light fixture ---
    const ceilTop = cabTop + 4;
    const ceilH = 14;
    g.fillStyle(0x2c2c3a, 1);
    g.fillRect(cabLeft + wallW + 2, ceilTop, Elevator.CAB_W - (wallW + 2) * 2, ceilH);
    // Light panel glow
    g.fillStyle(0xffffcc, 0.85);
    g.fillRect(px - 28, ceilTop + 4, 56, 5);
    g.fillStyle(0xffffaa, 0.35);
    g.fillRect(px - 36, ceilTop + 3, 72, 7);

    // --- floor indicator strip above the doors ---
    const indY = ceilTop + ceilH + 2;
    g.fillStyle(0x0a0a14, 1);
    g.fillRect(cabLeft + wallW + 2, indY, Elevator.CAB_W - (wallW + 2) * 2, 10);
    // Direction arrow (lit when moving)
    if (this.direction !== 0) {
      const ax = px;
      const ay = indY + 5;
      g.fillStyle(0xff8833, 1);
      if (this.direction === -1) {
        g.fillTriangle(ax, ay - 3, ax - 4, ay + 2, ax + 4, ay + 2);
      } else {
        g.fillTriangle(ax, ay + 3, ax - 4, ay - 2, ax + 4, ay - 2);
      }
    } else {
      // Idle dot
      g.fillStyle(0x335544, 1);
      g.fillCircle(px, indY + 5, 1.5);
    }

    // --- door area (between the side walls, below the indicator) ---
    const doorLeft = cabLeft + wallW + 2;
    const doorRight = cabRight - wallW - 2;
    const doorTop = indY + 12;
    const doorBottom = py - 1; // doors stop at the floor (platform top)
    const doorW = doorRight - doorLeft;
    const doorH = doorBottom - doorTop;
    const halfDoorW = doorW / 2;

    // Door recess shadow
    g.fillStyle(0x05050a, 1);
    g.fillRect(doorLeft - 1, doorTop - 1, doorW + 2, doorH + 2);

    // Two sliding doors meeting in the middle
    this.drawDoorPanel(g, doorLeft, doorTop, halfDoorW, doorH);
    this.drawDoorPanel(g, doorLeft + halfDoorW, doorTop, halfDoorW, doorH);

    // Center seam between doors
    g.lineStyle(1, 0x000000, 0.9);
    g.lineBetween(doorLeft + halfDoorW, doorTop, doorLeft + halfDoorW, doorBottom);

    // Door track (top)
    g.fillStyle(0x55556a, 1);
    g.fillRect(doorLeft, doorTop - 2, doorW, 2);
    // Door track (bottom — visible just above the platform)
    g.fillStyle(0x33333f, 1);
    g.fillRect(doorLeft, doorBottom, doorW, 2);

    // --- floor / platform plate (sits on top of platform sprite) ---
    g.fillStyle(0x3a3a48, 1);
    g.fillRect(cabLeft + 2, py + 2, Elevator.CAB_W - 4, 4);
    g.lineStyle(1, 0x55556a, 0.8);
    g.lineBetween(cabLeft + 2, py + 2, cabRight - 2, py + 2);

    // --- machinery base below the platform ---
    g.fillStyle(0x1f1f2a, 1);
    g.fillRect(cabLeft + 4, py + 6, Elevator.CAB_W - 8, base - 4);
    // Rivets along the base
    g.fillStyle(0x6a6a82, 1);
    for (let rx = cabLeft + 12; rx < cabRight - 8; rx += 16) {
      g.fillCircle(rx, py + base - 3, 1.2);
    }

    // --- outer trim highlight ---
    g.lineStyle(1, 0x6a6a82, 0.6);
    g.strokeRect(cabLeft, cabTop, Elevator.CAB_W, ch + base);
  }

  /** Brushed-metal panel with vertical highlight bands. */
  private drawMetalPanel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    g.fillStyle(0x4a4a5c, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x6a6a82, 0.6);
    g.fillRect(x + 2, y, 2, h);
    g.fillStyle(0x2a2a36, 0.8);
    g.fillRect(x + w - 3, y, 2, h);
    g.lineStyle(1, 0x33333f, 0.5);
    g.lineBetween(x, y + h * 0.5, x + w, y + h * 0.5);
  }

  /** A single sliding-door leaf with inset panel and a small porthole window. */
  private drawDoorPanel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // Door body
    g.fillStyle(0x3a4a5e, 1);
    g.fillRect(x, y, w, h);
    // Vertical brushed lines
    g.lineStyle(1, 0x4a5a72, 0.6);
    g.lineBetween(x + w * 0.25, y + 3, x + w * 0.25, y + h - 3);
    g.lineBetween(x + w * 0.75, y + 3, x + w * 0.75, y + h - 3);
    // Inset panel
    g.lineStyle(1, 0x1a2230, 0.9);
    g.strokeRect(x + 4, y + 6, w - 8, h - 16);
    // Small window near the top
    const winY = y + 14;
    const winH = Math.min(28, h * 0.25);
    g.fillStyle(0x88ccee, 0.75);
    g.fillRect(x + 7, winY, w - 14, winH);
    g.lineStyle(1, 0x223344, 1);
    g.strokeRect(x + 7, winY, w - 14, winH);
    // Window highlight
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(x + 9, winY + 2, w - 18, 3);
  }

  /* ---- getters ---- */

  getCurrentFloor(): number {
    return this.currentFloor;
  }

  /** Returns the floor id the elevator is currently stopped at, or null if between floors. */
  getFloorAtCurrentPosition(): number | null {
    for (const [id, y] of this.floorStops) {
      if (Math.abs(this.platform.y - y) < 12) return id;
    }
    return null;
  }

  getIsMoving(): boolean {
    return Math.abs(this.velocity) > 1 || this.snapping || this.committedTargetY !== null;
  }

  getY(): number {
    return this.platform.y;
  }
}
