import * as Phaser from 'phaser';

/** Shared 12×12 white circle used by all particle emitters. */
export function generateParticleSprite(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0xffffff);
  gfx.fillCircle(6, 6, 6);
  gfx.generateTexture('particle', 12, 12);
  gfx.destroy();

  // Drop-shadow ellipse used under player + enemies for grounding.
  // Dark blob with soft radial-ish falloff approximated by stacking
  // a few translucent ellipses. Keyed to 'shadow_blob'.
  const sGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  const W = 64;
  const H = 20;
  sGfx.fillStyle(0x000000, 0.18);
  sGfx.fillEllipse(W / 2, H / 2, W, H);
  sGfx.fillStyle(0x000000, 0.22);
  sGfx.fillEllipse(W / 2, H / 2, W * 0.75, H * 0.75);
  sGfx.fillStyle(0x000000, 0.28);
  sGfx.fillEllipse(W / 2, H / 2, W * 0.45, H * 0.55);
  sGfx.generateTexture('shadow_blob', W, H);
  sGfx.destroy();

  // Soft radial halo used behind tokens. Pre-generated so per-Token tinting
  // via setTint is enough — no need to regenerate per floor.
  const hGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  const HR = 48;
  const HD = HR * 2;
  // Stack concentric low-alpha circles for a soft falloff.
  for (let i = 6; i >= 0; i--) {
    const t = i / 6;
    hGfx.fillStyle(0xffffff, 0.03 + (1 - t) * 0.06);
    hGfx.fillCircle(HR, HR, HR * (0.4 + t * 0.6));
  }
  hGfx.generateTexture('token_halo', HD, HD);
  hGfx.destroy();
}
