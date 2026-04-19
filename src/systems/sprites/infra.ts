import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/** Infrastructure decorations: server rack, desk+monitor, router, monitor, cables. */
export function generateInfraSprites(scene: Phaser.Scene): void {
  // Server rack (48 × 100)
  (() => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const w = 48, h = 100;
    g.fillStyle(0x2a2a2a); g.fillRect(0, 0, w, h);
    g.fillStyle(0x1a1a1a); g.fillRect(3, 3, w - 6, h - 6);
    const bladeColors = [0x0066aa, 0x009944, 0x0066aa, 0x888888, 0x0066aa];
    for (let i = 0; i < bladeColors.length; i++) {
      const by = 8 + i * 16;
      g.fillStyle(0x333333); g.fillRect(6, by, w - 12, 14);
      g.fillStyle(bladeColors[i]); g.fillRect(8, by + 2, w - 16, 10);
      g.fillStyle(0x00ff00); g.fillCircle(12, by + 7, 2);
      g.fillStyle(0xff4400); g.fillCircle(20, by + 7, 1);
    }
    g.fillStyle(0x1a1a1a);
    for (let y = 90; y < 97; y += 3) {
      g.fillRect(8, y, w - 16, 1);
    }
    g.fillStyle(0x444444);
    g.fillRect(4, h - 4, 8, 4);
    g.fillRect(w - 12, h - 4, 8, 4);
    g.generateTexture('server_rack', w, h);
    g.destroy();
  })();

  // Desk with monitor (96 × 72)
  (() => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const w = 96, h = 72;
    g.fillStyle(0x6d4c41); g.fillRect(0, 36, w, 6);
    g.fillStyle(0x5d4037);
    g.fillRect(4, 42, 6, 30);
    g.fillRect(w - 10, 42, 6, 30);
    g.fillStyle(0x444444); g.fillRect(42, 28, 12, 10);
    g.fillStyle(0x222222); g.fillRect(16, 2, 64, 28);
    g.fillStyle(0x1a3a5c); g.fillRect(19, 4, 58, 22);
    g.fillStyle(0x00cc44);
    g.fillRect(22, 8, 20, 2);
    g.fillRect(22, 12, 30, 2);
    g.fillRect(22, 16, 15, 2);
    g.fillRect(22, 20, 25, 2);
    g.fillStyle(0x00ff66); g.fillRect(48, 20, 3, 2);
    g.fillStyle(0x333333); g.fillRect(28, 30, 40, 5);
    g.fillStyle(0x444444); g.fillRect(30, 31, 36, 3);
    g.generateTexture('desk_monitor', w, h);
    g.destroy();
  })();

  // Router / network switch (56 × 20)
  (() => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const w = 56, h = 20;
    g.fillStyle(0x37474f); g.fillRect(0, 2, w, h - 4);
    g.fillStyle(0x455a64); g.fillRect(2, 4, w - 4, h - 8);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x222222); g.fillRect(6 + i * 8, 7, 5, 6);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i < 4 ? 0x00ff00 : 0xff8800);
      g.fillCircle(8 + i * 8, 16, 1);
    }
    g.fillStyle(0x666666);
    g.fillRect(2, 0, 3, 5);
    g.fillRect(w - 5, 0, 3, 5);
    g.generateTexture('router', w, h);
    g.destroy();
  })();

  // Standalone monitor/dashboard (52 × 44)
  (() => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const w = 52, h = 44;
    g.fillStyle(0x444444); g.fillRect(18, 38, 16, 6);
    g.fillStyle(0x555555); g.fillRect(23, 32, 6, 8);
    g.fillStyle(0x222222); g.fillRect(2, 0, w - 4, 34);
    g.fillStyle(0x0d47a1); g.fillRect(5, 2, w - 10, 28);
    g.fillStyle(0x00bcd4);
    g.fillRect(8, 5, 16, 10);
    g.fillStyle(0x4caf50);
    g.fillRect(28, 5, 16, 10);
    g.fillStyle(0xff9800);
    g.fillRect(8, 18, 36, 3);
    g.fillStyle(0x42a5f5);
    g.fillRect(8, 24, 24, 3);
    g.generateTexture('monitor_dash', w, h);
    g.destroy();
  })();

  // Cable bundle (12 × 80)
  (() => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const w = 12, h = 80;
    const colors = [0x0088ff, 0xff4400, 0x00cc44, theme.color.status.warning];
    for (let i = 0; i < colors.length; i++) {
      g.fillStyle(colors[i], 0.7);
      g.fillRect(2 + i * 2, 0, 2, h);
    }
    g.generateTexture('cables', w, h);
    g.destroy();
  })();
}
