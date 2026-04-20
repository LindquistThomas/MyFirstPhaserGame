/**
 * Pillarbox / letterbox backdrop.
 *
 * The game canvas is fixed at GAME_WIDTH×GAME_HEIGHT (4:3) and scaled with
 * `Phaser.Scale.FIT`, so on wider-than-4:3 viewports the page background
 * shows as empty bars on either side (and on taller viewports, top/bottom).
 *
 * This module fills those bars with a blurred, scaled-up copy of the live
 * Phaser canvas, so the scene's colours appear to bleed outward as ambient
 * light rather than ending in a hard rectangle.
 *
 * Implementation:
 *   - A 2D `<canvas id="pillarbox-bg">` sitting behind `#game-container`.
 *   - Each animation frame, throttled to ~15 Hz, drawImage the Phaser
 *     canvas stretched to cover the viewport.
 *   - CSS applies `filter: blur(...)` and a slight `transform: scale(...)`
 *     so the blur doesn't reveal hard edges at the viewport border.
 *
 * Requires the Phaser `GameConfig` to set `render.preserveDrawingBuffer: true`
 * — without it, drawImage from the WebGL canvas yields a blank result.
 */

export interface PillarboxBackdropOptions {
  /**
   * Minimum gap between draws in milliseconds. 66 ≈ 15 Hz. The backdrop is
   * heavily blurred so low update rates are not perceptible.
   */
  throttleMs?: number;
  /**
   * Override for tests. Defaults to `window`.
   */
  win?: Window;
  /**
   * Override for tests. Defaults to `document`.
   */
  doc?: Document;
}

export interface PillarboxBackdropHandle {
  /** Stop the rAF loop and detach resize listeners. Idempotent. */
  stop(): void;
  /** Force an immediate draw (test/debug). */
  drawNow(): void;
}

type AnyGame = { canvas: HTMLCanvasElement; scale?: { on?: (e: string, cb: () => void) => void; off?: (e: string, cb: () => void) => void } };

/**
 * Start the backdrop loop. Safe to call at most once per page — subsequent
 * calls before `stop()` return the existing handle.
 *
 * @param game   Phaser.Game-like object (only `canvas` is required).
 * @param opts   Optional overrides (test injection, throttle tuning).
 */
export function startPillarboxBackdrop(
  game: AnyGame,
  opts: PillarboxBackdropOptions = {},
): PillarboxBackdropHandle {
  const win = opts.win ?? window;
  const doc = opts.doc ?? document;
  const throttleMs = opts.throttleMs ?? 66;

  const bg = doc.getElementById('pillarbox-bg') as HTMLCanvasElement | null;
  if (!bg) {
    // Dev/test environments without the DOM element — no-op handle.
    return { stop: () => {}, drawNow: () => {} };
  }
  const ctx = bg.getContext('2d');
  if (!ctx) {
    return { stop: () => {}, drawNow: () => {} };
  }

  let stopped = false;
  let rafId = 0;
  let lastDraw = 0;

  const sizeBackdrop = () => {
    const dpr = win.devicePixelRatio || 1;
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    // Internal pixel buffer at DPR for crisp blur; CSS size matches viewport.
    bg.width = Math.max(1, Math.round(vw * dpr));
    bg.height = Math.max(1, Math.round(vh * dpr));
    bg.style.width = `${vw}px`;
    bg.style.height = `${vh}px`;
  };

  const draw = () => {
    const src = game.canvas;
    if (!src || src.width === 0 || src.height === 0) return;
    if (bg.width === 0 || bg.height === 0) return;
    try {
      ctx.drawImage(src, 0, 0, bg.width, bg.height);
    } catch {
      // drawImage can throw if the source canvas is temporarily invalid
      // (e.g. context lost). Swallow — next frame will try again.
    }
  };

  const tick = (now: number) => {
    if (stopped) return;
    if (now - lastDraw >= throttleMs) {
      lastDraw = now;
      draw();
    }
    rafId = win.requestAnimationFrame(tick);
  };

  const onResize = () => sizeBackdrop();
  win.addEventListener('resize', onResize);
  // Phaser emits 'resize' on its Scale Manager when the viewport changes.
  // Guard for shape — tests pass a minimal game stub.
  const scale = game.scale;
  if (scale?.on) scale.on('resize', onResize);

  sizeBackdrop();
  draw();
  rafId = win.requestAnimationFrame(tick);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      win.cancelAnimationFrame(rafId);
      win.removeEventListener('resize', onResize);
      if (scale?.off) scale.off('resize', onResize);
    },
    drawNow: draw,
  };
}
