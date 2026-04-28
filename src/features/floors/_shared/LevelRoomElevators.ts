import * as Phaser from 'phaser';
import { Player } from '../../../entities/Player';
import { ElevatorButtons } from '../../../ui/ElevatorButtons';
import { DialogController } from '../../../ui/DialogController';
import { theme } from '../../../style/theme';
import type { LevelConfig } from './LevelScene';

/**
 * Room-lift speed in px/s. Slower than the main cab's `ELEVATOR_SPEED`
 * (760) because room lifts travel short distances — a slower ride makes
 * the rider reliably stick to the platform (gravity can't outpace the
 * descent) and keeps the per-frame overshoot inside the clamp tolerance.
 */
const ROOM_LIFT_SPEED = 400;
const ROOM_LIFT_RETURN_EPSILON = 1;

/** Extra px added above `minY` so the platform sprite (12 px tall, centre-
 *  origin) stays fully inside the shaft graphic when parked at the top. */
const SHAFT_TOP_PAD = 16;

interface RoomLift {
  platform: Phaser.Physics.Arcade.Image;
  shaft: Phaser.GameObjects.Graphics;
  minY: number;
  maxY: number;
}

export interface RoomElevatorsDeps {
  scene: Phaser.Scene;
  player: Player;
  /** Used to pause the rider-pin while a dialog is open. */
  dialogs: DialogController;
}

/**
 * Manages in-room elevators: shaft graphics, platform physics, player↔lift
 * colliders, per-frame movement, and the post-update rider pin.
 *
 * Extracted from {@link LevelScene} so the 80+ lines of elevator wiring live
 * in one focused class, parallel to `LevelEnemySpawner`, `LevelTokenManager`,
 * and the other level-helper modules.
 *
 * Usage inside `LevelScene.create()`:
 * ```ts
 * this.roomElevators = new LevelRoomElevators({ scene, player, dialogs });
 * this.roomElevators.build(cfg);       // create shaft + platform objects
 * this.roomElevators.wireColliders();  // attach player↔platform colliders
 * // …then call this.roomElevators.update() from the scene's update() loop.
 * ```
 */
export class LevelRoomElevators {
  private readonly lifts: RoomLift[] = [];
  private activeIndex = -1;
  private readonly liftButtons: ElevatorButtons;

  constructor(private readonly deps: RoomElevatorsDeps) {
    this.liftButtons = new ElevatorButtons(deps.scene, 48);
  }

