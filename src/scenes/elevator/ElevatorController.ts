import * as Phaser from 'phaser';
import { eventBus } from '../../systems/EventBus';
import { Player } from '../../entities/Player';
import { Elevator } from '../../entities/Elevator';
import { clampRiderToCab } from './elevatorCabGeometry';

// Cab half-width (80) minus the walkway-overlap strip (WALK_OVERLAP = 4
// in ElevatorSceneLayout), so the latch only engages when the player is
// actually inside the cab, not merely standing on the overlap strip that
// extends 4 px into the shaft from each side.
const ELEVATOR_STAND_X_TOLERANCE = 76;
const ELEVATOR_STAND_Y_MIN = -16;
const ELEVATOR_STAND_Y_MAX = 24;
const ELEVATOR_PLAT_HW = 80;

/**
 * Owns the scene's elevator entity and the per-frame ride logic.
 *
 * Encapsulates the sticky "on-elevator" state, cab constraints while
 * between floors, and music-cue emission when the cab starts/stops.
 * Constructed by ElevatorScene in `create()` after the player exists.
 */
export class ElevatorController {
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

    // Pin the player to the platform AFTER Phaser has stepped the physics
    // bodies for this frame. Pinning in the scene's update() (which runs
    // BEFORE the physics step) leaves the player trailing the cab by one
    // frame of velocity*dt and shows as visible jitter while riding.
    const postUpdate = () => this.postUpdatePin();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, postUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, postUpdate);
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
    delta: number = 16.67,
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

      // When the rider requests to move the cab, commit them to the ride:
      // kill residual walk momentum and clamp them onto the cab. Without
      // this, walking onto the cab at PLAYER_SPEED carries the player
      // past the docked-floor unmount threshold (dx > PLAT_HW + 10)
      // before the cab leaves the floor, so Up/Down appear to do nothing.
      if (up || down) {
        const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(0);
        const { x } = clampRiderToCab(this.player.sprite.x, this.elevator.platform.x);
        this.player.sprite.setX(x);
      }

      this.elevator.ride(up, down, delta);
      this.constrainPlayerToCab();
      // Match velocity so the physics integration step keeps the player
      // and platform in sync within this frame; precise Y alignment is
      // then enforced by postUpdatePin() after the step.
      const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
      playerBody.setVelocityY((this.elevator.platform.body as Phaser.Physics.Arcade.Body).velocity.y);
    } else {
      this.elevator.ride(false, false, delta);
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

  /** Synchronous query used by ElevatorScene.checkFloorEntry to exclude shaft pixels. */
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
    const { x: clampedX, moved } = clampRiderToCab(this.player.sprite.x, this.elevator.platform.x);

    if (moved) {
      this.player.sprite.setX(clampedX);
      body.setVelocityX(0);
    }
  }

  /**
   * Post-physics-step pin. Runs after Phaser has moved both the elevator
   * platform and the player body for this frame, so we can align the
   * player to the cab's actual (post-step) position with zero lag.
   */
  private postUpdatePin(): void {
    if (!this.playerOnElevator) return;
    const platBody = this.elevator.platform.body as Phaser.Physics.Arcade.Body;
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    // Place the player's feet exactly on top of the platform body.
    const targetY = platBody.y - playerBody.offset.y - playerBody.height + this.player.sprite.displayOriginY;
    this.player.sprite.setY(targetY);
    // Zero out any residual vy (e.g. from a landing frame the moment
    // before mounting) and keep the player in lock-step with the cab's
    // post-step velocity so the next physics tick doesn't flick them
    // off the platform for a single frame.
    playerBody.setVelocityY(platBody.velocity.y);
    playerBody.updateFromGameObject();
  }
}
