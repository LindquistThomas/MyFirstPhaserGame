import Phaser from 'phaser';
import { TILE_SIZE, COLORS } from '../config/gameConfig';

/**
 * Generates all placeholder sprites programmatically.
 * No external asset files needed — the game is fully self-contained.
 */
export function generateSprites(scene: Phaser.Scene): void {
  generatePlayerSprites(scene);
  generateTileSprites(scene);
  generateTokenSprite(scene);
  generateElevatorSprites(scene);
  generateDoorSprite(scene);
  generateParticleSprite(scene);
}

function generatePlayerSprites(scene: Phaser.Scene): void {
  const w = 28;
  const h = 40;
  const frames: Phaser.GameObjects.Graphics[] = [];

  // Create a spritesheet with 12 frames:
  // 0: idle1, 1: idle2 (breathing), 2-5: walk frames, 6: jump, 7: fall
  const canvas = document.createElement('canvas');
  canvas.width = w * 8;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Helper to draw character at frame position
  const drawChar = (frameX: number, bodyOffsetY: number, legOffset: number, armOffset: number, isJump: boolean) => {
    const x = frameX * w;
    const centerX = x + w / 2;

    // Body color
    ctx.fillStyle = '#4a90d9'; // Blue shirt
    // Head
    ctx.fillStyle = '#f5c5a3'; // Skin
    ctx.fillRect(centerX - 5, 2 + bodyOffsetY, 10, 10);
    // Hair
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(centerX - 6, 1 + bodyOffsetY, 12, 5);
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - 3, 5 + bodyOffsetY, 3, 3);
    ctx.fillRect(centerX + 1, 5 + bodyOffsetY, 3, 3);
    ctx.fillStyle = '#333333';
    ctx.fillRect(centerX - 2, 6 + bodyOffsetY, 2, 2);
    ctx.fillRect(centerX + 2, 6 + bodyOffsetY, 2, 2);

    // Torso (shirt)
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(centerX - 7, 12 + bodyOffsetY, 14, 12);
    // Tie
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(centerX - 1, 12 + bodyOffsetY, 2, 10);

    // Arms
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(centerX - 10, 13 + bodyOffsetY + armOffset, 4, 10);
    ctx.fillRect(centerX + 6, 13 + bodyOffsetY - armOffset, 4, 10);
    // Hands
    ctx.fillStyle = '#f5c5a3';
    ctx.fillRect(centerX - 10, 23 + bodyOffsetY + armOffset, 4, 3);
    ctx.fillRect(centerX + 6, 23 + bodyOffsetY - armOffset, 4, 3);

    // Pants
    ctx.fillStyle = '#333333';
    if (isJump) {
      // Tucked legs
      ctx.fillRect(centerX - 6, 24 + bodyOffsetY, 5, 8);
      ctx.fillRect(centerX + 1, 24 + bodyOffsetY, 5, 8);
    } else {
      ctx.fillRect(centerX - 6, 24 + bodyOffsetY, 5, 10 + legOffset);
      ctx.fillRect(centerX + 1, 24 + bodyOffsetY, 5, 10 - legOffset);
    }

    // Shoes
    ctx.fillStyle = '#222222';
    if (isJump) {
      ctx.fillRect(centerX - 7, 32 + bodyOffsetY, 6, 3);
      ctx.fillRect(centerX + 1, 32 + bodyOffsetY, 6, 3);
    } else {
      ctx.fillRect(centerX - 7, 34 + bodyOffsetY + legOffset, 6, 3);
      ctx.fillRect(centerX + 1, 34 + bodyOffsetY - legOffset, 6, 3);
    }

    // Glasses (architect!)
    ctx.fillStyle = '#888888';
    ctx.fillRect(centerX - 4, 5 + bodyOffsetY, 9, 1);
    ctx.fillRect(centerX - 4, 4 + bodyOffsetY, 1, 4);
    ctx.fillRect(centerX + 4, 4 + bodyOffsetY, 1, 4);
  };

  // Frame 0: Idle 1
  drawChar(0, 0, 0, 0, false);
  // Frame 1: Idle 2 (slight breathing)
  drawChar(1, 1, 0, 0, false);
  // Frame 2-5: Walk cycle
  drawChar(2, 0, -2, -2, false);
  drawChar(3, -1, 2, 2, false);
  drawChar(4, 0, -2, 2, false);
  drawChar(5, -1, 2, -2, false);
  // Frame 6: Jump
  drawChar(6, -2, 0, -3, true);
  // Frame 7: Fall
  drawChar(7, 1, 0, 2, false);

  scene.textures.addCanvas('player_sheet', canvas);

  // Create individual frames from the canvas spritesheet
  const texture = scene.textures.get('player_sheet');
  for (let i = 0; i < 8; i++) {
    texture.add(i, 0, i * w, 0, w, h);
  }

  // Also create a sprite sheet texture for Phaser animations
  scene.textures.addSpriteSheet('player', canvas, {
    frameWidth: w,
    frameHeight: h,
  });
}

