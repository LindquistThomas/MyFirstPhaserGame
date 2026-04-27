import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/**
 * Procedural enemy sprite generation.
 *
 * Keeps the zero-image-asset convention. Each enemy is a single-frame
 * texture; animation (bob, squash) is driven by tweens in the entity.
 */
export function generateEnemySprites(scene: Phaser.Scene): void {
  generateSlimeSprite(scene);
  generateBureaucracyBotSprite(scene);
  generateScopeCreepSprite(scene);
  generateArchitectureAstronautSprite(scene);
  generateTechDebtGhostSprite(scene);
  generateTerroristCommanderSprite(scene);
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
  g.fillStyle(theme.color.floor.products.platform, 1);
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

/** Amber scope-creep blob — 68×44. Larger, uglier cousin of the slime. */
function generateScopeCreepSprite(scene: Phaser.Scene): void {
  const W = 68;
  const H = 44;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0x4a2a08, 1);
  g.fillEllipse(W / 2, H - 5, W - 6, 12);

  g.fillStyle(0xc96a1a, 1);
  g.fillEllipse(W / 2, H / 2 + 4, W - 8, H - 10);

  g.fillStyle(0xe48a2c, 1);
  g.fillEllipse(W / 2, H / 2, W - 18, H - 16);

  g.fillStyle(0xf4b060, 1);
  g.fillEllipse(W / 2 - 10, H / 2 - 4, 10, 6);

  // Creeping blob lumps around the silhouette
  g.fillStyle(0xd07a22, 1);
  g.fillCircle(10, H - 10, 6);
  g.fillCircle(W - 12, H - 10, 7);
  g.fillCircle(W - 20, H - 14, 5);

  // Eyes (angrier than a slime: oval + heavy brow)
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(W / 2 - 10, H / 2 + 3, 7, 5);
  g.fillEllipse(W / 2 + 10, H / 2 + 3, 7, 5);
  g.fillStyle(0x1a0f05, 1);
  g.fillCircle(W / 2 - 9, H / 2 + 4, 2);
  g.fillCircle(W / 2 + 11, H / 2 + 4, 2);
  g.lineStyle(2, 0x4a2a08, 1);
  g.beginPath();
  g.moveTo(W / 2 - 15, H / 2 - 3);
  g.lineTo(W / 2 - 5, H / 2 + 1);
  g.strokePath();
  g.beginPath();
  g.moveTo(W / 2 + 15, H / 2 - 3);
  g.lineTo(W / 2 + 5, H / 2 + 1);
  g.strokePath();

  // Scowl
  g.lineStyle(2, 0x2a1a05, 1);
  g.beginPath();
  g.moveTo(W / 2 - 6, H / 2 + 13);
  g.lineTo(W / 2 + 6, H / 2 + 13);
  g.strokePath();

  g.generateTexture('enemy_scope_creep', W, H);
  g.destroy();
}

/** Helmeted hovering astronaut — 40×48. */
function generateArchitectureAstronautSprite(scene: Phaser.Scene): void {
  const W = 40;
  const H = 48;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Body / suit
  g.fillStyle(0xe8eef5, 1);
  g.fillRoundedRect(8, 18, W - 16, H - 24, 4);
  g.fillStyle(0xb8c2d0, 1);
  g.fillRect(W - 12, 18, 4, H - 24);

  // Belt
  g.fillStyle(0x6a7080, 1);
  g.fillRect(8, 30, W - 16, 3);

  // Chest control panel
  g.fillStyle(0x1a2238, 1);
  g.fillRect(13, 22, 14, 6);
  g.fillStyle(0xffb347, 1).fillRect(14, 23, 2, 2);
  g.fillStyle(0x4fc3f7, 1).fillRect(18, 23, 2, 2);
  g.fillStyle(0x81c784, 1).fillRect(22, 23, 2, 2);

  // Arms
  g.fillStyle(0xe8eef5, 1);
  g.fillRect(4, 20, 5, 12);
  g.fillRect(W - 9, 20, 5, 12);
  g.fillStyle(0xffd77a, 1); // amber gloves
  g.fillRect(4, 32, 5, 3);
  g.fillRect(W - 9, 32, 5, 3);

  // Boots dangle (no floor — he's floating)
  g.fillStyle(0x3a3a4a, 1);
  g.fillRect(12, H - 4, 6, 4);
  g.fillRect(W - 18, H - 4, 6, 4);

  // Helmet base
  g.fillStyle(0xdfe6ee, 1);
  g.fillCircle(W / 2, 14, 12);
  // Visor
  g.fillStyle(0x0a1a2a, 1);
  g.fillEllipse(W / 2, 14, 16, 12);
  g.fillStyle(0x5a8acc, 0.65);
  g.fillEllipse(W / 2 - 2, 12, 10, 6);
  // Visor glint
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(W / 2 - 4, 11, 1.8);

  // Antenna
  g.lineStyle(1.5, 0x888888, 1);
  g.beginPath();
  g.moveTo(W / 2 + 8, 6);
  g.lineTo(W / 2 + 12, 1);
  g.strokePath();
  g.fillStyle(0xff5555, 1);
  g.fillCircle(W / 2 + 12, 1, 1.5);

  // Backpack tube
  g.fillStyle(0xb8c2d0, 1);
  g.fillRect(2, 22, 4, 10);

  g.generateTexture('enemy_astronaut', W, H);
  g.destroy();
}

