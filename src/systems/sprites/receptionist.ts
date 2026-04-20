import * as Phaser from 'phaser';

/**
 * Seated receptionist NPC for the elevator-scene lobby.
 *
 * Single static frame (no walk cycle) — she stays behind the desk. The
 * sprite is drawn on the same pixel grid as {@link generateGeirSprite} so
 * she reads as part of the same game world. Her lower half is hidden by
 * the reception desk when placed, so we only bother painting head +
 * torso + arms + a hint of a skirt at the bottom.
 *
 * Texture key: `receptionist`. Logical size 48 × 72 (scale 3 → 48 × 72 px
 * at S=3). Origin defaults to 0.5/0.5 on placement.
 */
export function generateReceptionistSprite(scene: Phaser.Scene): void {
  const S = 3;
  const W = 16 * S;
  const H = 24 * S;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * S, y * S, w * S, h * S);
  };

  // Palette — brunette ponytail, warm skin, dark blazer, cream blouse.
  const HAIR = '#4a2e22';
  const HAIR_SH = '#331d14';
  const HAIR_HL = '#6b4230';
  const SKIN = '#f1c3a0';
  const SKIN_SH = '#d9a98a';
  const BLAZER = '#2b2f3a';
  const BLAZER_SH = '#1f2330';
  const BLOUSE = '#f0e6d2';
  const BLOUSE_SH = '#d8cdba';
  const NECKLACE = '#e6c37a';
  const OUTLINE = '#1a1a1a';
  const EYE_W = '#ffffff';
  const LIPS = '#9a4b4b';

  // Ponytail falling behind the right shoulder.
  px(10, 4, 2, 8, HAIR);
  px(11, 6, 1, 5, HAIR_SH);

  // Hair — rounded bob around the head.
  px(4, 0, 8, 1, HAIR_SH);
  px(3, 1, 10, 3, HAIR);
  px(3, 4, 2, 3, HAIR);       // left side
  px(11, 4, 2, 2, HAIR);      // right temple
  px(4, 1, 8, 1, HAIR_HL);    // highlight stripe

  // Face.
  px(5, 4, 6, 5, SKIN);
  px(10, 5, 1, 3, SKIN_SH);   // right-side face shadow
  px(5, 8, 6, 1, SKIN_SH);    // jawline shadow
  // Eyes
  px(6, 5, 1, 1, EYE_W);
  px(6, 5, 1, 1, OUTLINE);
  px(9, 5, 1, 1, OUTLINE);
  // Lips
  px(7, 7, 2, 1, LIPS);
  // Neck
  px(7, 9, 2, 1, SKIN_SH);
  px(7, 10, 2, 1, SKIN);

  // Torso — dark blazer with cream blouse V.
  px(3, 11, 10, 8, BLAZER);
  px(3, 17, 10, 2, BLAZER_SH);       // lower blazer shadow
  // Lapels (V neckline).
  px(6, 11, 4, 1, BLOUSE);
  px(7, 12, 2, 1, BLOUSE);
  px(7, 13, 2, 1, BLOUSE_SH);
  // Dainty necklace pendant.
  px(8, 12, 1, 1, NECKLACE);

  // Arms resting on the counter (forearms only — elbow into body).
  px(2, 13, 1, 5, BLAZER);
  px(13, 13, 1, 5, BLAZER);
  px(2, 17, 2, 1, SKIN);       // left hand
  px(12, 17, 2, 1, SKIN);      // right hand

  // Hint of shoulders outline.
  px(3, 11, 10, 1, BLAZER_SH);

  // Tiny chair-back hint peeking over her shoulders.
  px(4, 10, 8, 1, '#3a2a1e');

  // A sliver of skirt / chair below the blazer so she reads as seated
  // even when the desk doesn't fully occlude the bottom row.
  px(4, 19, 8, 3, BLAZER_SH);
  px(4, 22, 8, 2, OUTLINE);

  scene.textures.addImage('receptionist', canvas as unknown as HTMLImageElement);
}
