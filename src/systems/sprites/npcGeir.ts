import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/**
 * Side-view pixel-art NPC: **Geir Harald**.
 *
 * Single-frame spritesheet on the same 16 × 40 logical grid as the player
 * (scale 4 → 64 × 160 px), so if we ever animate him the frame geometry
 * lines up with the player's.
 *
 * Visual identity: gray-haired, handsome executive in a dark charcoal
 * suit with a crisp white shirt and navy silk tie. Static upright idle.
 */
export function generateGeirSprite(scene: Phaser.Scene): void {
  const W = 64;
  const H = 128;
  const FRAMES = 2;

  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const S = 4;
  const px = (f: number, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(f * W + x * S, y * S, w * S, h * S);
  };

  // Palette
  const HAIR = '#b8b8b8';
  const HAIR_SH = '#9a9a9a';
  const TEMPLE = '#d0d0d0';
  const SKIN = '#f1c3a0';
  const SKIN_SH = '#d9a98a';
  const JACKET = '#2b2f3a';
  const JACKET_SH = '#1f2330';
  const LAPEL = '#3a3f4f';
  const SHIRT_WHITE = '#eaeef5';
  const TIE = '#1f3a6b';
  const TIE_SH = '#15284a';
  const PANTS = '#1e2230';
  const PANTS_SH = '#141827';
  const SHOE = '#0a0a0a';
  const OUTLINE = '#1a1a1a';
  const EYE_W = theme.color.css.textWhite;
  const MOUTH = '#7a4638';

  // Draw one frame. `swap` swaps the leg shading so it reads as a walk cycle.
  const drawFrame = (f: number, swap: boolean) => {
    const by = 0;
    // Hair — gray with silver temples and a darker crown shadow.
    px(f, 5, 0 + by, 6, 2, HAIR);
    px(f, 5, 1 + by, 1, 2, TEMPLE);
    px(f, 10, 1 + by, 1, 2, TEMPLE);
    px(f, 6, 0 + by, 4, 1, HAIR_SH);

    // Face
    px(f, 6, 2 + by, 5, 6, SKIN);
    px(f, 11, 4 + by, 1, 2, SKIN_SH);
    px(f, 6, 7 + by, 5, 1, SKIN_SH);
    px(f, 8, 3 + by, 2, 1, HAIR_SH);
    px(f, 8, 4 + by, 2, 1, EYE_W);
    px(f, 9, 4 + by, 1, 1, OUTLINE);
    px(f, 9, 6 + by, 2, 1, MOUTH);
    px(f, 7, 8 + by, 3, 1, SKIN_SH);

    // Jacket torso
    px(f, 5, 9 + by, 6, 10, JACKET);
    px(f, 6, 9 + by, 1, 4, LAPEL);
    px(f, 10, 9 + by, 1, 4, LAPEL);
    px(f, 7, 9 + by, 3, 3, SHIRT_WHITE);
    px(f, 8, 12 + by, 1, 1, SHIRT_WHITE);
    px(f, 8, 10 + by, 2, 2, TIE);
    px(f, 9, 12 + by, 1, 5, TIE);
    px(f, 8, 15 + by, 2, 2, TIE_SH);
    px(f, 7, 14 + by, 1, 5, JACKET_SH);
    px(f, 5, 19 + by, 6, 1, OUTLINE);

    // Arms at sides.
    px(f, 4, 10 + by, 2, 6, JACKET);
    px(f, 4, 16 + by, 2, 2, JACKET_SH);
    px(f, 4, 18 + by, 2, 1, SKIN_SH);
    px(f, 11, 10 + by, 2, 6, JACKET);
    px(f, 11, 16 + by, 2, 2, JACKET_SH);
    px(f, 11, 18 + by, 2, 1, SKIN);

    // Legs + shoes — swap shading to animate a walk cycle.
    const legY = 20;
    const legLen = 10;
    const backPants = swap ? PANTS : PANTS_SH;
    const frontPants = swap ? PANTS_SH : PANTS;
    px(f, 5, legY, 3, legLen, backPants);
    px(f, 4, legY + legLen, 4, 2, SHOE);
    px(f, 8, legY, 3, legLen, frontPants);
    px(f, 8, legY + legLen, 4, 2, SHOE);
  };

  drawFrame(0, false);
  drawFrame(1, true);

  scene.textures.addSpriteSheet(
    'npc_geir',
    canvas as unknown as HTMLImageElement,
    { frameWidth: W, frameHeight: H },
  );

  // Register a two-frame idle-walk animation. Scenes call sprite.play('geir_walk').
  if (!scene.anims.exists('geir_walk')) {
    scene.anims.create({
      key: 'geir_walk',
      frames: scene.anims.generateFrameNumbers('npc_geir', { start: 0, end: 1 }),
      frameRate: 4,
      repeat: -1,
    });
  }
}
