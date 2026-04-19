import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/** Standing info-board signpost for the lobby (80 × 120). */
export function generateInfoBoardSprite(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 80, h = 120;

  gfx.fillStyle(0x5d4037);
  gfx.fillRect(12, 50, 6, 70);
  gfx.fillRect(62, 50, 6, 70);
  gfx.fillStyle(0x4e342e);
  gfx.fillRect(16, 90, 48, 4);

  gfx.fillStyle(0x1a237e);
  gfx.fillRoundedRect(4, 4, 72, 56, 4);
  gfx.lineStyle(2, theme.color.ui.border, 0.8);
  gfx.strokeRoundedRect(4, 4, 72, 56, 4);
  gfx.fillStyle(0x283593);
  gfx.fillRoundedRect(8, 8, 64, 48, 3);

  gfx.fillStyle(theme.color.ui.accent);
  gfx.fillCircle(40, 20, 3);
  gfx.fillRect(38, 26, 5, 16);
  gfx.fillStyle(theme.color.ui.accentAlt, 0.5);
  gfx.fillCircle(20, 36, 2);
  gfx.fillCircle(60, 36, 2);
  gfx.fillCircle(20, 26, 2);
  gfx.fillCircle(60, 26, 2);

  gfx.generateTexture('info_board', w, h);
  gfx.destroy();
}
