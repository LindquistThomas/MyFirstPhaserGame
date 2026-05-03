/**
 * Responsive layout utilities.
 *
 * The game canvas is fixed 1280×960 and FIT-scaled to the viewport by Phaser.
 * On narrow viewports (phones, small tablets) the canvas is CSS-downscaled and
 * all UI elements appear physically small. These helpers let HUD, dialogs, and
 * other UI components adapt their Phaser-unit sizes so the result looks
 * acceptable at any display width.
 *
 * `getSizeClass(viewportWidth)` classifies the actual CSS viewport width into
 * three buckets. UI modules query this at construction time (and again on
 * Phaser's `resize` event) to select appropriate font sizes and panel widths.
 */

/** CSS viewport width breakpoints → layout tier. */
export type SizeClass = 'compact' | 'regular' | 'wide';

/**
 * Map the actual CSS/device-pixel viewport width to a layout size class.
 *
 * Pass `scene.scale.displaySize.width` (Phaser's reported CSS canvas width)
 * or `window.innerWidth` — both reflect the physical display size, not the
 * 1280-unit game canvas width.
 *
 *   compact  — < 700 px  (phones, narrow portrait)
 *   regular  — 700–1099 px (tablets, landscape phones, small laptops)
 *   wide     — ≥ 1100 px (desktop default)
 */
export function getSizeClass(viewportWidth: number): SizeClass {
  if (viewportWidth < 700) return 'compact';
  if (viewportWidth < 1100) return 'regular';
  return 'wide';
}

/**
 * Layout tokens resolved for a given size class.
 *
 * All numeric values are in Phaser game-units (the 1280×960 coordinate space).
 * Font-size strings follow the Phaser `TextStyle.fontSize` format.
 *
 * At compact sizes fonts are intentionally larger than "desktop" values:
 * because the canvas is CSS-scaled down, larger game-unit sizes compensate
 * so the rendered result is still legible on mobile screens.
 */
export interface LayoutTokens {
  /** AU counter font size (e.g. `'28px'`). */
  hudFontAU: string;
  /** Floor name indicator font size. */
  hudFontFloor: string;
  /** Centre game-title chrome font size. */
  hudFontTitle: string;
  /** Tiny "FLOOR" micro-label font size. */
  hudFontFloorLabel: string;
  /** Dialog / modal body copy font size. */
  dialogFontBody: string;
  /** Dialog title font size. */
  dialogFontTitle: string;
  /**
   * Interactive tap-target size in game-units used for buttons and link rows.
   * Compact layouts use a larger token to improve usability after FIT scaling,
   * but the final on-screen CSS size still depends on the current viewport width
   * and canvas scale factor; this value alone does not guarantee a fixed 44 px
   * physical target on very small displays.
   */
  dialogTapTarget: number;
  /**
   * Dialog panel width in game-units.
   * Wider panels fill more of the visible display on compact viewports where
   * the canvas is CSS-scaled way down.
   */
  dialogPanelW: number;
}

/** Canonical layout tokens per size class, optionally scaled by a text-scale multiplier. */
export function getLayoutTokens(sc: SizeClass, textScale = 1): LayoutTokens {
  const base = getBaseLayoutTokens(sc);
  if (textScale === 1) return base;
  const scalePx = (s: string): string => `${Math.round(parseInt(s, 10) * textScale)}px`;
  return {
    ...base,
    hudFontAU:        scalePx(base.hudFontAU),
    hudFontFloor:     scalePx(base.hudFontFloor),
    hudFontTitle:     scalePx(base.hudFontTitle),
    hudFontFloorLabel: scalePx(base.hudFontFloorLabel),
    dialogFontBody:   scalePx(base.dialogFontBody),
    dialogFontTitle:  scalePx(base.dialogFontTitle),
  };
}

/** Raw (unscaled) layout tokens per size class. */
function getBaseLayoutTokens(sc: SizeClass): LayoutTokens {
  switch (sc) {
    case 'compact':
      return {
        hudFontAU: '28px',
        hudFontFloor: '22px',
        hudFontTitle: '17px',
        hudFontFloorLabel: '12px',
        dialogFontBody: '21px',
        dialogFontTitle: '30px',
        dialogTapTarget: 56,
        dialogPanelW: 1160,
      };
    case 'regular':
      return {
        hudFontAU: '22px',
        hudFontFloor: '18px',
        hudFontTitle: '14px',
        hudFontFloorLabel: '10px',
        dialogFontBody: '17px',
        dialogFontTitle: '26px',
        dialogTapTarget: 50,
        dialogPanelW: 820,
      };
    default: // 'wide'
      return {
        hudFontAU: '20px',
        hudFontFloor: '16px',
        hudFontTitle: '13px',
        hudFontFloorLabel: '9px',
        dialogFontBody: '15px',
        dialogFontTitle: '24px',
        dialogTapTarget: 44,
        dialogPanelW: 620,
      };
  }
}
