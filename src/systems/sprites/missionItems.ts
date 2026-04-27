import * as Phaser from 'phaser';

/**
 * Procedural sprites for Die Hard mission items: pistol, key card,
 * bomb deactivation code pad, and the bomb device itself.
 */
export function generateMissionItemSprites(scene: Phaser.Scene): void {
  generatePistolSprite(scene);
  generateKeycardSprite(scene);
  generateBombCodeSprite(scene);
  generateBombDeviceSprite(scene);
}

/** Dark-grey handgun — 32×20. */
function generatePistolSprite(scene: Phaser.Scene): void {
  const W = 32;
  const H = 20;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Barrel
  g.fillStyle(0x3a3a3a, 1);
  g.fillRect(12, 2, 18, 6);
  // Barrel highlight
  g.fillStyle(0x555555, 1);
  g.fillRect(14, 3, 14, 2);

  // Receiver
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(8, 6, 16, 6);

  // Grip
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(8, 12, 8, 8);
  // Grip texture
  g.fillStyle(0x333333, 1);
  g.fillRect(9, 13, 2, 6);
  g.fillRect(12, 13, 2, 6);

  // Trigger guard
  g.lineStyle(1, 0x2a2a2a, 1);
  g.beginPath();
  g.moveTo(16, 12);
  g.lineTo(18, 16);
  g.lineTo(16, 16);
  g.strokePath();

  // Muzzle
  g.fillStyle(0x111111, 1);
  g.fillRect(30, 3, 2, 4);

  g.generateTexture('item_pistol', W, H);
  g.destroy();
}

/** Small security access card — 28×18. */
function generateKeycardSprite(scene: Phaser.Scene): void {
  const W = 28;
  const H = 18;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Card body
  g.fillStyle(0xe8e8f0, 1);
  g.fillRoundedRect(0, 0, W, H, 2);

  // Magnetic stripe
  g.fillStyle(0x222233, 1);
  g.fillRect(0, 12, W, 3);

  // Access chip
  g.fillStyle(0xffd700, 1);
  g.fillRect(3, 3, 8, 6);
  g.fillStyle(0xe8b800, 1);
  g.fillRect(4, 4, 6, 4);

  // "ACCESS" text placeholder dots
  g.fillStyle(0x666688, 1);
  for (let i = 0; i < 5; i++) {
    g.fillRect(14 + i * 3, 5, 2, 2);
  }

  // Red LED indicator
  g.fillStyle(0xff3333, 1);
  g.fillCircle(24, 4, 1.5);

  g.generateTexture('item_keycard', W, H);
  g.destroy();
}

/** Green data pad with code readout — 24×28. */
function generateBombCodeSprite(scene: Phaser.Scene): void {
  const W = 24;
  const H = 28;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Pad body
  g.fillStyle(0x2a3a2a, 1);
  g.fillRoundedRect(0, 0, W, H, 2);

  // Screen
  g.fillStyle(0x0a1a0a, 1);
  g.fillRect(3, 3, W - 6, 14);

  // Green code lines on screen
  g.fillStyle(0x33ff33, 1);
  g.fillRect(5, 5, 10, 2);
  g.fillRect(5, 9, 14, 2);
  g.fillRect(5, 13, 8, 2);

  // Blinking cursor
  g.fillStyle(0x66ff66, 0.8);
  g.fillRect(16, 13, 2, 2);

  // Buttons below screen
  g.fillStyle(0x444a44, 1);
  g.fillRect(4, 20, 4, 3);
  g.fillRect(10, 20, 4, 3);
  g.fillRect(16, 20, 4, 3);

  g.generateTexture('item_bomb_code', W, H);
  g.destroy();
}

/** Bomb device with timer display — 36×28. */
function generateBombDeviceSprite(scene: Phaser.Scene): void {
  const W = 36;
  const H = 28;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Main casing
  g.fillStyle(0x3a2a1a, 1);
  g.fillRoundedRect(0, 4, W, H - 4, 3);

  // Timer display (red digits)
  g.fillStyle(0x0a0a0a, 1);
  g.fillRect(4, 8, 16, 10);
  g.fillStyle(0xff2222, 1);
  g.fillRect(6, 10, 4, 6);
  g.fillRect(12, 10, 4, 6);
  // Colon
  g.fillStyle(0xff2222, 0.8);
  g.fillCircle(11, 12, 1);
  g.fillCircle(11, 15, 1);

  // Wires
  g.lineStyle(2, 0xff3333, 1);
  g.beginPath();
  g.moveTo(22, 10);
  g.lineTo(28, 6);
  g.lineTo(32, 8);
  g.strokePath();

  g.lineStyle(2, 0x3333ff, 1);
  g.beginPath();
  g.moveTo(22, 14);
  g.lineTo(30, 14);
  g.lineTo(34, 12);
  g.strokePath();

  g.lineStyle(2, 0x33ff33, 1);
  g.beginPath();
  g.moveTo(22, 18);
  g.lineTo(28, 22);
  g.lineTo(34, 20);
  g.strokePath();

  // Warning light
  g.fillStyle(0xff0000, 1);
  g.fillCircle(30, 22, 2.5);
  g.fillStyle(0xff6666, 0.6);
  g.fillCircle(29, 21, 1);

  // Top antenna/detonator
  g.fillStyle(0x555555, 1);
  g.fillRect(16, 0, 4, 6);
  g.fillCircle(18, 0, 3);

  g.generateTexture('bomb_device', W, H);
  g.destroy();
}
