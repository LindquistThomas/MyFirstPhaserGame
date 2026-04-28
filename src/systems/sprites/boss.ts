import * as Phaser from 'phaser';

/**
 * Procedural sprite generation for boss-fight and hostage-rescue entities.
 *
 * Keeps the zero-image-asset convention. All textures are single-frame;
 * animation (phase tints, squash, etc.) is driven by tweens in the entities.
 */
export function generateBossSprites(scene: Phaser.Scene): void {
  generateCEOBossSprite(scene);
  generateCEOBossHitSprite(scene);
  generateMugProjectileSprite(scene);
  generateBriefcaseProjectileSprite(scene);
  generateTerroristCommanderSprite(scene);
  generateItemPistolSprite(scene);
  generateItemKeycardSprite(scene);
  generateItemBombCodeSprite(scene);
  generateBombDeviceSprite(scene);
  generateSanctumDoorLockedSprite(scene);
  generateSanctumDoorOpenSprite(scene);
}

/** CEO boss: bald, dark suit, open collar, slim frame — 48×64. */
function generateCEOBossSprite(scene: Phaser.Scene): void {
  const W = 48;
  const H = 64;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Legs
  g.fillStyle(0x111122, 1);
  g.fillRect(10, H - 14, 9, 14);
  g.fillRect(W - 19, H - 14, 9, 14);
  // Shoes
  g.fillStyle(0x080808, 1);
  g.fillRect(8, H - 4, 13, 4);
  g.fillRect(W - 21, H - 4, 13, 4);

  // Trouser crease
  g.fillStyle(0x1a1a30, 1);
  g.fillRect(10, H - 20, 9, 6);
  g.fillRect(W - 19, H - 20, 9, 6);

  // Suit jacket — charcoal
  g.fillStyle(0x1e1e2e, 1);
  g.fillRect(7, 22, W - 14, H - 36);
  // Jacket shadow (right side)
  g.fillStyle(0x141420, 1);
  g.fillRect(W - 12, 22, 5, H - 36);
  // Shirt / collar (open, no tie)
  g.fillStyle(0xe0e0f0, 1);
  g.fillRect(16, 22, W - 32, 8);
  // Open V collar
  g.fillStyle(0x1e1e2e, 1);
  g.fillTriangle(W / 2 - 3, 22, W / 2 + 3, 22, W / 2, 30);

  // Pocket square (gold) — boss detail
  g.fillStyle(0xffd700, 1);
  g.fillRect(8, 26, 5, 4);

  // Bald head — warm skin tone
  g.fillStyle(0xd4a574, 1);
  g.fillRoundedRect(12, 4, W - 24, 18, 5);
  // Head sheen (bald reflection)
  g.fillStyle(0xe8c090, 0.8);
  g.fillEllipse(W / 2 - 4, 9, 8, 5);

  // Eyes — sharp, confident
  g.fillStyle(0x0a0a0a, 1);
  g.fillRect(15, 13, 4, 3);
  g.fillRect(W - 19, 13, 4, 3);
  // Brow — arched upward (confident)
  g.lineStyle(2, 0x6b4a2a, 1);
  g.beginPath();
  g.moveTo(14, 11);
  g.lineTo(20, 9);
  g.strokePath();
  g.beginPath();
  g.moveTo(W - 14, 11);
  g.lineTo(W - 20, 9);
  g.strokePath();

  // Slight smile (charismatic) — approximate with a short arc
  g.lineStyle(1.5, 0x8a5a3a, 1);
  g.beginPath();
  g.moveTo(W / 2 - 5, 19);
  g.lineTo(W / 2, 21);
  g.lineTo(W / 2 + 5, 19);
  g.strokePath();

  // Briefcase in right hand
  g.fillStyle(0x5a4a3a, 1);
  g.fillRect(W - 8, 34, 8, 10);
  g.fillStyle(0x8a7a6a, 1);
  g.fillRect(W - 7, 33, 6, 2);
  g.fillStyle(0xc0a060, 1);
  g.fillRect(W - 6, 38, 4, 2);

  g.generateTexture('boss_ceo', W, H);
  g.destroy();
}

/** White-flash i-frame variant — same shape, pure white fill. */
function generateCEOBossHitSprite(scene: Phaser.Scene): void {
  const W = 48;
  const H = 64;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(7, 4, W - 14, H - 4, 3);
  g.generateTexture('boss_ceo_hit', W, H);
  g.destroy();
}

