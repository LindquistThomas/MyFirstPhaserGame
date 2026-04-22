import * as Phaser from 'phaser';
import { TILE_SIZE } from '../../config/gameConfig';
import { theme } from '../../style/theme';

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

/** Lighten a 0xRRGGBB int toward white by amount in [0,1]. */
function lighten(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return (lr << 16) | (lg << 8) | lb;
}

/** Darken a 0xRRGGBB int toward black by amount in [0,1]. */
function darken(color: number, amount: number): number {
  const f = 1 - amount;
  return (
    (Math.round(((color >> 16) & 0xff) * f) << 16) |
    (Math.round(((color >> 8) & 0xff) * f) << 8) |
    Math.round((color & 0xff) * f)
  );
}

/**
 * Apply the standard rim-light + bottom shadow + top-left specular treatment
 * to a tile. Matches the historical `platform_floor4_lit` look but generalized
 * across all platform tiles so every floor reads with depth instead of flat.
 */
function addTileBevel(
  gfx: Phaser.GameObjects.Graphics,
  size: number,
  baseColor: number,
): void {
  // Top rim (2px lighter band)
  gfx.fillStyle(lighten(baseColor, 0.45));
  gfx.fillRect(0, 0, size, 2);
  // Bottom shadow (2px darker band)
  gfx.fillStyle(darken(baseColor, 0.35));
  gfx.fillRect(0, size - 2, size, 2);
  // Top-left specular 1px pixel
  gfx.fillStyle(0xffffff);
  gfx.fillRect(1, 1, 1, 1);
  // Right-edge faint shadow to break the uniform repeat
  gfx.fillStyle(darken(baseColor, 0.2), 0.5);
  gfx.fillRect(size - 1, 2, 1, size - 4);
}

/** Generic shaft/wall/floor/background tile textures (TILE_SIZE square). */
export function generateTileSprites(scene: Phaser.Scene): void {
  const S = TILE_SIZE;

  createTile(scene, 'platform_tile', S, (gfx) => {
    gfx.fillStyle(0x555577); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x666688); gfx.fillRect(2, 2, S - 4, S - 4);
    gfx.fillStyle(0x555577); gfx.fillRect(4, 4, S - 8, S - 8);
    gfx.lineStyle(1, theme.color.floor.lobby.platform, 0.3);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
    addTileBevel(gfx, S, 0x555577);
  });

  createTile(scene, 'wall_tile', S, (gfx) => {
    gfx.fillStyle(theme.color.floor.lobby.wall); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x3a3a5e);
    gfx.fillRect(0, 0, S, 4);
    gfx.fillRect(0, 0, 4, S);
  });

  createTile(scene, 'platform_floor1', S, (gfx) => {
    gfx.fillStyle(theme.color.floor.platform.platform); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(theme.color.floor.platform.wall);
    gfx.fillRect(2, 2, S - 4, 4);
    gfx.fillRect(2, 2, 4, S - 4);
    gfx.lineStyle(1, theme.color.floor.platform.platform, 0.4);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
    addTileBevel(gfx, S, theme.color.floor.platform.platform);
  });

  createTile(scene, 'platform_floor2', S, (gfx) => {
    gfx.fillStyle(0x023e8a); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x0077b6);
    gfx.fillRect(2, 2, S - 4, 4);
    gfx.fillRect(2, 2, 4, S - 4);
    gfx.lineStyle(1, 0x023e8a, 0.4);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
    addTileBevel(gfx, S, 0x023e8a);
  });

  // Rim-lit variant used only by ExecutiveSuiteScene.
  // Kept as its own key for backward compat even though addTileBevel now
  // applies a similar treatment to platform_floor2.
  createTile(scene, 'platform_floor4_lit', S, (gfx) => {
    gfx.fillStyle(0x023e8a); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x0077b6);
    gfx.fillRect(2, 2, S - 4, 4);
    gfx.fillRect(2, 2, 4, S - 4);
    gfx.lineStyle(1, 0x023e8a, 0.4);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
    gfx.fillStyle(0x90d5ff);
    gfx.fillRect(0, 0, S, 2);
    gfx.fillStyle(0xffffff);
    gfx.fillRect(1, 1, 1, 1);
  });

  createTile(scene, 'bg_tile', S, (gfx) => {
    gfx.fillStyle(theme.color.bg.shaft); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x1a2542, 0.5);
    gfx.fillRect(0, 0, S / 2, S / 2);
    gfx.fillRect(S / 2, S / 2, S / 2, S / 2);
  });

  // Semi-transparent scuff / scratch overlay — drawn on a subset of placed
  // tiles in LevelScene to break the "gridded wallpaper" look without
  // adding geometry. Alpha is baked low so layering multiple never crushes.
  createTile(scene, 'tile_detail_overlay', S, (gfx) => {
    // Deterministic pseudo-random sprinkle of 1px dots.
    let seed = 0x2f6a5e;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    gfx.fillStyle(0xffffff, 0.06);
    for (let i = 0; i < 32; i++) {
      const x = Math.floor(rand() * S);
      const y = Math.floor(rand() * S);
      gfx.fillRect(x, y, 1, 1);
    }
    // A couple of short scratches
    gfx.lineStyle(1, 0x000000, 0.15);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rand() * (S - 24)) + 6;
      const y = Math.floor(rand() * (S - 12)) + 6;
      const len = 8 + Math.floor(rand() * 14);
      gfx.lineBetween(x, y, x + len, y + 1);
    }
  });
}
