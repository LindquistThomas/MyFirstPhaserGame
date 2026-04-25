import * as Phaser from 'phaser';

/**
 * Procedural pixel-art rubber duck.
 *
 * A classic yellow rubber duck with an orange beak, a beady black eye, and
 * a plump oval body. Scale 4 → 48 × 40 px displayed. Faces left by default.
 *
 * Texture key: `npc_rubber_duck`.
 */
export function generateRubberDuckSprite(scene: Phaser.Scene): void {
  const S = 4;
  const W = 12 * S; // 48 px
  const H = 10 * S; // 40 px

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * S, y * S, w * S, h * S);
  };

  const YELLOW    = '#f7d000';
  const YELLOW_SH = '#c8a800';
  const YELLOW_HL = '#fff59d';
  const BEAK      = '#f07800';
  const BEAK_SH   = '#b85800';
  const EYE       = '#1a1a1a';

  // Head (rows 0–3)
  px(4, 0, 4, 1, YELLOW);       // head top arc
  px(3, 1, 6, 1, YELLOW);       // head wide
  px(5, 1, 1, 1, YELLOW_HL);    // head highlight
  px(3, 2, 7, 1, YELLOW);       // head / body start row
  px(3, 3, 8, 1, YELLOW);       // head merges into body

  // Beak — orange, left-facing (x=1–2, rows 2–3)
  px(1, 2, 2, 1, BEAK);
  px(0, 3, 2, 1, BEAK);
  px(1, 3, 1, 1, BEAK_SH);

  // Eye — black dot on head
  px(4, 2, 1, 1, EYE);

  // Body (rows 4–8, widest in middle)
  px(2, 4, 9, 1, YELLOW);
  px(2, 5, 9, 1, YELLOW);
  px(2, 6, 9, 1, YELLOW);
  px(3, 7, 7, 1, YELLOW);
  px(4, 8, 5, 1, YELLOW);

  // Body shadow / base band
  px(2, 6, 9, 1, YELLOW_SH);
  px(3, 7, 7, 1, YELLOW_SH);
  px(4, 8, 5, 1, YELLOW_SH);

  // Wing highlight on upper body
  px(6, 4, 3, 1, YELLOW_HL);

  // Tail bump on right side
  px(10, 5, 1, 1, YELLOW);
  px(11, 5, 1, 1, YELLOW_SH);

  // Bottom shadow stripe
  px(4, 9, 5, 1, '#9a7a00');

  scene.textures.addImage(
    'npc_rubber_duck',
    canvas as unknown as HTMLImageElement,
  );
}