/** Coffee mug projectile — 16×16, brown with steam wisps. */
function generateMugProjectileSprite(scene: Phaser.Scene): void {
  const W = 16;
  const H = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Mug body
  g.fillStyle(0x7b4e2a, 1);
  g.fillRect(3, 5, 10, 9);
  // Handle
  g.lineStyle(2, 0x7b4e2a, 1);
  g.beginPath();
  g.arc(13, 9, 3, -Math.PI / 2, Math.PI / 2);
  g.strokePath();
  // Coffee surface (dark)
  g.fillStyle(0x3d1e0c, 1);
  g.fillRect(4, 5, 8, 2);
  // Steam wisps
  g.lineStyle(1.5, 0xffffff, 0.7);
  g.beginPath(); g.moveTo(6, 4); g.lineTo(5, 1); g.strokePath();
  g.beginPath(); g.moveTo(9, 3); g.lineTo(10, 0); g.strokePath();

  g.generateTexture('mug_projectile', W, H);
  g.destroy();
}

/** Briefcase projectile — 24×16, grey leather. */
function generateBriefcaseProjectileSprite(scene: Phaser.Scene): void {
  const W = 24;
  const H = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Body
  g.fillStyle(0x7a7a8a, 1);
  g.fillRoundedRect(1, 3, W - 2, H - 4, 2);
  // Shadow edge
  g.fillStyle(0x4a4a5a, 1);
  g.fillRect(W - 5, 3, 4, H - 4);
  // Handle
  g.fillStyle(0x5a5a6a, 1);
  g.fillRect(8, 1, 8, 3);
  // Clasp
  g.fillStyle(0xc0a040, 1);
  g.fillRect(W / 2 - 2, H / 2 - 1, 4, 3);

  g.generateTexture('briefcase_projectile', W, H);
  g.destroy();
}

/** Terrorist Commander — armored, 40×56. Distinct from existing enemies. */
function generateTerroristCommanderSprite(scene: Phaser.Scene): void {
  const W = 40;
  const H = 56;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Boots
  g.fillStyle(0x1a1208, 1);
  g.fillRect(6, H - 8, 10, 8);
  g.fillRect(W - 16, H - 8, 10, 8);
  // Combat trousers
  g.fillStyle(0x2a3018, 1);
  g.fillRect(7, H - 22, 10, 14);
  g.fillRect(W - 17, H - 22, 10, 14);
  // Cargo pockets
  g.fillStyle(0x222814, 1);
  g.fillRect(8, H - 18, 6, 5);
  g.fillRect(W - 14, H - 18, 6, 5);
  // Tactical vest
  g.fillStyle(0x3a3a2a, 1);
  g.fillRect(5, 22, W - 10, H - 44);
  // Vest straps / pouches
  g.fillStyle(0x282818, 1);
  g.fillRect(6, 24, 6, 8);
  g.fillRect(W - 12, 24, 6, 8);
  // Red armband
  g.fillStyle(0xcc2222, 1);
  g.fillRect(4, 30, 5, 4);

  // Arms
  g.fillStyle(0x2a3018, 1);
  g.fillRect(2, 24, 5, 14);
  g.fillRect(W - 7, 24, 5, 14);
  // Gloves
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(2, 38, 5, 4);
  g.fillRect(W - 7, 38, 5, 4);

  // Head (balaclava — dark)
  g.fillStyle(0x222222, 1);
  g.fillRoundedRect(10, 6, W - 20, 16, 4);
  // Eyes (menacing narrow slits)
  g.fillStyle(0xcc2222, 1);
  g.fillRect(14, 12, 4, 2);
  g.fillRect(W - 18, 12, 4, 2);

  // Weapon (rifle silhouette)
  g.fillStyle(0x0a0a0a, 1);
  g.fillRect(W - 4, 20, 4, 18);
  g.fillRect(W - 2, 18, 2, 4);

  g.generateTexture('enemy_terrorist', W, H);
  g.destroy();
}

/** Pistol mission item — 16×16 pixel gun. */
function generateItemPistolSprite(scene: Phaser.Scene): void {
  const W = 16;
  const H = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Barrel
  g.fillStyle(0x888888, 1);
  g.fillRect(8, 6, 7, 3);
  // Slide
  g.fillStyle(0x666666, 1);
  g.fillRect(5, 5, 8, 4);
  // Grip
  g.fillStyle(0x4a3a2a, 1);
  g.fillRect(6, 9, 5, 6);
  // Trigger guard
  g.lineStyle(1, 0x666666, 1);
  g.beginPath();
  g.moveTo(7, 9);
  g.lineTo(9, 13);
  g.lineTo(11, 9);
  g.strokePath();
  // Sight
  g.fillStyle(0xcccccc, 1);
  g.fillRect(12, 4, 2, 2);

  g.generateTexture('item_pistol', W, H);
  g.destroy();
}

