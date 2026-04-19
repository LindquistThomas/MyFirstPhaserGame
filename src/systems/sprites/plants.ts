import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/** Decorative potted plants for the lobby (small + tall variants). */
export function generatePlantSprites(scene: Phaser.Scene): void {
  const s = scene.make.graphics({ x: 0, y: 0 }, false);
  const sw = 32, sh = 64;
  s.fillStyle(0x8b4513); s.fillRect(6, 44, 20, 18);
  s.fillStyle(0xa0522d); s.fillRect(4, 42, 24, 4);
  s.fillStyle(0x2d5a1e); s.fillRect(14, 20, 4, 24);
  s.fillStyle(0x3a8a2e);
  s.fillEllipse(16, 16, 22, 20);
  s.fillStyle(0x4caf50);
  s.fillEllipse(10, 12, 14, 14);
  s.fillEllipse(22, 12, 14, 14);
  s.fillStyle(0x66bb6a);
  s.fillEllipse(16, 8, 12, 10);
  s.generateTexture('plant_small', sw, sh);
  s.destroy();

  const t = scene.make.graphics({ x: 0, y: 0 }, false);
  const tw = 48, th = 80;
  t.fillStyle(0x6d4c41); t.fillRect(10, 56, 28, 22);
  t.fillStyle(0x8d6e63); t.fillRect(8, 54, 32, 4);
  t.fillStyle(0x2d5a1e); t.fillRect(22, 22, 4, 34);
  t.fillStyle(0x2d5a1e);
  t.fillRect(14, 30, 10, 3);
  t.fillRect(26, 36, 10, 3);
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
