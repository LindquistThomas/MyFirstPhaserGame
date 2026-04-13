import * as Phaser from 'phaser';
import { ELEVATOR_SPEED } from '../config/gameConfig';

export class Elevator {
  public platform: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private floorPositions: Map<number, number> = new Map();
  private targetY: number;
  private isMoving = false;
  private currentFloor = 0;
  private onArriveCallback?: (floor: number) => void;

  constructor(scene: Phaser.Scene, x: number, startY: number) {
    this.scene = scene;
    this.targetY = startY;

    this.platform = scene.physics.add.image(x, startY, 'elevator_platform');
    this.platform.setImmovable(true);
    (this.platform.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.platform.setDepth(3);
  }

  addFloor(floorId: number, yPosition: number): void {
    this.floorPositions.set(floorId, yPosition);
  }

  moveToFloor(floorId: number, onArrive?: (floor: number) => void): void {
    const targetY = this.floorPositions.get(floorId);
    if (targetY === undefined) return;
    if (this.isMoving) return;

    this.isMoving = true;
    this.targetY = targetY;
    this.currentFloor = floorId;
    this.onArriveCallback = onArrive;

    this.scene.tweens.add({
      targets: this.platform,
      y: targetY,
      duration: Math.abs(this.platform.y - targetY) / ELEVATOR_SPEED * 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.isMoving = false;
        if (this.onArriveCallback) {
          this.onArriveCallback(this.currentFloor);
        }
      },
    });
  }

  getCurrentFloor(): number {
    return this.currentFloor;
  }

  getIsMoving(): boolean {
    return this.isMoving;
  }

  getY(): number {
    return this.platform.y;
  }
}
