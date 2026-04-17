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
    const totalH = ch + base;

    // Cab background (dark interior) — extends above and below platform
    g.fillStyle(0x0a0a1e, 0.85);
    g.fillRect(px - hw, py - ch, Elevator.CAB_W, totalH);

    // Side rails (bright cyan, Impossible-Mission-style) — full height
    g.fillStyle(0x00aaff, 0.9);
    g.fillRect(px - hw, py - ch, 6, totalH);
    g.fillRect(px + hw - 6, py - ch, 6, totalH);

    // Top bar
    g.fillStyle(0x00aaff, 0.9);
    g.fillRect(px - hw, py - ch, Elevator.CAB_W, 6);

    // Bottom bar (machinery base)
    g.fillStyle(0x006699, 0.8);
    g.fillRect(px - hw, py + base - 4, Elevator.CAB_W, 4);

    // Inner highlight lines — full height
    g.lineStyle(1, 0x005588, 0.5);
    g.lineBetween(px - hw + 10, py - ch + 10, px - hw + 10, py + base);
    g.lineBetween(px + hw - 10, py - ch + 10, px + hw - 10, py + base);
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