function generateTileSprites(scene: Phaser.Scene): void {
  const size = TILE_SIZE;

  // Platform tile
  const platformGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  platformGfx.fillStyle(0x555577);
  platformGfx.fillRect(0, 0, size, size);
  platformGfx.fillStyle(0x666688);
  platformGfx.fillRect(1, 1, size - 2, size - 2);
  platformGfx.fillStyle(0x555577);
  platformGfx.fillRect(2, 2, size - 4, size - 4);
  // Grid lines for tech feel
  platformGfx.lineStyle(1, 0x444466, 0.3);
  platformGfx.lineBetween(size / 2, 0, size / 2, size);
  platformGfx.lineBetween(0, size / 2, size, size / 2);
  platformGfx.generateTexture('platform_tile', size, size);
  platformGfx.destroy();

  // Wall tile
  const wallGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  wallGfx.fillStyle(0x333355);
  wallGfx.fillRect(0, 0, size, size);
  wallGfx.fillStyle(0x3a3a5e);
  wallGfx.fillRect(0, 0, size, 2);
  wallGfx.fillRect(0, 0, 2, size);
  wallGfx.generateTexture('wall_tile', size, size);
  wallGfx.destroy();

  // Generate themed platform tiles for each floor
  const floorColors = [
    { key: 'platform_floor1', color: 0x2d6a4f, highlight: 0x40916c },
    { key: 'platform_floor2', color: 0x023e8a, highlight: 0x0077b6 },
  ];

  for (const { key, color, highlight } of floorColors) {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, size, size);
    gfx.fillStyle(highlight);
    gfx.fillRect(1, 1, size - 2, 2);
    gfx.fillRect(1, 1, 2, size - 2);
    gfx.lineStyle(1, color, 0.5);
    gfx.lineBetween(size / 2, 0, size / 2, size);
    gfx.lineBetween(0, size / 2, size, size / 2);
    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  // Background tile
  const bgGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  bgGfx.fillStyle(0x16213e);
  bgGfx.fillRect(0, 0, size, size);
  bgGfx.fillStyle(0x1a2542, 0.5);
  bgGfx.fillRect(0, 0, size / 2, size / 2);
  bgGfx.fillRect(size / 2, size / 2, size / 2, size / 2);
  bgGfx.generateTexture('bg_tile', size, size);
  bgGfx.destroy();
}

function generateTokenSprite(scene: Phaser.Scene): void {
  const size = 20;

  // Generic gold token
  const tokenGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  tokenGfx.fillStyle(COLORS.token);
  tokenGfx.fillCircle(size / 2, size / 2, size / 2 - 1);
  tokenGfx.fillStyle(0xffed4a);
  tokenGfx.fillCircle(size / 2 - 1, size / 2 - 1, size / 2 - 4);
  tokenGfx.fillStyle(COLORS.token);
  tokenGfx.fillCircle(size / 2, size / 2, size / 2 - 6);
  tokenGfx.generateTexture('token', size, size);
  tokenGfx.destroy();

  // Green token (Floor 1 - Infrastructure)
  const greenToken = scene.make.graphics({ x: 0, y: 0 }, false);
  greenToken.fillStyle(0x95d5b2);
  greenToken.fillCircle(size / 2, size / 2, size / 2 - 1);
  greenToken.fillStyle(0xb7e4c7);
  greenToken.fillCircle(size / 2 - 1, size / 2 - 1, size / 2 - 4);
  greenToken.fillStyle(0x95d5b2);
  greenToken.fillCircle(size / 2, size / 2, size / 2 - 6);
  greenToken.generateTexture('token_floor1', size, size);
  greenToken.destroy();

  // Blue token (Floor 2 - Cloud)
  const blueToken = scene.make.graphics({ x: 0, y: 0 }, false);
  blueToken.fillStyle(0x90e0ef);
  blueToken.fillCircle(size / 2, size / 2, size / 2 - 1);
  blueToken.fillStyle(0xcaf0f8);
  blueToken.fillCircle(size / 2 - 1, size / 2 - 1, size / 2 - 4);
  blueToken.fillStyle(0x90e0ef);
  blueToken.fillCircle(size / 2, size / 2, size / 2 - 6);
  blueToken.generateTexture('token_floor2', size, size);
  blueToken.destroy();
}

