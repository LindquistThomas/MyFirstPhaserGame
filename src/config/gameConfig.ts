export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

export const TILE_SIZE = 32;

export const PLAYER_SPEED = 200;
export const PLAYER_JUMP_VELOCITY = -420;
export const PLAYER_GRAVITY = 800;

export const ELEVATOR_SPEED = 150;

export const COLORS = {
  background: 0x1a1a2e,
  elevatorShaft: 0x16213e,
  elevatorPlatform: 0x0f3460,
  floorUnlocked: 0x53a653,
  floorLocked: 0x8b0000,
  token: 0xffd700,
  hudBackground: 0x000000,
  hudText: '#e0e0e0',
  titleText: '#00d4ff',
  menuText: '#ffffff',
};

export const FLOORS = {
  LOBBY: 0,
  PLATFORM_TEAM: 1,
  CLOUD_TEAM: 2,
} as const;

export type FloorId = typeof FLOORS[keyof typeof FLOORS];
