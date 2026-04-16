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
  generateRoomElevatorSprite(scene);
  generateDoorSprites(scene);
  generateParticleSprite(scene);
  generatePlantSprites(scene);
}

/* ------------------------------------------------------------------ */
/*  Player — SIDE-VIEW profile (64 × 160, facing right)               */
/*  Frames: idle×2, walk×4, flip×8 (front-flip rotation at 45° steps) */
/* ------------------------------------------------------------------ */
function generatePlayerSprites(scene: Phaser.Scene): void {
  const W = 64;
  const H = 160;
  const FRAMES = 14; // idle×2, walk×4, flip×8

  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const S = 4; // scale factor
  const px = (frame: number, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(frame * W + x * S, y * S, w * S, h * S);
  };

  /* ---------- side-view character (facing right, taller) ---------- */
  const drawSideChar = (
    f: number,
    bodyY: number,
    backLeg: number,   // back-leg extension
    frontLeg: number,  // front-leg extension
    armSwing: number,  // arm y-offset
  ) => {
    const by = bodyY;

    // Hair (side profile – thinner)
    px(f, 5, 0 + by, 6, 3, '#4a3728');
    // Head side-profile (facing right)
    px(f, 6, 2 + by, 5, 6, '#f5c5a3');
    // Nose (protrudes right)
    px(f, 11, 4 + by, 2, 2, '#e8b090');
    // Eye (single, side-view)
    px(f, 8, 4 + by, 2, 2, '#ffffff');
    px(f, 9, 4 + by, 1, 1, '#222222');
    // Glasses (side)
    px(f, 6, 4 + by, 6, 1, '#666666');
    px(f, 6, 3 + by, 1, 3, '#666666');

    // Torso / shirt (taller torso)
    px(f, 5, 8 + by, 6, 11, '#4a90d9');
    // Tie (on the near side)
    px(f, 9, 8 + by, 2, 8, '#cc3333');
    // Belt
    px(f, 5, 19 + by, 6, 1, '#222222');

    // Arm (one visible, in front) – shirt sleeve + hand
    px(f, 8, 9 + by + armSwing, 2, 8, '#4a90d9');
    px(f, 8, 17 + by + armSwing, 2, 2, '#f5c5a3');

    // Back leg (partially hidden, longer)
    px(f, 5, 20 + by, 3, 10 + backLeg, '#2a2a3a');
    px(f, 4, 30 + by + backLeg, 4, 2, '#141414');

    // Front leg (longer)
    px(f, 8, 20 + by, 3, 10 + frontLeg, '#333344');
    px(f, 8, 30 + by + frontLeg, 4, 2, '#1a1a1a');
  };

  // idle 0-1 (slight breathing bob)
  drawSideChar(0, 0, 0, 0, 0);
  drawSideChar(1, 1, 0, 0, 0);

  // walk 2-5 (leg & arm swing cycle)
  drawSideChar(2, 0, -1, 1, -1);
  drawSideChar(3, -1, 1, -1, 1);
  drawSideChar(4, 0, 1, -1, 1);
  drawSideChar(5, -1, -1, 1, -1);

  /* ---------- front-flip frames 6-13 ----------
   * Eight rotation poses at 45° increments:
   *   6 = 0°    (upright, start of flip)
   *   7 = 45°   (tilting forward)
   *   8 = 90°   (horizontal)
   *   9 = 135°  (past horizontal)
   *  10 = 180°  (upside-down)
   *  11 = 225°  (coming back around)
   *  12 = 270°  (near-upright inverted)
   *  13 = 315°  (almost complete)              */
  const drawFlipFrame = (f: number, rotation: number) => {
    const cx = f * W + W / 2;
    const cy = H / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // Compact body (tucked) — draw relative to center
    const p = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * S, y * S, w * S, h * S);
    };

    // Head
    p(-3, -12, 5, 5, '#f5c5a3');
    p(-3, -14, 5, 3, '#4a3728'); // hair
    p(-1, -11, 1, 1, '#222222'); // eye
    p(0, -11, 2, 1, '#666666');  // glasses
    // Torso (tucked but slightly taller)
    p(-3, -7, 6, 8, '#4a90d9');
    p(0, -7, 2, 6, '#cc3333');   // tie
    // Arm
    p(2, -6, 2, 6, '#4a90d9');
    // Legs (tucked)
    p(-3, 1, 3, 6, '#333344');
    p(1, 1, 3, 6, '#333344');
    // Shoes
    p(-3, 7, 3, 2, '#1a1a1a');
    p(1, 7, 3, 2, '#1a1a1a');

    ctx.restore();
  };

  for (let i = 0; i < 8; i++) {
    drawFlipFrame(6 + i, Math.PI * 0.25 * i);
  }

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
/*  Elevator — Impossible-Mission style                               */
/* ------------------------------------------------------------------ */
function generateElevatorSprites(scene: Phaser.Scene): void {
  // Platform (wider for 128-px world)
  const ew = 160;
  const eh = 16;
  const eGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  // Bright cyan platform like Impossible Mission
  eGfx.fillStyle(0x00aaff); eGfx.fillRect(0, 0, ew, eh);
  eGfx.fillStyle(0x0088cc); eGfx.fillRect(4, 4, ew - 8, eh - 8);
  eGfx.fillStyle(0x00ccff);
  eGfx.fillRect(0, 0, ew, 3);         // top highlight
  eGfx.fillRect(0, 0, 6, eh);         // left edge
  eGfx.fillRect(ew - 6, 0, 6, eh);    // right edge
  eGfx.generateTexture('elevator_platform', ew, eh);
  eGfx.destroy();

  // Shaft background strip (darker, more contrast)
  const sw = 200;
  const sh = TILE_SIZE;
  const sGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  sGfx.fillStyle(0x060610); sGfx.fillRect(0, 0, sw, sh);
  // Subtle vertical lines for depth
  sGfx.lineStyle(1, 0x101030, 0.6);
  sGfx.lineBetween(sw / 4, 0, sw / 4, sh);
  sGfx.lineBetween(sw / 2, 0, sw / 2, sh);
  sGfx.lineBetween(sw * 3 / 4, 0, sw * 3 / 4, sh);
  // Horizontal dashes
  sGfx.lineStyle(1, 0x0a0a2a, 0.4);
  sGfx.lineBetween(0, sh / 2, sw, sh / 2);
  sGfx.generateTexture('elevator_shaft', sw, sh);
  sGfx.destroy();
}

