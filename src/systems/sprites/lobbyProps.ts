import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/**
 * Decorative reception / waiting-area props for the ground-floor lobby
 * visible in the elevator shaft preview. All sprites are drawn with a
 * default 0.5/0.5 origin and pixel-art palette consistent with the rest
 * of the game's procedural art.
 */
export function generateLobbyPropSprites(scene: Phaser.Scene): void {
  generateReceptionDesk(scene);
  generateLobbyLogo(scene);
  generateSofa(scene);
  generateCoffeeTable(scene);
  generateFloorLamp(scene);
  generateWallClock(scene);
  generateWelcomeMat(scene);
}

function generateReceptionDesk(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 160, h = 90;

  // Desk body (dark wood)
  g.fillStyle(0x5d4037);
  g.fillRect(6, 30, w - 12, h - 30);
  // Top counter (lighter wood)
  g.fillStyle(0x8d6e63);
  g.fillRect(4, 26, w - 8, 8);
  // Front panel stripe (brand accent)
  g.fillStyle(0x1a237e);
  g.fillRect(10, 46, w - 20, 6);
  g.fillStyle(theme.color.ui.accent);
  g.fillRect(10, 52, w - 20, 2);
  // Lower kick-plate shadow
  g.fillStyle(0x3e2723);
  g.fillRect(6, h - 6, w - 12, 6);
  // Small monitor on the counter (desktop screen)
  g.fillStyle(0x212121);
  g.fillRect(110, 10, 30, 18);
  g.fillStyle(0x00d4ff);
  g.fillRect(112, 12, 26, 14);
  g.fillStyle(0x263238);
  g.fillRect(122, 28, 6, 3);
  // Bell (reception bell) on the left of the counter
  g.fillStyle(0xb8860b);
  g.fillCircle(26, 22, 6);
  g.fillStyle(0xdaa520);
  g.fillCircle(26, 20, 4);
  g.fillStyle(0x5d4037);
  g.fillRect(22, 26, 8, 2);

  g.generateTexture('reception_desk', w, h);
  g.destroy();
}

function generateLobbyLogo(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 240, h = 80;

  // Backing plaque
  g.fillStyle(0x0a1422, 0.85);
  g.fillRoundedRect(0, 0, w, h, 6);
  g.lineStyle(2, theme.color.ui.border, 0.9);
  g.strokeRoundedRect(1, 1, w - 2, h - 2, 6);

  // Building silhouette (stepped skyline on the left)
  g.fillStyle(theme.color.ui.accent);
  g.fillRect(16, 28, 10, 40);
  g.fillRect(28, 20, 12, 48);
  g.fillRect(42, 12, 14, 56);
  g.fillRect(58, 24, 10, 44);
  // Windows on tallest tower
  g.fillStyle(0x0a1422);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      g.fillRect(46 + col * 5, 18 + row * 10, 2, 4);
    }
  }

  // "ARCHITECT" wordmark — stylised block letters rendered as rectangles
  // so we don't depend on runtime text for this decorative sprite.
  const letterColor = 0xf5f5f5;
  g.fillStyle(letterColor);
  const baseX = 86;
  const baseY = 30;
  const letterH = 20;
  const strokeW = 3;
  // A
  g.fillRect(baseX, baseY + 4, strokeW, letterH - 4);
  g.fillRect(baseX + 9, baseY + 4, strokeW, letterH - 4);
  g.fillRect(baseX + 3, baseY + 4, 6, strokeW);
  g.fillRect(baseX + 3, baseY + 11, 6, strokeW);
  // Dot separator
  g.fillRect(baseX + 16, baseY + letterH - 4, strokeW, strokeW);
  // U
  g.fillRect(baseX + 22, baseY + 4, strokeW, letterH - 4);
  g.fillRect(baseX + 31, baseY + 4, strokeW, letterH - 4);
  g.fillRect(baseX + 22, baseY + letterH - 1, 12, strokeW);
  // Tagline under wordmark
  g.fillStyle(theme.color.ui.accent, 0.9);
  g.fillRect(baseX, baseY + letterH + 6, 120, 2);

  // "BUILDING" secondary line (simple filled bar to suggest text)
  g.fillStyle(0x90a4ae, 0.7);
  g.fillRect(baseX, baseY - 10, 80, 4);

  g.generateTexture('lobby_logo', w, h);
  g.destroy();
}