/** Translucent wraith trailing `// TODO` — 44×40. */
function generateTechDebtGhostSprite(scene: Phaser.Scene): void {
  const W = 44;
  const H = 40;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Wispy tail
  g.fillStyle(0x6b78a8, 0.55);
  for (let i = 0; i < 3; i++) {
    const wx = 4 + i * 6;
    g.fillTriangle(wx, H - 4, wx + 6, H - 4, wx + 3, H - 14 - i * 2);
  }

  // Body (cloud blob)
  g.fillStyle(0x8f9cc8, 0.85);
  g.fillEllipse(W / 2, H / 2, W - 6, H - 12);

  // Highlight
  g.fillStyle(0xcdd4ee, 0.7);
  g.fillEllipse(W / 2 - 6, H / 2 - 4, 12, 6);

  // Eyes — hollow sockets
  g.fillStyle(0x0a0f1e, 1);
  g.fillEllipse(W / 2 - 7, H / 2 - 1, 6, 8);
  g.fillEllipse(W / 2 + 7, H / 2 - 1, 6, 8);
  g.fillStyle(0xffe6ff, 0.9);
  g.fillCircle(W / 2 - 7, H / 2 - 2, 1.5);
  g.fillCircle(W / 2 + 7, H / 2 - 2, 1.5);

  // Jagged mouth
  g.lineStyle(1.5, 0x0a0f1e, 1);
  g.beginPath();
  g.moveTo(W / 2 - 6, H / 2 + 7);
  g.lineTo(W / 2 - 3, H / 2 + 10);
  g.lineTo(W / 2, H / 2 + 7);
  g.lineTo(W / 2 + 3, H / 2 + 10);
  g.lineTo(W / 2 + 6, H / 2 + 7);
  g.strokePath();

  // "// TODO" tag
  g.fillStyle(0xffe6ff, 0.9);
  g.fillRect(W / 2 - 10, 3, 20, 6);
  g.fillStyle(0x4a3a8a, 1);
  g.fillRect(W / 2 - 8, 5, 2, 2);
  g.fillRect(W / 2 - 5, 5, 2, 2);
  g.fillRect(W / 2 - 2, 5, 2, 2);
  g.fillRect(W / 2 + 1, 5, 2, 2);
  g.fillRect(W / 2 + 4, 5, 2, 2);

  g.generateTexture('enemy_tech_debt_ghost', W, H);
  g.destroy();
}

/**
 * Terrorist Commander — armored hostile with balaclava and weapon.
 * 44×58. Non-stompable boss enemy for the Executive Suite hostage rescue.
 */
function generateTerroristCommanderSprite(scene: Phaser.Scene): void {
  const W = 44;
  const H = 58;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Legs (dark tactical trousers)
  g.fillStyle(0x1a1a22, 1);
  g.fillRect(10, H - 16, 8, 16);
  g.fillRect(W - 18, H - 16, 8, 16);

  // Combat boots
  g.fillStyle(0x0a0a0a, 1);
  g.fillRect(8, H - 4, 12, 4);
  g.fillRect(W - 20, H - 4, 12, 4);

  // Torso (dark tactical vest)
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(8, 20, W - 16, H - 36);
  // Vest plate
  g.fillStyle(0x333344, 1);
  g.fillRect(12, 22, W - 24, 10);
  // Vest pouches
  g.fillStyle(0x222233, 1);
  g.fillRect(12, 34, 6, 4);
  g.fillRect(W - 18, 34, 6, 4);

  // Arms
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(4, 22, 6, 14);
  g.fillRect(W - 10, 22, 6, 14);
  // Gloves
  g.fillStyle(0x111111, 1);
  g.fillRect(4, 36, 6, 3);
  g.fillRect(W - 10, 36, 6, 3);

  // Head (balaclava)
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(W / 2, 14, 12);

  // Eye slit
  g.fillStyle(0x333333, 1);
  g.fillRect(W / 2 - 8, 12, 16, 4);
  // Eyes (menacing)
  g.fillStyle(0xff3333, 0.8);
  g.fillCircle(W / 2 - 4, 13, 2);
  g.fillCircle(W / 2 + 4, 13, 2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(W / 2 - 4, 12.5, 0.8);
  g.fillCircle(W / 2 + 4, 12.5, 0.8);

  // Weapon in right hand (held at hip level)
  g.fillStyle(0x3a3a3a, 1);
  g.fillRect(W - 8, 30, 10, 4);
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(W - 4, 34, 4, 6);

  // Red armband (identifying mark)
  g.fillStyle(0xcc2222, 1);
  g.fillRect(4, 24, 6, 3);

  g.generateTexture('enemy_terrorist', W, H);
  g.destroy();
}