/* ------------------------------------------------------------------ */
/*  In-room elevator platform (smaller, for level scenes)             */
/* ------------------------------------------------------------------ */
function generateRoomElevatorSprite(scene: Phaser.Scene): void {
  const w = 72;
  const h = 12;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0x00aaff); gfx.fillRect(0, 0, w, h);
  gfx.fillStyle(0x0088cc); gfx.fillRect(3, 3, w - 6, h - 6);
  gfx.fillStyle(0x00ccff);
  gfx.fillRect(0, 0, w, 2);       // top highlight
  gfx.fillRect(0, 0, 4, h);       // left edge
  gfx.fillRect(w - 4, 0, 4, h);   // right edge
  gfx.generateTexture('room_elevator_platform', w, h);
  gfx.destroy();
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

/* ------------------------------------------------------------------ */
/*  Lobby plants — decorative potted plants (32 × 64 and 48 × 80)    */
/* ------------------------------------------------------------------ */
function generatePlantSprites(scene: Phaser.Scene): void {
  // Small potted plant
  const s = scene.make.graphics({ x: 0, y: 0 }, false);
  const sw = 32, sh = 64;
  // Pot
  s.fillStyle(0x8b4513); s.fillRect(6, 44, 20, 18);
  s.fillStyle(0xa0522d); s.fillRect(4, 42, 24, 4);
  // Stem
  s.fillStyle(0x2d5a1e); s.fillRect(14, 20, 4, 24);
  // Leaves
  s.fillStyle(0x3a8a2e);
  s.fillEllipse(16, 16, 22, 20);
  s.fillStyle(0x4caf50);
  s.fillEllipse(10, 12, 14, 14);
  s.fillEllipse(22, 12, 14, 14);
  s.fillStyle(0x66bb6a);
  s.fillEllipse(16, 8, 12, 10);
  s.generateTexture('plant_small', sw, sh);
  s.destroy();

  // Tall potted plant
  const t = scene.make.graphics({ x: 0, y: 0 }, false);
  const tw = 48, th = 80;
  // Pot
  t.fillStyle(0x6d4c41); t.fillRect(10, 56, 28, 22);
  t.fillStyle(0x8d6e63); t.fillRect(8, 54, 32, 4);
  // Stem
  t.fillStyle(0x2d5a1e); t.fillRect(22, 22, 4, 34);
  // Branches
  t.fillStyle(0x2d5a1e);
  t.fillRect(14, 30, 10, 3);
  t.fillRect(26, 36, 10, 3);
  // Foliage
  t.fillStyle(0x388e3c);
  t.fillEllipse(24, 18, 30, 24);
  t.fillStyle(0x43a047);
  t.fillEllipse(14, 14, 18, 16);
  t.fillEllipse(34, 14, 18, 16);
  t.fillStyle(0x66bb6a);
  t.fillEllipse(24, 8, 16, 14);
  t.fillEllipse(10, 26, 12, 10);
  t.fillEllipse(38, 26, 12, 10);
  t.generateTexture('plant_tall', tw, th);
  t.destroy();
}
