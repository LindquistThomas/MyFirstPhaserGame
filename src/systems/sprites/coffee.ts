import * as Phaser from 'phaser';

export function generateCoffeeSprites(scene: Phaser.Scene): void {
  generateCoffeeMug(scene);
  generateCoffeeSteam(scene);
}

function generateCoffeeMug(scene: Phaser.Scene): void {
  const W = 40;
  const H = 40;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.lineStyle(4, 0x4a2b1a, 1);
  g.beginPath();
  g.arc(29, 22, 7, -Math.PI / 2, Math.PI / 2, false);
  g.strokePath();

  g.fillStyle(0x6b3b23, 1);
  g.fillRoundedRect(10, 14, 20, 20, 3);

  g.fillStyle(0x8a4f33, 1);
  g.fillRect(12, 16, 2, 16);

  g.fillStyle(0x3a1e10, 1);
  g.fillRect(10, 14, 20, 3);

  g.fillStyle(0x2a1608, 1);
  g.fillRect(11, 15, 18, 2);
  g.fillStyle(0xc9a27a, 1);
  g.fillRect(12, 15, 16, 1);

  g.fillStyle(0x5a2f1c, 1);
  g.fillRect(7, 34, 26, 2);
  g.fillStyle(0x3a1e10, 1);
  g.fillRect(7, 36, 26, 1);

  g.generateTexture('coffee_mug', W, H);
  g.destroy();
}

function generateCoffeeSteam(scene: Phaser.Scene): void {
  const R = 22;
  const D = R * 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0xffffff, 0.18);
  g.fillCircle(R, R, R);
  g.fillStyle(0xffffff, 0.28);
  g.fillCircle(R, R, R - 7);
  g.fillStyle(0xffffff, 0.45);
  g.fillCircle(R, R, R - 13);

  g.generateTexture('coffee_steam', D, D);
  g.destroy();
}
