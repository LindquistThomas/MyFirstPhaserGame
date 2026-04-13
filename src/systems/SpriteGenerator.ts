import * as Phaser from 'phaser';
import { TILE_SIZE, COLORS } from '../config/gameConfig';

/*
 * 128×128 pixel-art sprite generator.
 * Every graphic asset is built at runtime so the game ships with zero image files.
 */

export function generateSprites(scene: Phaser.Scene): void {
  generatePlayerSprites(scene);
  generateTileSprites(scene);
  generateAUTokenSprites(scene);
  generateElevatorSprites(scene);
  generateDoorSprites(scene);
  generateParticleSprite(scene);
}

/* ------------------------------------------------------------------ */
/*  Player (64 × 128 — one tile wide, one tile tall)                  */
/* ------------------------------------------------------------------ */
function generatePlayerSprites(scene: Phaser.Scene): void {
  const W = 64;
  const H = 128;
  const FRAMES = 8; // idle×2, walk×4, jump, fall

  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  /** Pixel helper – fills a rectangle whose coords are in a 16×32 "design grid"
   *  and scales them up to the actual 64×128 canvas frame.                       */
  const S = 4;                       // scale factor  (16*4 = 64, 32*4 = 128)
  const px = (frame: number, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(frame * W + x * S, y * S, w * S, h * S);
  };

  const drawChar = (
    f: number,       // frame index
    bodyY: number,   // vertical body shift (breathing / bobbing)
    legL: number,    // left-leg length offset
    legR: number,    // right-leg length offset
    armL: number,    // left-arm y-offset
    armR: number,    // right-arm y-offset
    jump: boolean,
  ) => {
    const by = bodyY;

    // Hair
    px(f, 4, 0 + by, 8, 3, '#4a3728');
    // Head / skin
    px(f, 5, 2 + by, 6, 6, '#f5c5a3');
    // Eyes (white)
    px(f, 6, 4 + by, 2, 2, '#ffffff');
    px(f, 9, 4 + by, 2, 2, '#ffffff');
    // Pupils
    px(f, 7, 5 + by, 1, 1, '#222222');
    px(f, 10, 5 + by, 1, 1, '#222222');
    // Glasses frame (architect!)
    px(f, 5, 4 + by, 7, 1, '#666666');
    px(f, 5, 3 + by, 1, 3, '#666666');
    px(f, 11, 3 + by, 1, 3, '#666666');

    // Torso / shirt
    px(f, 4, 8 + by, 8, 8, '#4a90d9');
    // Tie
    px(f, 7, 8 + by, 2, 7, '#cc3333');
    // Belt
    px(f, 4, 16 + by, 8, 1, '#222222');

    // Left arm
    px(f, 2, 9 + by + armL, 2, 6, '#4a90d9');
    px(f, 2, 15 + by + armL, 2, 2, '#f5c5a3');
    // Right arm
    px(f, 12, 9 + by + armR, 2, 6, '#4a90d9');
    px(f, 12, 15 + by + armR, 2, 2, '#f5c5a3');

    // Legs / trousers
    if (jump) {
      px(f, 4, 17 + by, 3, 6, '#333344');
      px(f, 9, 17 + by, 3, 6, '#333344');
      px(f, 3, 23 + by, 4, 2, '#1a1a1a');
      px(f, 9, 23 + by, 4, 2, '#1a1a1a');
    } else {
      px(f, 4, 17 + by, 3, 7 + legL, '#333344');
      px(f, 9, 17 + by, 3, 7 + legR, '#333344');
      // Shoes
      px(f, 3, 24 + by + legL, 4, 2, '#1a1a1a');
      px(f, 9, 24 + by + legR, 4, 2, '#1a1a1a');
    }
  };

  // idle 0-1
  drawChar(0, 0, 0, 0, 0, 0, false);
  drawChar(1, 1, 0, 0, 0, 0, false);
  // walk 2-5
  drawChar(2, 0, -1, 1, -1, 1, false);
  drawChar(3, -1, 1, -1, 1, -1, false);
  drawChar(4, 0, -1, 1, 1, -1, false);
  drawChar(5, -1, 1, -1, -1, 1, false);
  // jump 6
  drawChar(6, -1, 0, 0, -2, -2, true);
  // fall 7
  drawChar(7, 1, 0, 0, 1, 1, false);

  scene.textures.addSpriteSheet('player', canvas as unknown as HTMLImageElement, { frameWidth: W, frameHeight: H });
}

