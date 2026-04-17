import * as Phaser from 'phaser';
import { eventBus } from '../../systems/EventBus';
import { Player } from '../../entities/Player';
import { Elevator } from '../../entities/Elevator';

const ELEVATOR_STEP_OUT_X_MARGIN = 12;
const ELEVATOR_STAND_X_TOLERANCE = 96;
const ELEVATOR_STAND_Y_MIN = -16;
const ELEVATOR_STAND_Y_MAX = 24;
const ELEVATOR_CAB_HALF_WIDTH = 70;
const ELEVATOR_PLAT_HW = 80;

/**
 * Owns the hub's elevator entity and the per-frame ride logic.
 *
 * Encapsulates the sticky "on-elevator" state, cab constraints while
 * between floors, and music-cue emission when the cab starts/stops.
 * Constructed by HubScene in `create()` after the player exists.
 */
export class HubElevatorController {
  readonly elevator: Elevator;
  /** Half-width of the elevator platform physics body (for floor-entry checks). */
  static readonly PLATFORM_HALF_WIDTH = ELEVATOR_PLAT_HW;

  private readonly scene: Phaser.Scene;
  private readonly player: Player;

  private playerOnElevator = false;
  private wasElevatorMoving = false;

  constructor(scene: Phaser.Scene, player: Player, elevator: Elevator) {
    this.scene = scene;
    this.player = player;
    this.elevator = elevator;

    scene.physics.add.collider(player.sprite, elevator.platform, () => {
      this.playerOnElevator = true;
    });
  }

  /** Is the player currently locked to the elevator cab? */
  get isOnElevator(): boolean {
    return this.playerOnElevator;
  }

  get isMoving(): boolean {
    return this.elevator.getIsMoving();
  }

  /**
   * Per-frame update: refresh the sticky mount/dismount state, drive the
   * elevator with input, pin the player to the cab while riding, and emit
   * music cues on ride-start / ride-stop.
   */
  update(
    input: { up: boolean; down: boolean },
    buttonState: { up: boolean; down: boolean } | undefined,
  ): void {
    // Sticky state: latch on when the player steps onto the cab; release only
    // at a docked floor when they walk outside the cab bounds.
    if (!this.playerOnElevator) {
      this.playerOnElevator = this.isStandingOnElevator();
    } else {
      const atFloor = this.elevator.getFloorAtCurrentPosition() !== null;
      if (atFloor) {
        const dx = Math.abs(this.player.sprite.x - this.elevator.platform.x);
        if (dx > ELEVATOR_PLAT_HW + 10) {
          this.playerOnElevator = false;
        }
      }
    }

    // Disable flips while riding — prevents escaping the cab.
    this.player.setFlipEnabled(!this.playerOnElevator);

    if (this.playerOnElevator) {
      const up = input.up || (buttonState?.up ?? false);
      const down = input.down || (buttonState?.down ?? false);
      this.elevator.ride(up, down);
      this.constrainPlayerToCab();
      this.pinPlayerToPlatform();
    } else {
      this.elevator.ride(false, false);
    }

    const moving = this.elevator.getIsMoving();
    if (moving && !this.wasElevatorMoving) {
      eventBus.emit('music:play', 'music_elevator_ride');
    } else if (!moving && this.wasElevatorMoving) {
      eventBus.emit('music:play', 'music_elevator_jazz');
    }
    this.wasElevatorMoving = moving;

    this.elevator.updateVisuals();
  }

  /** Synchronous query used by HubScene.checkFloorEntry to exclude shaft pixels. */
  getPlatformX(): number {
    return this.elevator.platform.x;
  }

  private isStandingOnElevator(): boolean {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (!onGround) return false;

    const dx = Math.abs(this.player.sprite.x - this.elevator.platform.x);
    const dy = body.bottom - this.elevator.platform.y;
    return (
      dx < ELEVATOR_STAND_X_TOLERANCE
      && dy >= ELEVATOR_STAND_Y_MIN
      && dy <= ELEVATOR_STAND_Y_MAX
    );
  }

  private constrainPlayerToCab(): void {
    if (this.elevator.getFloorAtCurrentPosition() !== null) return;

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const left = this.elevator.platform.x - ELEVATOR_CAB_HALF_WIDTH + ELEVATOR_STEP_OUT_X_MARGIN;
    const right = this.elevator.platform.x + ELEVATOR_CAB_HALF_WIDTH - ELEVATOR_STEP_OUT_X_MARGIN;
    const clampedX = Phaser.Math.Clamp(this.player.sprite.x, left, right);

    if (clampedX !== this.player.sprite.x) {
      this.player.sprite.setX(clampedX);
      body.setVelocityX(0);
    }
  }

  private pinPlayerToPlatform(): void {
    const platBody = this.elevator.platform.body as Phaser.Physics.Arcade.Body;
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const targetY = platBody.y - playerBody.offset.y - playerBody.height + this.player.sprite.displayOriginY;
    this.player.sprite.setY(targetY);
    playerBody.setVelocityY(platBody.velocity.y);
  }
}
