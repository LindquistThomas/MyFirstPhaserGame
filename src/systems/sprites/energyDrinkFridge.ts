import * as Phaser from 'phaser';

export function generateEnergyDrinkFridgeSprites(scene: Phaser.Scene): void {
  generateFridgeClosed(scene);
  generateFridgeOpen(scene);
}

/** Compact under-counter fridge, closed — 48 × 72 px. */
function generateFridgeClosed(scene: Phaser.Scene): void {
  const W = 48;
  const H = 72;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Body — brushed-steel grey
  g.fillStyle(0x8a9ba8, 1);
  g.fillRect(2, 0, W - 4, H - 2);

  // Outer border
  g.lineStyle(2, 0x3a4a55, 1);
  g.strokeRect(2, 0, W - 4, H - 2);

  // Left highlight stripe (sheen)
  g.fillStyle(0xb0c4cf, 0.6);
  g.fillRect(4, 2, 4, H - 6);

  // Glass window — upper ~40% of door
  g.fillStyle(0x1a3a5c, 0.9);
  g.fillRect(8, 4, W - 18, 24);
  g.lineStyle(1, 0x2a5a8c, 1);
  g.strokeRect(8, 4, W - 18, 24);

  // Can silhouettes visible through glass (3 narrow cans)
  const canColors = [0x00cc44, 0x0077ff, 0xff4400];
  for (let i = 0; i < 3; i++) {
    const cx = 10 + i * 9;
    g.fillStyle(canColors[i], 1);
    g.fillRect(cx, 7, 6, 16);
    // Can top highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(cx + 1, 7, 2, 4);
  }

  // Door panel below glass
  g.fillStyle(0x7a8c96, 1);
  g.fillRect(8, 30, W - 18, H - 34);
  g.lineStyle(1, 0x3a4a55, 0.5);
  g.strokeRect(8, 30, W - 18, H - 34);

  // Handle — right side vertical bar
  g.fillStyle(0x2a3a44, 1);
  g.fillRect(W - 11, 14, 4, 28);
  g.lineStyle(1, 0x4a5a66, 1);
  g.strokeRect(W - 11, 14, 4, 28);

  // Bottom base strip
  g.fillStyle(0x3a4a55, 1);
  g.fillRect(2, H - 4, W - 4, 4);

  // Top cap
  g.fillStyle(0x5a6a75, 1);
  g.fillRect(2, 0, W - 4, 3);

  g.generateTexture('fridge_closed', W, H);
  g.destroy();
}

/** Open fridge, door swung to the right — 64×72 px (wider for open door). */
function generateFridgeOpen(scene: Phaser.Scene): void {
  const W = 64;
  const H = 72;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Fridge interior — lit up neon green glow
  g.fillStyle(0x003310, 1);
  g.fillRect(2, 0, 40, H - 2);

  // Interior glow
  g.fillStyle(0x00ff66, 0.12);
  g.fillRect(2, 0, 40, H - 2);

  // Shelves
  g.fillStyle(0x1a5530, 1);
  g.fillRect(4, 22, 36, 2);
  g.fillRect(4, 46, 36, 2);

  // Cans on shelves
  const canColors = [0x00cc44, 0x0077ff, 0xff4400, 0xffcc00];
  for (let row = 0; row < 3; row++) {
    const shelfY = row === 0 ? 6 : row === 1 ? 26 : 50;
    for (let col = 0; col < 3; col++) {
      const cx = 5 + col * 12;
      const color = canColors[(row * 3 + col) % canColors.length];
      g.fillStyle(color, 1);
      g.fillRect(cx, shelfY, 9, 14);
      // Can shine
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(cx + 1, shelfY + 1, 3, 5);
    }
  }

  // Interior green ambient light on right wall
  g.fillStyle(0x00ff66, 0.18);
  g.fillRect(36, 0, 6, H - 2);

  // Outer fridge border
  g.lineStyle(2, 0x3a4a55, 1);
  g.strokeRect(2, 0, 40, H - 2);

  // Top cap
  g.fillStyle(0x5a6a75, 1);
  g.fillRect(2, 0, 40, 3);

  // Bottom base strip
  g.fillStyle(0x3a4a55, 1);
  g.fillRect(2, H - 4, 40, 4);

  // Open door — swung to the right, shown edge-on
  g.fillStyle(0x8a9ba8, 1);
  g.fillRect(42, 0, 8, H - 2);
  g.lineStyle(1, 0x3a4a55, 1);
  g.strokeRect(42, 0, 8, H - 2);

  // Door handle now on the right edge of the open door
  g.fillStyle(0x2a3a44, 1);
  g.fillRect(48, 14, 4, 28);

  // Green glow spill onto floor — 3 px wide strip below door
  g.fillStyle(0x00ff66, 0.25);
  g.fillRect(2, H - 2, 40, 2);

  g.generateTexture('fridge_open', W, H);
  g.destroy();
}
