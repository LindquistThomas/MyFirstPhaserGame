import * as Phaser from 'phaser';

/**
 * Side-view pixel-art player sprite sheet.
 *
 * 14 frames on one strip (64 × 160 each):
 *   0-1   idle (slight breathing bob)
 *   2-5   walk cycle (leg + arm swing)
 *   6-13  front flip (eight 45° rotation steps)
 */
export function generatePlayerSprites(scene: Phaser.Scene): void {
  const W = 64;
  const H = 160;
  const FRAMES = 14;

  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const S = 4; // scale factor
  const px = (frame: number, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(frame * W + x * S, y * S, w * S, h * S);
  };

  const drawSideChar = (
    f: number,
    bodyY: number,
    backLeg: number,
    frontLeg: number,
    armSwing: number,
  ) => {
    const by = bodyY;

    px(f, 5, 0 + by, 6, 3, '#4a3728');
    px(f, 6, 2 + by, 5, 6, '#f5c5a3');
    px(f, 11, 4 + by, 2, 2, '#e8b090');
    px(f, 8, 4 + by, 2, 2, '#ffffff');
    px(f, 9, 4 + by, 1, 1, '#222222');
    px(f, 6, 4 + by, 6, 1, '#666666');
    px(f, 6, 3 + by, 1, 3, '#666666');

    px(f, 5, 8 + by, 6, 11, '#4a90d9');
    px(f, 9, 8 + by, 2, 8, '#cc3333');
    px(f, 5, 19 + by, 6, 1, '#222222');

    px(f, 8, 9 + by + armSwing, 2, 8, '#4a90d9');
    px(f, 8, 17 + by + armSwing, 2, 2, '#f5c5a3');

    px(f, 5, 20 + by, 3, 10 + backLeg, '#2a2a3a');
    px(f, 4, 30 + by + backLeg, 4, 2, '#141414');

    px(f, 8, 20 + by, 3, 10 + frontLeg, '#333344');
    px(f, 8, 30 + by + frontLeg, 4, 2, '#1a1a1a');
  };

  drawSideChar(0, 0, 0, 0, 0);
  drawSideChar(1, 1, 0, 0, 0);

  drawSideChar(2, 0, -1, 1, -1);
  drawSideChar(3, -1, 1, -1, 1);
  drawSideChar(4, 0, 1, -1, 1);
  drawSideChar(5, -1, -1, 1, -1);

  const drawFlipFrame = (f: number, rotation: number) => {
    const cx = f * W + W / 2;
    const cy = H / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    const p = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * S, y * S, w * S, h * S);
    };

    p(-3, -12, 5, 5, '#f5c5a3');
    p(-3, -14, 5, 3, '#4a3728');
    p(-1, -11, 1, 1, '#222222');
    p(0, -11, 2, 1, '#666666');
    p(-3, -7, 6, 8, '#4a90d9');
    p(0, -7, 2, 6, '#cc3333');
    p(2, -6, 2, 6, '#4a90d9');
    p(-3, 1, 3, 6, '#333344');
    p(1, 1, 3, 6, '#333344');
    p(-3, 7, 3, 2, '#1a1a1a');
    p(1, 7, 3, 2, '#1a1a1a');

    ctx.restore();
  };

  for (let i = 0; i < 8; i++) {
    drawFlipFrame(6 + i, Math.PI * 0.25 * i);
  }

  scene.textures.addSpriteSheet('player', canvas as unknown as HTMLImageElement, { frameWidth: W, frameHeight: H });
}