function generateSofa(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 160, h = 60;

  // Wooden legs
  g.fillStyle(0x3e2723);
  g.fillRect(8, h - 8, 6, 8);
  g.fillRect(w - 14, h - 8, 6, 8);
  // Base frame
  g.fillStyle(0x1a237e);
  g.fillRect(4, 30, w - 8, h - 38);
  // Backrest
  g.fillStyle(0x283593);
  g.fillRect(6, 6, w - 12, 28);
  // Three seat cushions
  g.fillStyle(0x3949ab);
  const cushionW = (w - 16) / 3 - 4;
  for (let i = 0; i < 3; i++) {
    const cx = 10 + i * ((w - 20) / 3);
    g.fillRect(cx, 26, cushionW, 16);
  }
  // Cushion highlights
  g.fillStyle(0x5c6bc0, 0.6);
  for (let i = 0; i < 3; i++) {
    const cx = 10 + i * ((w - 20) / 3);
    g.fillRect(cx + 2, 28, cushionW - 4, 2);
  }
  // Arms
  g.fillStyle(0x1a237e);
  g.fillRect(0, 20, 8, h - 28);
  g.fillRect(w - 8, 20, 8, h - 28);
  g.fillStyle(0x283593);
  g.fillRect(0, 16, 8, 6);
  g.fillRect(w - 8, 16, 8, 6);

  g.generateTexture('sofa', w, h);
  g.destroy();
}

function generateCoffeeTable(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 48, h = 28;

  // Glass top
  g.fillStyle(0x455a64);
  g.fillRect(0, 6, w, 6);
  g.fillStyle(0x607d8b, 0.6);
  g.fillRect(2, 7, w - 4, 2);
  // Top edge
  g.fillStyle(0x263238);
  g.fillRect(0, 4, w, 2);
  // Legs
  g.fillStyle(0x3e2723);
  g.fillRect(4, 12, 4, h - 12);
  g.fillRect(w - 8, 12, 4, h - 12);
  // Lower shelf
  g.fillStyle(0x5d4037);
  g.fillRect(6, 20, w - 12, 3);

  g.generateTexture('coffee_table', w, h);
  g.destroy();
}

function generateFloorLamp(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 24, h = 96;

  // Base
  g.fillStyle(0x263238);
  g.fillRect(4, h - 6, w - 8, 6);
  g.fillStyle(0x455a64);
  g.fillRect(8, h - 8, w - 16, 2);
  // Pole
  g.fillStyle(0x37474f);
  g.fillRect(w / 2 - 1, 24, 2, h - 32);
  // Shade
  g.fillStyle(0xe6c37a);
  g.fillTriangle(w / 2, 4, 2, 26, w - 2, 26);
  g.fillStyle(0xffe0a3, 0.8);
  g.fillTriangle(w / 2, 8, 6, 24, w - 6, 24);
  // Warm glow hint
  g.fillStyle(0xffcc66, 0.4);
  g.fillRect(4, 26, w - 8, 2);

  g.generateTexture('floor_lamp', w, h);
  g.destroy();
}

function generateWallClock(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 48, h = 48;

  // Outer rim
  g.fillStyle(0x37474f);
  g.fillCircle(w / 2, h / 2, 22);
  g.fillStyle(0x263238);
  g.fillCircle(w / 2, h / 2, 20);
  // Face
  g.fillStyle(0xeceff1);
  g.fillCircle(w / 2, h / 2, 18);
  // Hour ticks
  g.fillStyle(0x263238);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const tx = w / 2 + Math.cos(angle) * 15;
    const ty = h / 2 + Math.sin(angle) * 15;
    g.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
  }
  // Hands — hour at ~10, minute at ~2
  g.lineStyle(2, 0x263238, 1);
  g.beginPath();
  g.moveTo(w / 2, h / 2);
  g.lineTo(w / 2 - 6, h / 2 - 4);
  g.strokePath();
  g.lineStyle(2, 0x263238, 1);
  g.beginPath();
  g.moveTo(w / 2, h / 2);
  g.lineTo(w / 2 + 4, h / 2 - 10);
  g.strokePath();
  // Center pin
  g.fillStyle(theme.color.ui.accent);
  g.fillCircle(w / 2, h / 2, 2);

  g.generateTexture('wall_clock', w, h);
  g.destroy();
}

function generateWelcomeMat(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = 100, h = 16;

  // Base
  g.fillStyle(0x3e2723);
  g.fillRect(0, 2, w, h - 4);
  // Stitched border
  g.lineStyle(1, 0x6d4c41, 0.9);
  g.strokeRect(2, 4, w - 4, h - 8);
  // Centre stripe
  g.fillStyle(0x5d4037);
  g.fillRect(6, 7, w - 12, 2);
  // Tassels
  g.fillStyle(0x8d6e63);
  for (let x = 4; x < w; x += 6) {
    g.fillRect(x, 0, 2, 2);
    g.fillRect(x, h - 2, 2, 2);
  }

  g.generateTexture('welcome_mat', w, h);
  g.destroy();
}
