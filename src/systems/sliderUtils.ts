/** Clamp a slider percentage to the valid range [min, max] (defaults: 0, 100). */
export function clampSlider(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