/* ------------------------------------------------------------------ */
/*  Tiles (128 × 128)                                                 */
/* ------------------------------------------------------------------ */
function generateTileSprites(scene: Phaser.Scene): void {
  const S = TILE_SIZE;

  // Generic hub platform
  createTile(scene, 'platform_tile', S, (gfx) => {
    gfx.fillStyle(0x555577); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x666688); gfx.fillRect(2, 2, S - 4, S - 4);
    gfx.fillStyle(0x555577); gfx.fillRect(4, 4, S - 8, S - 8);
    gfx.lineStyle(1, 0x444466, 0.3);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
  });

  // Wall
  createTile(scene, 'wall_tile', S, (gfx) => {
    gfx.fillStyle(0x333355); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x3a3a5e);
    gfx.fillRect(0, 0, S, 4);
    gfx.fillRect(0, 0, 4, S);
  });

  // Floor 1 – Platform Team (green)
  createTile(scene, 'platform_floor1', S, (gfx) => {
    gfx.fillStyle(0x2d6a4f); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x40916c);
    gfx.fillRect(2, 2, S - 4, 4);
    gfx.fillRect(2, 2, 4, S - 4);
    gfx.lineStyle(1, 0x2d6a4f, 0.4);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
  });

  // Floor 2 – Cloud Team (blue)
  createTile(scene, 'platform_floor2', S, (gfx) => {
    gfx.fillStyle(0x023e8a); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x0077b6);
    gfx.fillRect(2, 2, S - 4, 4);
    gfx.fillRect(2, 2, 4, S - 4);
    gfx.lineStyle(1, 0x023e8a, 0.4);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
  });

  // Background
  createTile(scene, 'bg_tile', S, (gfx) => {
    gfx.fillStyle(0x16213e); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x1a2542, 0.5);
    gfx.fillRect(0, 0, S / 2, S / 2);
    gfx.fillRect(S / 2, S / 2, S / 2, S / 2);
  });
}

function createTile(
  scene: Phaser.Scene,
  key: string,
  size: number,
  draw: (gfx: Phaser.GameObjects.Graphics) => void,
): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(gfx);
  gfx.generateTexture(key, size, size);
  gfx.destroy();
}

/* ------------------------------------------------------------------ */
/*  AU (Architecture Utility) token — gold coins, 40 px               */
/* ------------------------------------------------------------------ */
function generateAUTokenSprites(scene: Phaser.Scene): void {
  const R = 20; // radius
  const D = R * 2;

  const drawCoin = (key: string, rim: number, shine: number, inner: number) => {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(rim);   gfx.fillCircle(R, R, R - 1);
    gfx.fillStyle(shine); gfx.fillCircle(R - 2, R - 2, R - 5);
    gfx.fillStyle(inner); gfx.fillCircle(R, R, R - 9);
    gfx.generateTexture(key, D, D);
    gfx.destroy();
  };

  drawCoin('token',        COLORS.token, 0xffed4a, COLORS.token);
  drawCoin('token_floor1', 0x95d5b2,     0xb7e4c7, 0x95d5b2);
  drawCoin('token_floor2', 0x90e0ef,     0xcaf0f8, 0x90e0ef);
}

/* ------------------------------------------------------------------ */
/*  Elevator                                                          */
/* ------------------------------------------------------------------ */
function generateElevatorSprites(scene: Phaser.Scene): void {
  // Platform (wider for 128-px world)
  const ew = 160;
  const eh = 16;
  const eGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  eGfx.fillStyle(0x0f3460); eGfx.fillRect(0, 0, ew, eh);
  eGfx.fillStyle(0x1a5276); eGfx.fillRect(4, 4, ew - 8, eh - 8);
  eGfx.fillStyle(0x0f3460);
  eGfx.fillRect(0, 0, 6, eh);
  eGfx.fillRect(ew - 6, 0, 6, eh);
  eGfx.generateTexture('elevator_platform', ew, eh);
  eGfx.destroy();

  // Shaft background strip
  const sw = 200;
  const sh = TILE_SIZE;
  const sGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  sGfx.fillStyle(0x0a0a1a); sGfx.fillRect(0, 0, sw, sh);
  sGfx.lineStyle(1, 0x1a1a3a, 0.5);
  sGfx.lineBetween(0, 0, sw, 0);
  sGfx.generateTexture('elevator_shaft', sw, sh);
  sGfx.destroy();
}

/* ------------------------------------------------------------------ */
/*  Doors (80 × 112 — fits well next to 128-px player)               */
/* ------------------------------------------------------------------ */
function generateDoorSprites(scene: Phaser.Scene): void {
  const dw = 80;
  const dh = 112;

  const baseDoor = (key: string, fill: number, inner: number, detail: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(fill);  g.fillRect(0, 0, dw, dh);
    g.fillStyle(inner); g.fillRect(4, 4, dw - 8, dh - 8);
    g.fillStyle(fill);  g.fillRect(dw / 2 - 1, 0, 2, dh);
    detail(g);
    g.generateTexture(key, dw, dh);
    g.destroy();
  };

  baseDoor('door_unlocked', 0x53a653, 0x6bc46b, (g) => {
    g.fillStyle(0xffd700); g.fillCircle(dw - 18, dh / 2, 5);
  });

  baseDoor('door_locked', 0x8b0000, 0xa52a2a, (g) => {
    g.fillStyle(0xff0000); g.fillRect(dw / 2 - 8, dh / 2 - 8, 16, 16);
  });

  baseDoor('door_exit', 0x4a90d9, 0x6ab0f9, (g) => {
    g.fillStyle(0xffffff);
    g.fillTriangle(dw / 2, dh / 2 - 12, dw / 2 - 10, dh / 2 + 6, dw / 2 + 10, dh / 2 + 6);
  });
}

/* ------------------------------------------------------------------ */
/*  Particle (shared)                                                 */
/* ------------------------------------------------------------------ */
function generateParticleSprite(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0xffffff);
  gfx.fillCircle(6, 6, 6);
  gfx.generateTexture('particle', 12, 12);
  gfx.destroy();
}
