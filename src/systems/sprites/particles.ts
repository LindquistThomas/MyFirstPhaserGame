import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/** Shared 12×12 white circle used by all particle emitters. */
export function generateParticleSprite(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0xffffff);
  gfx.fillCircle(6, 6, 6);
  gfx.generateTexture('particle', 12, 12);
  gfx.destroy();
}