function generateElevatorSprites(scene: Phaser.Scene): void {
  // Elevator platform
  const elevGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  const ew = 80;
  const eh = 12;
  elevGfx.fillStyle(0x0f3460);
  elevGfx.fillRect(0, 0, ew, eh);
  elevGfx.fillStyle(0x1a5276);
  elevGfx.fillRect(2, 2, ew - 4, eh - 4);
  // Safety rails visual
  elevGfx.fillStyle(0x0f3460);
  elevGfx.fillRect(0, 0, 4, eh);
  elevGfx.fillRect(ew - 4, 0, 4, eh);
  elevGfx.generateTexture('elevator_platform', ew, eh);
  elevGfx.destroy();

  // Elevator shaft background
  const shaftGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  const sw = 100;
  const sh = TILE_SIZE;
  shaftGfx.fillStyle(0x0a0a1a);
  shaftGfx.fillRect(0, 0, sw, sh);
  shaftGfx.lineStyle(1, 0x1a1a3a, 0.5);
  shaftGfx.lineBetween(0, 0, sw, 0);
  shaftGfx.generateTexture('elevator_shaft', sw, sh);
  shaftGfx.destroy();
}

function generateDoorSprite(scene: Phaser.Scene): void {
  const dw = 40;
  const dh = 56;

  // Unlocked door
  const doorGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  doorGfx.fillStyle(0x53a653);
  doorGfx.fillRect(0, 0, dw, dh);
  doorGfx.fillStyle(0x6bc46b);
  doorGfx.fillRect(2, 2, dw - 4, dh - 4);
  doorGfx.fillStyle(0x53a653);
  doorGfx.fillRect(dw / 2 - 1, 0, 2, dh);
  // Door handle
  doorGfx.fillStyle(0xffd700);
  doorGfx.fillCircle(dw - 10, dh / 2, 3);
  doorGfx.generateTexture('door_unlocked', dw, dh);
  doorGfx.destroy();

  // Locked door
  const lockedGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  lockedGfx.fillStyle(0x8b0000);
  lockedGfx.fillRect(0, 0, dw, dh);
  lockedGfx.fillStyle(0xa52a2a);
  lockedGfx.fillRect(2, 2, dw - 4, dh - 4);
  lockedGfx.fillStyle(0x8b0000);
  lockedGfx.fillRect(dw / 2 - 1, 0, 2, dh);
  // Lock symbol
  lockedGfx.fillStyle(0xff0000);
  lockedGfx.fillRect(dw / 2 - 5, dh / 2 - 5, 10, 10);
  lockedGfx.generateTexture('door_locked', dw, dh);
  lockedGfx.destroy();

  // Exit door (inside levels)
  const exitGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  exitGfx.fillStyle(0x4a90d9);
  exitGfx.fillRect(0, 0, dw, dh);
  exitGfx.fillStyle(0x6ab0f9);
  exitGfx.fillRect(2, 2, dw - 4, dh - 4);
  exitGfx.fillStyle(0x4a90d9);
  exitGfx.fillRect(dw / 2 - 1, 0, 2, dh);
  // Arrow symbol
  exitGfx.fillStyle(0xffffff);
  exitGfx.fillTriangle(dw / 2, dh / 2 - 8, dw / 2 - 6, dh / 2 + 4, dw / 2 + 6, dh / 2 + 4);
  exitGfx.generateTexture('door_exit', dw, dh);
  exitGfx.destroy();
}

function generateParticleSprite(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0xffffff);
  gfx.fillCircle(4, 4, 4);
  gfx.generateTexture('particle', 8, 8);
  gfx.destroy();
}
