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
  });

  createTile(scene, 'platform_floor2', S, (gfx) => {
    gfx.fillStyle(0x023e8a); gfx.fillRect(0, 0, S, S);
    gfx.fillStyle(0x0077b6);
    gfx.fillRect(2, 2, S - 4, 4);
    gfx.fillRect(2, 2, 4, S - 4);
    gfx.lineStyle(1, 0x023e8a, 0.4);
    gfx.lineBetween(S / 2, 0, S / 2, S);
    gfx.lineBetween(0, S / 2, S, S / 2);
  });

  // Rim-lit variant used only by ExecutiveSuiteScene.
  // Mirrors platform_floor2 but adds a 2px lighter top rim and a 1px
  // top-left specular for depth against the gradient-sky background.
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
}
