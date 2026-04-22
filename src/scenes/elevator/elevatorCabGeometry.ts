/**
 * Pure cab geometry — intentionally isolated from Phaser so it can be unit
 * tested without booting the renderer. Used by `ElevatorController`.
 */

const ELEVATOR_STEP_OUT_X_MARGIN = 12;
const ELEVATOR_CAB_HALF_WIDTH = 70;

/**
 * Pure geometry for clamping a rider onto the cab when they request to
 * move (Up/Down). Walking onto a docked cab at PLAYER_SPEED carries enough
 * horizontal momentum to cross the unmount threshold within a frame; this
 * clamp commits the rider so Up/Down actually leave the floor.
 */
export function clampRiderToCab(playerX: number, platformX: number): {
  x: number;
  moved: boolean;
} {
  const left = platformX - ELEVATOR_CAB_HALF_WIDTH + ELEVATOR_STEP_OUT_X_MARGIN;
  const right = platformX + ELEVATOR_CAB_HALF_WIDTH - ELEVATOR_STEP_OUT_X_MARGIN;
  const clamped = Math.min(Math.max(playerX, left), right);
  return { x: clamped, moved: clamped !== playerX };
}
