import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/** Door textures: unlocked (green), locked (red), exit (blue with arrow). */
export function generateDoorSprites(scene: Phaser.Scene): void {
  const dw = 80;
  const dh = 112;

  const baseDoor = (
    key: string,
    fill: number,
    inner: number,
    detail: (g: Phaser.GameObjects.Graphics) => void,
  ) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(fill);  g.fillRect(0, 0, dw, dh);
    g.fillStyle(inner); g.fillRect(4, 4, dw - 8, dh - 8);
    g.fillStyle(fill);  g.fillRect(dw / 2 - 1, 0, 2, dh);
    detail(g);
    g.generateTexture(key, dw, dh);
    g.destroy();
  };

  baseDoor('door_unlocked', theme.color.status.unlocked, 0x6bc46b, (g) => {
    g.fillStyle(theme.color.ui.token); g.fillCircle(dw - 18, dh / 2, 5);
  });

  baseDoor('door_locked', theme.color.status.locked, 0xa52a2a, (g) => {
    g.fillStyle(0xff0000); g.fillRect(dw / 2 - 8, dh / 2 - 8, 16, 16);
  });

  baseDoor('door_exit', 0x4a90d9, 0x6ab0f9, (g) => {
    g.fillStyle(0xffffff);
    g.fillTriangle(dw / 2, dh / 2 - 12, dw / 2 - 10, dh / 2 + 6, dw / 2 + 10, dh / 2 + 6);
  });
}