/** Security key card mission item — 16×12 glowing card. */
function generateItemKeycardSprite(scene: Phaser.Scene): void {
  const W = 16;
  const H = 12;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Card body
  g.fillStyle(0x2266cc, 1);
  g.fillRoundedRect(1, 1, W - 2, H - 2, 2);
  // Chip
  g.fillStyle(0xffd700, 1);
  g.fillRect(3, 3, 5, 4);
  // Chip lines
  g.lineStyle(0.5, 0x8a6a00, 1);
  g.beginPath(); g.moveTo(4, 4); g.lineTo(4, 6); g.strokePath();
  g.beginPath(); g.moveTo(6, 4); g.lineTo(6, 6); g.strokePath();
  // Text stripe
  g.fillStyle(0x4488ee, 1);
  g.fillRect(10, 3, 4, 2);
  g.fillRect(10, 6, 4, 2);
  // Glow edge
  g.lineStyle(1, 0x88bbff, 0.8);
  g.strokeRoundedRect(0, 0, W, H, 2);

  g.generateTexture('item_keycard', W, H);
  g.destroy();
}

/** Bomb deactivation code — 16×16 green data pad. */
function generateItemBombCodeSprite(scene: Phaser.Scene): void {
  const W = 16;
  const H = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Device body
  g.fillStyle(0x1a2a1a, 1);
  g.fillRoundedRect(1, 1, W - 2, H - 2, 2);
  // Screen
  g.fillStyle(0x004400, 1);
  g.fillRect(3, 3, 10, 7);
  // Screen glow
  g.fillStyle(0x00ff44, 0.9);
  g.fillRect(4, 4, 3, 1);
  g.fillRect(4, 6, 5, 1);
  g.fillRect(4, 8, 4, 1);
  // Buttons row
  g.fillStyle(0x446644, 1);
  g.fillRect(3, 12, 3, 2);
  g.fillRect(7, 12, 3, 2);
  g.fillRect(11, 12, 3, 2);

  g.generateTexture('item_bomb_code', W, H);
  g.destroy();
}

/** Bomb device — 24×24 red blinking explosive. */
function generateBombDeviceSprite(scene: Phaser.Scene): void {
  const W = 24;
  const H = 24;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Main body (cylindrical top view)
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(W / 2, H / 2 + 2, 10);
  // Casing
  g.fillStyle(0x333333, 1);
  g.fillCircle(W / 2, H / 2 + 2, 8);
  // Warning stripes
  g.fillStyle(0xffcc00, 1);
  g.fillRect(4, H / 2, 16, 3);
  // Red blink light
  g.fillStyle(0xff2222, 1);
  g.fillCircle(W / 2, 4, 3);
  // Wires
  g.lineStyle(1.5, 0xcc4444, 1);
  g.beginPath(); g.moveTo(W / 2 - 3, 7); g.lineTo(W / 2 - 6, 12); g.strokePath();
  g.lineStyle(1.5, 0x4444cc, 1);
  g.beginPath(); g.moveTo(W / 2 + 3, 7); g.lineTo(W / 2 + 6, 12); g.strokePath();

  g.generateTexture('bomb_device', W, H);
  g.destroy();
}

/** Sanctum door — locked, 32×48. Gate with red padlock overlay. */
function generateSanctumDoorLockedSprite(scene: Phaser.Scene): void {
  const W = 32;
  const H = 48;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Frame
  g.fillStyle(0x4a3a2a, 1);
  g.fillRect(0, 0, W, H);
  // Inner panel (dark)
  g.fillStyle(0x0a0a12, 1);
  g.fillRect(3, 3, W - 6, H - 6);
  // Frame centre split
  g.fillStyle(0x4a3a2a, 1);
  g.fillRect(W / 2 - 1, 0, 2, H);
  // Padlock
  g.fillStyle(0xcc2222, 1);
  g.fillRect(W / 2 - 5, H / 2 - 6, 10, 8);
  g.lineStyle(2, 0xcc2222, 1);
  g.beginPath();
  g.arc(W / 2, H / 2 - 6, 4, Math.PI, 0);
  g.strokePath();
  // Keyhole
  g.fillStyle(0x880000, 1);
  g.fillCircle(W / 2, H / 2 - 2, 2);
  g.fillRect(W / 2 - 1, H / 2 - 2, 2, 4);

  g.generateTexture('door_sanctum_locked', W, H);
  g.destroy();
}

/** Sanctum door — open, 32×48. Panel swung aside revealing dark doorway. */
function generateSanctumDoorOpenSprite(scene: Phaser.Scene): void {
  const W = 32;
  const H = 48;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Frame
  g.fillStyle(0x4a3a2a, 1);
  g.fillRect(0, 0, W, H);
  // Dark doorway
  g.fillStyle(0x0a0a12, 1);
  g.fillRect(3, 3, W - 6, H - 6);
  // Swung panel (left side, ~40% width)
  const pw = Math.floor((W - 6) * 0.4);
  g.fillStyle(0x6a5a4a, 1);
  g.fillRect(3, 3, pw, H - 6);
  g.fillStyle(0x4a3a2a, 1);
  g.fillRect(3 + pw - 1, 3, 1, H - 6);
  // Gold glow on threshold
  g.fillStyle(0xffd700, 0.5);
  g.fillRect(3 + pw, 3, 2, H - 6);

  g.generateTexture('door_sanctum_open', W, H);
  g.destroy();
}
