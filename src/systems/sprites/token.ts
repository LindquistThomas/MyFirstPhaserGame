import * as Phaser from 'phaser';
import { COLORS } from '../../config/gameConfig';
import { theme } from '../../style/theme';

/** AU (Architecture Utility) token coin textures — gold + per-floor tints. */
export function generateAUTokenSprites(scene: Phaser.Scene): void {
  const R = 20;
  const D = R * 2;

  const drawCoin = (key: string, rim: number, shine: number, inner: number) => {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(rim);   gfx.fillCircle(R, R, R - 1);
    gfx.fillStyle(shine); gfx.fillCircle(R - 2, R - 2, R - 5);
    gfx.fillStyle(inner); gfx.fillCircle(R, R, R - 9);
    gfx.generateTexture(key, D, D);
    gfx.destroy();
  };

  drawCoin('token',        COLORS.token, theme.color.ui.hover, COLORS.token);
  drawCoin('token_floor1', 0x95d5b2,     0xb7e4c7, 0x95d5b2);
  drawCoin('token_floor2', 0x90e0ef,     0xcaf0f8, 0x90e0ef);
}
