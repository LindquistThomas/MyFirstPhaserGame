import * as Phaser from 'phaser';
import { TILE_SIZE } from '../../config/gameConfig';

/** Hub elevator: cyan platform + dark shaft background strip. */
export function generateElevatorSprites(scene: Phaser.Scene): void {
  const ew = 160;
  const eh = 16;
  const eGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  eGfx.fillStyle(0x00aaff); eGfx.fillRect(0, 0, ew, eh);
  eGfx.fillStyle(0x0088cc); eGfx.fillRect(4, 4, ew - 8, eh - 8);
  eGfx.fillStyle(0x00ccff);
  eGfx.fillRect(0, 0, ew, 3);
  eGfx.fillRect(0, 0, 6, eh);
  eGfx.fillRect(ew - 6, 0, 6, eh);
  eGfx.generateTexture('elevator_platform', ew, eh);
  eGfx.destroy();

  const sw = 200;
  const sh = TILE_SIZE;
  const sGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  sGfx.fillStyle(0x060610); sGfx.fillRect(0, 0, sw, sh);
  sGfx.lineStyle(1, 0x101030, 0.6);
  sGfx.lineBetween(sw / 4, 0, sw / 4, sh);
  sGfx.lineBetween(sw / 2, 0, sw / 2, sh);
  sGfx.lineBetween(sw * 3 / 4, 0, sw * 3 / 4, sh);
  sGfx.lineStyle(1, 0x0a0a2a, 0.4);
  sGfx.lineBetween(0, sh / 2, sw, sh / 2);
  sGfx.generateTexture('elevator_shaft', sw, sh);
  sGfx.destroy();
}