  /**
   * Build shaft graphics and elevator platform bodies from the level config.
   * Registers the POST_UPDATE pin handler when at least one lift exists.
   * Safe to call with an empty `roomElevators` array.
   */
  build(config: LevelConfig): void {
    const scene = this.deps.scene;

    for (const re of config.roomElevators) {
      const shaft = scene.add.graphics().setDepth(1);
      const shaftW = 80;
      // Extend shaft upward past `minY` so the platform sprite (centre-
      // origin, ~12 px tall) sits fully inside the black background when
      // parked at the top. Otherwise the platform's top edge pokes above.
      const topY = re.minY - SHAFT_TOP_PAD;
      const bottomY = re.maxY + 16;
      shaft.fillStyle(theme.color.bg.overlay, 0.85);
      shaft.fillRect(re.x - shaftW / 2, topY, shaftW, bottomY - topY);
      shaft.lineStyle(2, theme.color.ui.border, 0.5);
      shaft.lineBetween(re.x - shaftW / 2, topY, re.x - shaftW / 2, bottomY);
      shaft.lineBetween(re.x + shaftW / 2, topY, re.x + shaftW / 2, bottomY);

      const plat = scene.physics.add.image(re.x, re.startY, 'room_elevator_platform');
      plat.setImmovable(true);
      (plat.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      plat.setDepth(3);

      this.lifts.push({ platform: plat, shaft, minY: re.minY, maxY: re.maxY });
    }

    // Pin the active rider to the lift AFTER Phaser has stepped physics
    // for this frame — mirrors `ElevatorController.postUpdatePin()` so
    // the player follows the lift with zero lag and gravity can't pull
    // them off the platform while descending.
    if (this.lifts.length > 0) {
      const onPost = () => this.postUpdatePin();
      scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onPost);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onPost);
      });
    }
  }

  /**
   * Wire player↔platform colliders. Call after `build()`, once the player
   * sprite exists.
   */
  wireColliders(): void {
    const scene = this.deps.scene;
    for (let i = 0; i < this.lifts.length; i++) {
      const idx = i;
      scene.physics.add.collider(this.deps.player.sprite, this.lifts[i]!.platform, () => {
        this.activeIndex = idx;
      });
    }
  }

  /** Per-frame update. Call from the scene's `update()` loop. */
  update(): void {
    if (this.lifts.length === 0) return;
    this.updateRoomElevators();
  }

  /**
   * Post-physics-step rider pin. Runs after Phaser has moved both the lift
   * platform and the player body this frame, so we can align the player's
   * feet to the platform's actual (post-step) position with zero lag.
   */
  private postUpdatePin(): void {
    if (this.activeIndex < 0) return;
    if (this.deps.dialogs.isOpen) return;
    const lift = this.lifts[this.activeIndex]!;
    const platBody = lift.platform.body as Phaser.Physics.Arcade.Body;
    const playerBody = this.deps.player.sprite.body as Phaser.Physics.Arcade.Body;
    const targetY = platBody.y - playerBody.offset.y - playerBody.height
      + this.deps.player.sprite.displayOriginY;
    this.deps.player.sprite.setY(targetY);
    playerBody.updateFromGameObject();
  }

  private updateRoomElevators(): void {
    const { player, scene } = this.deps;
    const body = player.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    // player.update() runs just before this and consumes `justPressed('Jump')`
    // to set body.velocity.y = PLAYER_JUMP_VELOCITY (−520). Detect a jump by
    // looking for a vy more negative than a lift can produce (ROOM_LIFT_SPEED
    // is 400), so a lift ascending at −400 isn't mistaken for a jump. Release
    // the lift and bail out so the velocity sync at the end doesn't stomp
    // the jump impulse. postUpdatePin() early-outs once activeIndex is -1.
    if (this.activeIndex >= 0 && body.velocity.y < -(ROOM_LIFT_SPEED + 20)) {
      for (const lift of this.lifts) lift.platform.setVelocityY(0);
      this.activeIndex = -1;
      this.liftButtons.setVisible(false);
      return;
    }

    let onLift = false;
    if (onGround) {
      for (let i = 0; i < this.lifts.length; i++) {
        const lift = this.lifts[i]!;
        const dx = Math.abs(player.sprite.x - lift.platform.x);
        const dy = player.sprite.y + body.halfHeight - lift.platform.y;
        // Widened tolerance (was [-4, 12]) so a fast descent doesn't
        // momentarily separate the player from the platform and stop
        // the ride. postUpdatePin() re-snaps them each frame.
        if (dx < 50 && dy >= -6 && dy <= 28) {
          this.activeIndex = i;
          onLift = true;
          break;
        }
      }
    }

    // Lift buttons are a gameplay mechanic (riding in-room lifts), not a
    // content zone, so visibility is set directly from physics state here.
    this.liftButtons.setVisible(onLift);

    if (!onLift) {
      this.activeIndex = -1;
      for (const lift of this.lifts) {
        this.returnIdleLiftToBase(lift);
      }
      return;
    }

    const inputs = scene.inputs;
    const lift = this.lifts[this.activeIndex]!;
    const btnState = this.liftButtons.getState();
    const up = inputs.isDown('MoveUp') || (btnState?.up ?? false);
    const down = inputs.isDown('MoveDown') || (btnState?.down ?? false);

    if (up) {
      lift.platform.setVelocityY(-ROOM_LIFT_SPEED);
    } else if (down) {
      lift.platform.setVelocityY(ROOM_LIFT_SPEED);
    } else {
      lift.platform.setVelocityY(0);
    }

    // Directional clamp — only zero velocity when moving OUTWARD past the
    // bound. Clamping unconditionally (as before) blocked re-entry after
    // touching a bound; this mirrors `Elevator.applyVelocity` on the main
    // cab. Also clamp the position the same frame to absorb the overshoot
    // produced by velocity integration at ROOM_LIFT_SPEED.
    const vy = (lift.platform.body as Phaser.Physics.Arcade.Body).velocity.y;
    if (lift.platform.y <= lift.minY && vy < 0) {
      lift.platform.y = lift.minY;
      lift.platform.setVelocityY(0);
    } else if (lift.platform.y >= lift.maxY && vy > 0) {
      lift.platform.y = lift.maxY;
      lift.platform.setVelocityY(0);
    }

    // Match the player's vertical velocity to the lift so the physics step
    // keeps them together within this frame; postUpdatePin() then pins them
    // to the lift's top with zero lag.
    body.setVelocityY(
      (lift.platform.body as Phaser.Physics.Arcade.Body).velocity.y,
    );
  }

  private returnIdleLiftToBase(lift: RoomLift): void {
    if (lift.platform.y >= lift.maxY - ROOM_LIFT_RETURN_EPSILON) {
      lift.platform.y = lift.maxY;
      lift.platform.setVelocityY(0);
      return;
    }

    lift.platform.setVelocityY(ROOM_LIFT_SPEED);
  }
}
