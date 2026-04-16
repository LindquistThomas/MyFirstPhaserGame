import * as Phaser from 'phaser';
import { ELEVATOR_SPEED } from '../config/gameConfig';

/**
 * Impossible-Mission-style rideable elevator.
 *
 * The player stands on the platform and presses Up / Down to move.
 * The elevator travels between registered floor stops and snaps
 * to the nearest stop when the player releases the controls.
 */
export class Elevator {
  public platform: Phaser.Physics.Arcade.Image;

  /** Visual cab walls drawn around the platform. */
  public cabGraphics: Phaser.GameObjects.Graphics;

  private scene: Phaser.Scene;
  private floorStops: Map<number, number> = new Map();
  private isMoving = false;
  private snapping = false;
  private currentFloor = 0;
  private direction: -1 | 0 | 1 = 0;

  /** Bounds for vertical travel. */
  private minY = 0;
  private maxY = 9999;

  /** Width / height of the visible cab frame. */
  private static readonly CAB_W = 160;
  private static readonly CAB_H = 172;
  /** Small extension below the platform (machinery base). */
  private static readonly CAB_BASE = 12;

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

  /** Call every frame with the player's up/down input. */
  ride(up: boolean, down: boolean): void {
    if (up && !down) {
      this.direction = -1;
      this.isMoving = true;
      this.snapping = false;
      this.scene.tweens.killTweensOf(this.platform);
      this.platform.setVelocityY(-ELEVATOR_SPEED);
    } else if (down && !up) {
      this.direction = 1;
      this.isMoving = true;
      this.snapping = false;
      this.scene.tweens.killTweensOf(this.platform);
      this.platform.setVelocityY(ELEVATOR_SPEED);
    } else {
      this.stopAndSnap();
    }

    // Clamp to shaft bounds — only block movement in the out-of-bounds direction
    if (this.platform.y <= this.minY && this.platform.body!.velocity.y < 0) {
      this.platform.y = this.minY;
      this.platform.setVelocityY(0);
    }
    if (this.platform.y >= this.maxY && this.platform.body!.velocity.y > 0) {
      this.platform.y = this.maxY;
      this.platform.setVelocityY(0);
    }
  }

  /** Snap to nearest floor stop when player releases controls. */
  private stopAndSnap(): void {
    this.platform.setVelocityY(0);
    this.direction = 0;

    // If a snap tween is already running, let it finish
    if (this.snapping) return;

    let bestId = this.currentFloor;
    let bestDist = Infinity;
    for (const [id, y] of this.floorStops) {
      const d = Math.abs(this.platform.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }

    // If close enough to a stop, tween-snap to it
    const snapY = this.floorStops.get(bestId)!;
    if (bestDist < 60 && bestDist > 1) {
      this.snapping = true;
      this.scene.tweens.add({
        targets: this.platform,
        y: snapY,
        duration: (bestDist / ELEVATOR_SPEED) * 1000,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.snapping = false;
          this.isMoving = false;
          this.currentFloor = bestId;
        },
      });
    } else {
      this.isMoving = false;
      this.currentFloor = bestId;
    }
  }

  /** Move to a specific floor via tween (for panel / programmatic use). */
  moveToFloor(floorId: number, onArrive?: (floor: number) => void): void {
    const targetY = this.floorStops.get(floorId);
    if (targetY === undefined) return;
    if (this.isMoving) return;

    this.isMoving = true;

    this.scene.tweens.add({
      targets: this.platform,
      y: targetY,
      duration: (Math.abs(this.platform.y - targetY) / ELEVATOR_SPEED) * 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.isMoving = false;
        this.currentFloor = floorId;
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
    return this.isMoving;
  }

  getY(): number {
    return this.platform.y;
  }
}
