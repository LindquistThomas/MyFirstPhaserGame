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
  /**
   * Active coast-snap tween (rider released mid-shaft). Tracked so that a
   * fresh directional press can cancel it and return control to the rider
   * instead of locking them out for up to 400 ms.
   */
  private coastSnapTween?: Phaser.Tweens.Tween;
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

  /**
   * Y coordinate where the twin suspension cables terminate at the top of
   * the shaft (e.g. the pulley anchor inside a machine room). Defaults to
   * 0 for legacy setups; callers with a visible machine room should set
   * this via {@link setCableTopY} so the cables don't appear to extend
   * infinitely upward.
   */
  private cableTopY = 0;

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

  /**
   * Tell the cab where its twin suspension cables should terminate at the
   * top of the shaft. Typically the bottom tangent of the pulley wheel in
   * a visible machine room. Triggers a redraw so the change is visible on
   * the next frame even before the cab moves.
   */
  setCableTopY(y: number): void {
    this.cableTopY = y;
    this.drawCab();
  }

  /* ---- riding controls (called from scene update) ---- */

  /**
   * Per-frame drive step. `up`/`down` are the held-direction inputs; `deltaMs`
   * is the frame delta in milliseconds (from Phaser's update(time, delta)).
   */
  ride(up: boolean, down: boolean, deltaMs: number = 16.67): void {
    // Any tween-driven motion (e.g. moveToFloor) takes over, so skip ramping.
    // Exception: a coast-snap tween triggered by the rider letting go of
    // the controls is cancelled the moment they press a direction again,
    // so Up/Down is never swallowed for the remainder of the tween.
    if (this.snapping) {
      const wantDir: -1 | 0 | 1 = up && !down ? -1 : down && !up ? 1 : 0;
      if (wantDir !== 0 && this.coastSnapTween) {
        this.coastSnapTween.stop();
        this.coastSnapTween = undefined;
        this.snapping = false;
      } else {
        this.direction = this.velocity < 0 ? -1 : this.velocity > 0 ? 1 : 0;
        return;
      }
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

    // If coasting to a halt between floors, snap to the nearest stop —
    // but only when we're meaningfully off a stop. Without this guard,
    // tiny floating-point drift at a parked floor would schedule a
    // pointless tween every idle frame.
    if (wantDir === 0 && Math.abs(this.velocity) < 1) {
      this.velocity = 0;
      if (this.distanceToNearestStop() > 1) {
        this.snapToNearest();
      }
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
      this.coastSnapTween = this.scene.tweens.add({
        targets: this.platform,
        y: snapY,
        duration,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.snapping = false;
          this.coastSnapTween = undefined;
          this.currentFloor = bestId;
          this.platform.setVelocityY(0);
        },
      });
    } else {
      this.currentFloor = bestId;
      this.platform.setVelocityY(0);
    }
  }

  /** Distance (px) from the cab's current y to the nearest registered stop. */
  private distanceToNearestStop(): number {
    let best = Infinity;
    for (const y of this.floorStops.values()) {
      const d = Math.abs(this.platform.y - y);
      if (d < best) best = d;
    }
    return best;
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
    const cabLeft = px - hw;
    const cabRight = px + hw;
    const cabW = Elevator.CAB_W;

    // --- suspension cables running up the shaft from the top of the cab ---
    // Cables terminate at `cableTopY` (pulley / anchor), not infinitely up.
    // Clamp to above the cab so they never invert when the cab is parked
    // very close to the anchor point.
    const topY = Math.min(this.cableTopY, cabTop - 6);
    g.lineStyle(2, 0x1a1a26, 1);
    g.lineBetween(px - 26, cabTop - 6, px - 26, topY);
    g.lineBetween(px + 26, cabTop - 6, px + 26, topY);
    g.lineStyle(1, 0x55556a, 0.6);
    g.lineBetween(px - 25, cabTop - 6, px - 25, topY);
    g.lineBetween(px + 27, cabTop - 6, px + 27, topY);

    // --- exterior top: hoist beam where cables attach ---
    g.fillStyle(0x22222e, 1);
    g.fillRect(cabLeft - 4, cabTop - 8, cabW + 8, 8);
    g.fillStyle(0x3a3a48, 1);
    g.fillRect(cabLeft - 4, cabTop - 8, cabW + 8, 2);
    g.fillStyle(0x000000, 1);
    g.fillCircle(px - 26, cabTop - 4, 2);
    g.fillCircle(px + 26, cabTop - 4, 2);

    // --- INTERIOR (cutaway view: front wall removed) ---

    // Back wall — warm beige paneling
    g.fillStyle(0xc9b48a, 1);
    g.fillRect(cabLeft, cabTop, cabW, ch + base);

    // Subtle vertical wood grain on back wall
    g.lineStyle(1, 0xb09870, 0.35);
    for (let lx = cabLeft + 8; lx < cabRight; lx += 12) {
      g.lineBetween(lx, cabTop + 4, lx, py - 4);
    }

    // --- ceiling: dark trim + recessed light panel ---
    const ceilH = 14;
    g.fillStyle(0x2a2a36, 1);
    g.fillRect(cabLeft, cabTop, cabW, ceilH);
    // Light panel (warm glow)
    const lightInset = 18;
    g.fillStyle(0xfff4c2, 1);
    g.fillRect(cabLeft + lightInset, cabTop + 3, cabW - lightInset * 2, 7);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(cabLeft + lightInset + 2, cabTop + 4, cabW - lightInset * 2 - 4, 2);
    // Soft glow halo
    g.fillStyle(0xffeeaa, 0.18);
    g.fillRect(cabLeft + 4, cabTop + ceilH, cabW - 8, 10);

    // Ceiling trim shadow
    g.fillStyle(0x000000, 0.25);
    g.fillRect(cabLeft, cabTop + ceilH, cabW, 2);

    // --- floor indicator (small LED strip mounted on back wall) ---
    const indW = 38;
    const indH = 12;
    const indX = cabLeft + 10;
    const indY = cabTop + ceilH + 6;
    g.fillStyle(0x111118, 1);
    g.fillRect(indX, indY, indW, indH);
    g.lineStyle(1, 0x55556a, 1);
    g.strokeRect(indX, indY, indW, indH);
    // Visual floor number: sort floors bottom-first (highest Y = F0) so the
    // displayed digit matches the in-world stack position, not the FloorId.
    const sortedByYDesc = Array.from(this.floorStops.entries()).sort((a, b) => b[1] - a[1]);
    const visualFloorNum = sortedByYDesc.findIndex(([id]) => id === this.currentFloor);
    this.drawDigit(g, indX + 6, indY + 2, visualFloorNum >= 0 ? visualFloorNum : this.currentFloor, 0xff7733);
    // Direction arrow
    const arrowX = indX + indW - 10;
    const arrowCY = indY + indH / 2;
    if (this.direction === -1) {
      g.fillStyle(0x33ff66, 1);
      g.fillTriangle(arrowX, arrowCY - 4, arrowX - 4, arrowCY + 3, arrowX + 4, arrowCY + 3);
    } else if (this.direction === 1) {
      g.fillStyle(0x33ff66, 1);
      g.fillTriangle(arrowX, arrowCY + 4, arrowX - 4, arrowCY - 3, arrowX + 4, arrowCY - 3);
    } else {
      g.fillStyle(0x223322, 1);
      g.fillCircle(arrowX, arrowCY, 2);
    }

    // --- control panel (right side of back wall) with floor buttons ---
    const panelW = 22;
    const panelH = Math.min(78, ch - ceilH - 18);
    const panelX = cabRight - panelW - 8;
    const panelY = cabTop + ceilH + 6;
    g.fillStyle(0x33333f, 1);
    g.fillRect(panelX, panelY, panelW, panelH);
    g.lineStyle(1, 0x111118, 1);
    g.strokeRect(panelX, panelY, panelW, panelH);
    // Buttons stacked vertically — sort by Y position (ascending = top floor
    // first) so the highest physical floor appears at the top of the panel,
    // regardless of floor ID ordering.
    const floorIds = Array.from(this.floorStops.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
    const btnRadius = 4;
    const btnGap = panelH / (floorIds.length + 1);
    floorIds.forEach((id, i) => {
      const by = panelY + btnGap * (i + 1);
      const bx = panelX + panelW / 2;
      const lit = id === this.currentFloor;
      g.fillStyle(lit ? 0xffaa33 : 0x222230, 1);
      g.fillCircle(bx, by, btnRadius);
      g.lineStyle(1, lit ? 0xffeeaa : 0x55556a, 1);
      g.strokeCircle(bx, by, btnRadius);
      if (lit) {
        g.fillStyle(0xffffaa, 0.5);
        g.fillCircle(bx, by, btnRadius + 2);
        g.fillStyle(0xffaa33, 1);
        g.fillCircle(bx, by, btnRadius);
      }
    });

    // --- handrail along the back wall (left of control panel) ---
    const railY = py - 32;
    const railLeft = cabLeft + 10;
    const railRight = panelX - 6;
    g.lineStyle(3, 0x9a9aaa, 1);
    g.lineBetween(railLeft, railY, railRight, railY);
    g.lineStyle(1, 0xddddee, 1);
    g.lineBetween(railLeft, railY - 1, railRight, railY - 1);
    // Rail brackets
    g.fillStyle(0x55556a, 1);
    g.fillRect(railLeft - 2, railY - 1, 3, 5);
    g.fillRect(railRight - 1, railY - 1, 3, 5);

    // --- floor (tiled mat just above the platform) ---
    const floorY = py - 2;
    g.fillStyle(0x4a4a5a, 1);
    g.fillRect(cabLeft, floorY, cabW, 6);
    g.lineStyle(1, 0x22222a, 0.8);
    for (let tx = cabLeft + 16; tx < cabRight; tx += 16) {
      g.lineBetween(tx, floorY, tx, floorY + 6);
    }
    // Floor highlight line
    g.lineStyle(1, 0x6a6a7a, 0.7);
    g.lineBetween(cabLeft, floorY, cabRight, floorY);

    // --- side wall edges (thin so interior stays visible) ---
    g.fillStyle(0x2a2a36, 1);
    g.fillRect(cabLeft, cabTop + ceilH, 3, ch - ceilH + base);
    g.fillRect(cabRight - 3, cabTop + ceilH, 3, ch - ceilH + base);

    // --- machinery base below platform ---
    g.fillStyle(0x1f1f2a, 1);
    g.fillRect(cabLeft, py + 4, cabW, base - 2);
    g.fillStyle(0x6a6a82, 1);
    for (let rx = cabLeft + 10; rx < cabRight - 6; rx += 16) {
      g.fillCircle(rx, py + base - 3, 1.2);
    }

    // --- outer trim ---
    g.lineStyle(1, 0x111118, 1);
    g.strokeRect(cabLeft, cabTop, cabW, ch + base);
  }

  /** Pixelated 7-segment-style single digit (0-9). 8px wide, 8px tall. */
  private drawDigit(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    digit: number,
    color: number,
  ): void {
    const segs: Record<number, string[]> = {
      0: ['t', 'tl', 'tr', 'bl', 'br', 'b'],
      1: ['tr', 'br'],
      2: ['t', 'tr', 'm', 'bl', 'b'],
      3: ['t', 'tr', 'm', 'br', 'b'],
      4: ['tl', 'tr', 'm', 'br'],
      5: ['t', 'tl', 'm', 'br', 'b'],
      6: ['t', 'tl', 'm', 'bl', 'br', 'b'],
      7: ['t', 'tr', 'br'],
      8: ['t', 'tl', 'tr', 'm', 'bl', 'br', 'b'],
      9: ['t', 'tl', 'tr', 'm', 'br', 'b'],
    };
    const on = segs[digit] ?? segs[0] ?? [];
    g.fillStyle(color, 1);
    const w = 6, h = 8, t = 1;
    if (on.includes('t')) g.fillRect(x, y, w, t);
    if (on.includes('m')) g.fillRect(x, y + h / 2 - 0.5, w, t);
    if (on.includes('b')) g.fillRect(x, y + h - t, w, t);
    if (on.includes('tl')) g.fillRect(x, y, t, h / 2);
    if (on.includes('tr')) g.fillRect(x + w - t, y, t, h / 2);
    if (on.includes('bl')) g.fillRect(x, y + h / 2, t, h / 2);
    if (on.includes('br')) g.fillRect(x + w - t, y + h / 2, t, h / 2);
  }

  /* ---- getters ---- */

  getCurrentFloor(): number {
    return this.currentFloor;
  }

  /**
   * Set the docked-floor id without moving the cab. Used when the scene
   * initialises the elevator at a floor the player has just returned from —
   * without this, `currentFloor` defaults to 0 and the HUD reports the wrong
   * floor until the cab snaps somewhere.
   */
  setCurrentFloor(floorId: number): void {
    this.currentFloor = floorId;
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
