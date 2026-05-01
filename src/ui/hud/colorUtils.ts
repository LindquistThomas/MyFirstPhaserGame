/**
 * Lighten a 0xRRGGBB integer by `amount` (0..1) toward white.
 * Used by HUD sub-controllers to derive lighter shades of floor theme colours.
 */
export function lighten(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const gC = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(gC + (255 - gC) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return (lr << 16) | (lg << 8) | lb;
}
