export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 960;

/** Base tile size for 128×128 pixel-art style. */
export const TILE_SIZE = 128;

export const PLAYER_SPEED = 320;
export const PLAYER_JUMP_VELOCITY = -520;
export const PLAYER_GRAVITY = 900;

export const ELEVATOR_SPEED = 760;

// Colour tokens live in `src/style/theme.ts`; re-exported here under the
// historical `COLORS` name to keep older call sites working until the
// migration finishes. New code should import from `../style/theme`.
export { COLORS } from '../style/theme';

export const FLOORS = {
  LOBBY: 0,
  PLATFORM_TEAM: 1,
  BUSINESS: 3,
  EXECUTIVE: 4,
  PRODUCTS: 5,
  BOSS: 6,
} as const;

export type FloorId = typeof FLOORS[keyof typeof FLOORS];
