export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 960;

/** Base tile size for 128×128 pixel-art style. */
export const TILE_SIZE = 128;

export const PLAYER_SPEED = 280;
export const PLAYER_JUMP_VELOCITY = -520;
export const PLAYER_GRAVITY = 900;

export const ELEVATOR_SPEED = 560;

export const COLORS = {
  background: 0x1a1a2e,
  elevatorShaft: 0x16213e,
  elevatorPlatform: 0x0f3460,
  floorUnlocked: 0x53a653,
  floorLocked: 0x8b0000,
  /** AU tokens are gold */
  token: 0xffd700,
  hudBackground: 0x000000,
  hudText: '#e0e0e0',
  titleText: '#00d4ff',
  menuText: '#ffffff',
};

export const FLOORS = {
  LOBBY: 0,
  PLATFORM_TEAM: 1,
  BUSINESS: 3,
  EXECUTIVE: 4,
  PRODUCTS: 5,
} as const;

export type FloorId = typeof FLOORS[keyof typeof FLOORS];
