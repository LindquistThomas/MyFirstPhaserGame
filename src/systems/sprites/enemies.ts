import * as Phaser from 'phaser';

/**
 * Procedural enemy sprite generation.
 *
 * Keeps the zero-image-asset convention. Each enemy is a single-frame
 * texture; animation (bob, squash) is driven by tweens in the entity.
 */
export function generateEnemySprites(scene: Phaser.Scene): void {
  generateSlimeSprite(scene);
  generateBureaucracyBotSprite(scene);
}

/** Green blob slime — 48×32. Simple Goomba analog. */
function generateSlimeSprite(scene: Phaser.Scene): void {
  const W = 48;
  const H = 32;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Body shadow
  g.fillStyle(0x14431f, 1);
  g.fillEllipse(W / 2, H - 4, W - 4, 10);

  // Main body
  g.fillStyle(0x3fa34d, 1);
  g.fillEllipse(W / 2, H / 2 + 4, W - 6, H - 8);

  // Top dome
  g.fillStyle(0x56c271, 1);
  g.fillEllipse(W / 2, H / 2, W - 14, H - 14);

  // Highlight
  g.fillStyle(0x98e0a4, 1);
  g.fillEllipse(W / 2 - 7, H / 2 - 2, 8, 5);

  // Eyes
  g.fillStyle(0xffffff, 1);
  g.fillCircle(W / 2 - 7, H / 2 + 3, 3);
  g.fillCircle(W / 2 + 7, H / 2 + 3, 3);
  g.fillStyle(0x111111, 1);
  g.fillCircle(W / 2 - 6, H / 2 + 3, 1.5);
  g.fillCircle(W / 2 + 8, H / 2 + 3, 1.5);

  // Mouth
  g.lineStyle(1.5, 0x14431f, 1);
  g.beginPath();
  g.moveTo(W / 2 - 4, H / 2 + 10);
  g.lineTo(W / 2 + 4, H / 2 + 10);
  g.strokePath();

  g.generateTexture('enemy_slime', W, H);
  g.destroy();
}

/** Boxy office-worker bot — 40×56. Clipboard, tie, blocky legs. */
function generateBureaucracyBotSprite(scene: Phaser.Scene): void {
  const W = 40;
  const H = 56;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Legs
  g.fillStyle(0x222233, 1);
  g.fillRect(8, H - 14, 8, 14);
  g.fillRect(W - 16, H - 14, 8, 14);

  // Shoes
  g.fillStyle(0x0a0a0a, 1);
  g.fillRect(6, H - 4, 12, 4);
  g.fillRect(W - 18, H - 4, 12, 4);

  // Torso (suit)
  g.fillStyle(0x3a3a55, 1);
  g.fillRect(6, 20, W - 12, H - 34);
  // Suit shadow
  g.fillStyle(0x2a2a44, 1);
  g.fillRect(W - 10, 20, 4, H - 34);

  // Collar / shirt
  g.fillStyle(0xdddde6, 1);
  g.fillRect(14, 20, W - 28, 6);

  // Tie (red — bureaucracy)
  g.fillStyle(0xcc3333, 1);
  g.fillRect(W / 2 - 2, 22, 4, 14);

  // Head
  g.fillStyle(0xe5c7a8, 1);
  g.fillRect(10, 4, W - 20, 16);
  // Hair
  g.fillStyle(0x2a1f18, 1);
  g.fillRect(10, 4, W - 20, 4);

  // Eyes (angry)
  g.fillStyle(0x111111, 1);
  g.fillRect(14, 12, 3, 2);
  g.fillRect(W - 17, 12, 3, 2);
  // Frown
  g.lineStyle(1.5, 0x5a3b2b, 1);
  g.beginPath();
  g.moveTo(15, 18);
  g.lineTo(W - 15, 18);
  g.strokePath();

  // Clipboard in hand
  g.fillStyle(0xb88a4a, 1);
  g.fillRect(W - 8, 28, 8, 14);
  g.fillStyle(0xf5f1e0, 1);
  g.fillRect(W - 7, 30, 6, 10);
  g.fillStyle(0x555566, 1);
  g.fillRect(W - 6, 31, 4, 1);
  g.fillRect(W - 6, 33, 4, 1);
  g.fillRect(W - 6, 35, 4, 1);

  g.generateTexture('enemy_bot', W, H);
  g.destroy();
}
