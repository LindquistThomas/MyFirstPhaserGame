import * as Phaser from 'phaser';
import { theme } from '../../style/theme';

/**
 * Side-view pixel-art architect sprite sheet.
 *
 * Logical pixel grid 16 × 40 at scale 4 → 64 × 160 per frame. 14 frames horizontal:
 *   0-1   idle (breathing bob, rolled blueprint in front hand)
 *   2-5   walk cycle (contact / passing / contact-opp / passing-opp) with 1px head bob
 *   6-13  front flip — hand-posed: tuck → tilt → extend → inverted → extend-rev → tilt-back → tuck-down → recover
 *
 * Palette (kept from original so the character still reads as the same person):
 *   hair   #4a3728   skin  #f5c5a3   skin-sh #e8b090
 *   shirt  #4a90d9   sleeve-sh #3a7dc0   tie #cc3333
 *       — tie stays classic red: strongest single identity cue at 2px wide
 *   pants-front #333344   pants-back #2a2a3a
 *   shoe-front  #1a1a1a   shoe-back  #141414
 *   blueprint paper #e8e4c4 / blue band #3b6aa0 / dark ends #8a7a4a
 *
 * Hitbox invariant: visible body/torso stays within logical x = 5..11 (matches the
 * 40 px / 10 logical hitbox width used by Player.ts). Flip frames may extend arms
 * and legs outside that band — intentional, for readable silhouettes mid-air.
 */

/** Pixel width of a single player animation frame. */
export const PLAYER_FRAME_W = 64;
/** Pixel height of a single player animation frame. */
export const PLAYER_FRAME_H = 160;
/** Total number of frames in the player sprite sheet. */
export const PLAYER_FRAME_COUNT = 14;

// Module-private aliases keep the pixel-drawing helpers readable.
const _W = PLAYER_FRAME_W;
const _H = PLAYER_FRAME_H;
const _FRAMES = PLAYER_FRAME_COUNT;
const _S = 4;

// Palette constants
const _HAIR = '#4a3728';
const _SKIN = '#f5c5a3';
const _SKIN_SH = '#e8b090';
const _SHIRT = '#4a90d9';
const _SHIRT_SH = '#3a7dc0';
const _TIE = '#cc3333';
const _PANTS_F = '#333344';
const _PANTS_B = '#2a2a3a';
const _SHOE_F = '#1a1a1a';
const _SHOE_B = '#141414';
const _PAPER = '#e8e4c4';
const _BLUE_P = '#3b6aa0';
const _PAPER_END = '#8a7a4a';
const _OUTLINE = '#222222';
const _MOUTH = '#8a4a3a';

/**
 * Build drawing helpers from a canvas 2D context.
 * Returns `px` and the high-level body helpers that close over it.
 */
function _makeHelpers(ctx: CanvasRenderingContext2D) {
  const EYE_W = theme.color.css.textWhite;

  const px = (f: number, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(f * _W + x * _S, y * _S, w * _S, h * _S);
  };

  /** Head + torso + tie + belt. `by` = vertical body offset (for bob). */
  const drawUpperBody = (f: number, by: number) => {
    // Hair
    px(f, 5, 0 + by, 6, 3, _HAIR);
    // Face
    px(f, 6, 2 + by, 5, 6, _SKIN);
    // Nose bump (faces right)
    px(f, 11, 4 + by, 1, 2, _SKIN_SH);
    // Jawline shadow
    px(f, 6, 7 + by, 5, 1, _SKIN_SH);
    // Eyebrow + eye
    px(f, 8, 3 + by, 2, 1, _HAIR);
    px(f, 8, 4 + by, 2, 1, EYE_W);
    px(f, 9, 4 + by, 1, 1, _OUTLINE);
    // Mouth
    px(f, 9, 6 + by, 2, 1, _MOUTH);
    // Neck
    px(f, 7, 8 + by, 3, 1, _SKIN_SH);
    // Shirt torso
    px(f, 5, 9 + by, 6, 10, _SHIRT);
    // Collar V
    px(f, 7, 9 + by, 1, 1, _SHIRT_SH);
    px(f, 10, 9 + by, 1, 1, _SHIRT_SH);
    // Tie (knot + body + tip)
    px(f, 8, 9 + by, 2, 2, _TIE);
    px(f, 9, 11 + by, 1, 6, _TIE);
    px(f, 8, 16 + by, 2, 2, _TIE);
    // Belt
    px(f, 5, 19 + by, 6, 1, _OUTLINE);
  };

  /**
   * Single visible arm with rolled-up sleeve (upper shirt + forearm skin + hand).
   * (x, y) is top-left of the arm; arm is 2 wide × 9 tall.
   */
  const drawArm = (f: number, x: number, y: number) => {
    // Rolled sleeve — short upper shirt section with a darker cuff band
    px(f, x, y, 2, 3, _SHIRT);
    px(f, x, y + 3, 2, 1, _SHIRT_SH);
    // Forearm
    px(f, x, y + 4, 2, 3, _SKIN);
    // Hand
    px(f, x, y + 7, 2, 2, _SKIN_SH);
  };

  /** Horizontal rolled blueprint tube. Top-left at (x, y), 4 × 2. */
  const drawBlueprint = (f: number, x: number, y: number) => {
    px(f, x, y, 4, 2, _PAPER);
    px(f, x, y + 1, 4, 1, _BLUE_P);
    px(f, x, y, 1, 2, _PAPER_END);
    px(f, x + 3, y, 1, 2, _PAPER_END);
  };

  /** Legs + shoes. Positive *Delta lengthens that leg (planted); negative lifts it. */
  const drawLegs = (
    f: number,
    by: number,
    backLegDelta: number,
    frontLegDelta: number,
    backLegX: number,
    frontLegX: number,
  ) => {
    const backLen = 10 + backLegDelta;
    const frontLen = 10 + frontLegDelta;
    px(f, backLegX, 20 + by, 3, backLen, _PANTS_B);
    px(f, backLegX - 1, 20 + by + backLen, 4, 2, _SHOE_B);
    px(f, frontLegX, 20 + by, 3, frontLen, _PANTS_F);
    px(f, frontLegX, 20 + by + frontLen, 4, 2, _SHOE_F);
  };

  return { px, EYE_W, drawUpperBody, drawArm, drawBlueprint, drawLegs };
}

/**
 * Draw idle (frames 0–1) and walk (frames 2–5) onto an existing canvas context.
 * Call this as phase 1 of a split sprite-sheet generation pipeline.
 */
export function drawPlayerWalkFrames(_canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const { drawUpperBody, drawArm, drawBlueprint, drawLegs } = _makeHelpers(ctx);

  /* ------------------------- Idle 0-1 ------------------------- */
  // Frame 0: neutral stance, blueprint held forward in front hand.
  drawUpperBody(0, 0);
  drawArm(0, 10, 10);            // front arm, hand at y=17
  drawBlueprint(0, 11, 17);      // tube just in front of the hand
  drawLegs(0, 0, 0, 0, 5, 8);

  // Frame 1: breathing — upper body and arm sink 1 px; legs/feet stay planted.
  drawUpperBody(1, 1);
  drawArm(1, 10, 11);
  drawBlueprint(1, 11, 18);
  drawLegs(1, 0, 0, 0, 5, 8);

  /* ------------------------- Walk 2-5 ------------------------- */
  // Contact = legs spread, body grounded (by=0). Passing = legs together, body lifted (by=-1).

  // 2 — contact A: front leg planted forward, back leg trailing; front arm swings BACK.
  drawUpperBody(2, 0);
  drawArm(2, 10, 11);            // arm slightly back + down
  drawLegs(2, 0, -2, 2, 4, 9);   // front leg extended fwd (longer), back leg lifted

  // 3 — passing: legs cross centre, head bobs up.
  drawUpperBody(3, -1);
  drawArm(3, 9, 9);              // arm at neutral, lifted with body
  drawLegs(3, -1, 0, 0, 6, 8);

  // 4 — contact B: back leg now planted forward; front arm swings FORWARD.
  drawUpperBody(4, 0);
  drawArm(4, 11, 9);             // arm fwd + up
  drawLegs(4, 0, 2, -2, 4, 9);   // back leg extended fwd, front leg lifted

  // 5 — passing (opposite phase): legs cross, head bobs up.
  drawUpperBody(5, -1);
  drawArm(5, 8, 9);
  drawLegs(5, -1, 0, 0, 6, 8);
}

/**
 * Draw front-flip frames (6–13) onto an existing canvas context.
 * Call this as phase 2 of a split sprite-sheet generation pipeline,
 * after `drawPlayerWalkFrames`. Does NOT register the texture.
 */
export function drawPlayerFlipFrames(_canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const { px, EYE_W } = _makeHelpers(ctx);

  /* ------------------------- Flip 6-13 ------------------------- */
  // Each frame is a distinct hand-posed silhouette, not a rotation.
  // Arc: tuck-up (takeoff) → tilt-fwd → extend → inverted → extend-rev → tilt-back → tuck-down → recover.

  // 6 — takeoff tuck: upright, knees to chest, arms wrapped around shins.
  {
    const f = 6, by = 4;
    px(f, 5, 0 + by, 6, 3, _HAIR);
    px(f, 6, 2 + by, 5, 5, _SKIN);
    px(f, 11, 4 + by, 1, 1, _SKIN_SH);
    px(f, 8, 3 + by, 2, 1, _HAIR);
    px(f, 8, 4 + by, 2, 1, EYE_W);
    px(f, 9, 4 + by, 1, 1, _OUTLINE);
    // Short compressed torso
    px(f, 5, 7 + by, 6, 6, _SHIRT);
    px(f, 9, 8 + by, 1, 4, _TIE);
    // Tucked thighs across front of torso
    px(f, 5, 13 + by, 6, 3, _PANTS_F);
    px(f, 6, 16 + by, 2, 2, _SHOE_F);
    px(f, 9, 16 + by, 2, 2, _SHOE_B);
    // Arms hugging knees (shirt + hand)
    px(f, 4, 10 + by, 2, 3, _SHIRT);
    px(f, 4, 13 + by, 2, 2, _SKIN);
    px(f, 11, 10 + by, 2, 3, _SHIRT);
    px(f, 11, 13 + by, 2, 2, _SKIN);
  }

  // 7 — 1/8 rotation forward: body diagonal, head upper-right, legs tucked lower-left.
  {
    const f = 7, by = 3;
    // Head shifted up-right
    px(f, 9, 0 + by, 5, 3, _HAIR);
    px(f, 9, 3 + by, 5, 4, _SKIN);
    px(f, 12, 4 + by, 1, 1, _OUTLINE);
    px(f, 11, 3 + by, 2, 1, _HAIR);
    // Diagonal torso (staircase of two blocks to suggest tilt)
    px(f, 6, 7 + by, 5, 3, _SHIRT);
    px(f, 4, 10 + by, 6, 4, _SHIRT);
    px(f, 8, 8 + by, 1, 5, _TIE);
    // Leading arm forward
    px(f, 10, 10 + by, 2, 3, _SHIRT);
    px(f, 10, 13 + by, 2, 2, _SKIN);
    // Legs tucked lower-left
    px(f, 2, 13 + by, 4, 4, _PANTS_F);
    px(f, 1, 17 + by, 3, 2, _SHOE_F);
    px(f, 4, 17 + by, 3, 2, _SHOE_B);
  }

  // 8 — horizontal extended (superman): head right, arms forward, legs trailing left.
  {
    const f = 8, by = 14;
    // Head right
    px(f, 11, by - 2, 3, 3, _HAIR);
    px(f, 11, by + 1, 3, 3, _SKIN);
    px(f, 13, by + 2, 1, 1, _OUTLINE);
    // Torso long horizontal
    px(f, 4, by, 8, 5, _SHIRT);
    px(f, 5, by + 2, 6, 1, _TIE);
    // Arms forward past head
    px(f, 13, by + 4, 2, 2, _SHIRT);
    px(f, 14, by + 5, 1, 1, _SKIN);
    // Trailing legs
    px(f, 0, by + 1, 4, 3, _PANTS_F);
    px(f, 0, by + 4, 2, 2, _SHOE_F);
    px(f, 2, by + 4, 2, 2, _SHOE_B);
  }

  // 9 — inverted tuck (upside down): feet up top, head low.
  {
    const f = 9, by = 4;
    // Feet at the top
    px(f, 6, 0 + by, 2, 2, _SHOE_F);
    px(f, 9, 0 + by, 2, 2, _SHOE_B);
    // Legs reaching up
    px(f, 6, 2 + by, 2, 4, _PANTS_F);
    px(f, 9, 2 + by, 2, 4, _PANTS_B);
    // Torso (belt at top now)
    px(f, 5, 6 + by, 6, 1, _OUTLINE);
    px(f, 5, 7 + by, 6, 7, _SHIRT);
    px(f, 8, 7 + by, 2, 6, _TIE);
    // Arms tucked along torso
    px(f, 3, 8 + by, 2, 4, _SHIRT);
    px(f, 3, 12 + by, 2, 2, _SKIN);
    px(f, 11, 8 + by, 2, 4, _SHIRT);
    px(f, 11, 12 + by, 2, 2, _SKIN);
    // Head below torso — hair at the bottom now
    px(f, 5, 14 + by, 6, 5, _SKIN);
    px(f, 5, 19 + by, 6, 3, _HAIR);
    px(f, 6, 16 + by, 1, 1, _OUTLINE);
  }

  // 10 — horizontal extended reversed: head left, legs leading right.
  {
    const f = 10, by = 14;
    // Head left
    px(f, 2, by - 2, 3, 3, _HAIR);
    px(f, 2, by + 1, 3, 3, _SKIN);
    px(f, 2, by + 2, 1, 1, _OUTLINE);
    // Torso horizontal
    px(f, 4, by, 8, 5, _SHIRT);
    px(f, 5, by + 2, 6, 1, _TIE);
    // Arms behind (to the left)
    px(f, 1, by + 4, 3, 2, _SHIRT);
    px(f, 0, by + 5, 1, 1, _SKIN);
    // Leading legs right
    px(f, 12, by + 1, 4, 3, _PANTS_F);
    px(f, 14, by + 4, 2, 2, _SHOE_F);
    px(f, 12, by + 4, 2, 2, _SHOE_B);
  }

  // 11 — 7/8 rotation: body diagonal head upper-left, legs lower-right.
  {
    const f = 11, by = 3;
    // Head upper-left
    px(f, 2, 0 + by, 5, 3, _HAIR);
    px(f, 2, 3 + by, 5, 4, _SKIN);
    px(f, 3, 4 + by, 1, 1, _OUTLINE);
    px(f, 3, 3 + by, 2, 1, _HAIR);
    // Diagonal torso stepping down-right
    px(f, 5, 7 + by, 5, 3, _SHIRT);
    px(f, 7, 10 + by, 6, 4, _SHIRT);
    px(f, 8, 8 + by, 1, 5, _TIE);
    // Trailing arm back-left
    px(f, 4, 10 + by, 2, 3, _SHIRT);
    px(f, 4, 13 + by, 2, 2, _SKIN);
    // Legs swinging down-right
    px(f, 10, 13 + by, 4, 4, _PANTS_F);
    px(f, 9, 17 + by, 3, 2, _SHOE_B);
    px(f, 12, 17 + by, 3, 2, _SHOE_F);
  }

  // 12 — tuck-down pre-landing: upright, deep knee bend, arms out for balance.
  {
    const f = 12, by = 2;
    px(f, 5, 0 + by, 6, 3, _HAIR);
    px(f, 6, 2 + by, 5, 5, _SKIN);
    px(f, 11, 4 + by, 1, 1, _SKIN_SH);
    px(f, 8, 3 + by, 2, 1, _HAIR);
    px(f, 8, 4 + by, 2, 1, EYE_W);
    px(f, 9, 4 + by, 1, 1, _OUTLINE);
    // Torso
    px(f, 5, 7 + by, 6, 8, _SHIRT);
    px(f, 9, 8 + by, 1, 6, _TIE);
    // Arms spread wide
    px(f, 2, 9 + by, 3, 2, _SHIRT);
    px(f, 2, 11 + by, 2, 2, _SKIN);
    px(f, 11, 9 + by, 3, 2, _SHIRT);
    px(f, 12, 11 + by, 2, 2, _SKIN);
    // Deep knee bend — thighs short + shins angled out
    px(f, 5, 15 + by, 2, 4, _PANTS_B);
    px(f, 9, 15 + by, 2, 4, _PANTS_F);
    px(f, 3, 19 + by, 3, 3, _PANTS_B);
    px(f, 10, 19 + by, 3, 3, _PANTS_F);
    px(f, 2, 22 + by, 4, 2, _SHOE_B);
    px(f, 10, 22 + by, 4, 2, _SHOE_F);
  }

  // 13 — recovery: near-idle stance with slightly spread legs, arms settling down.
  {
    const f = 13, by = 1;
    px(f, 5, 0 + by, 6, 3, _HAIR);
    px(f, 6, 2 + by, 5, 6, _SKIN);
    px(f, 11, 4 + by, 1, 2, _SKIN_SH);
    px(f, 6, 7 + by, 5, 1, _SKIN_SH);
    px(f, 8, 3 + by, 2, 1, _HAIR);
    px(f, 8, 4 + by, 2, 1, EYE_W);
    px(f, 9, 4 + by, 1, 1, _OUTLINE);
    px(f, 9, 6 + by, 2, 1, _MOUTH);
    // Torso
    px(f, 5, 9 + by, 6, 10, _SHIRT);
    px(f, 8, 9 + by, 2, 2, _TIE);
    px(f, 9, 11 + by, 1, 6, _TIE);
    px(f, 5, 19 + by, 6, 1, _OUTLINE);
    // Arms — one forward one at side
    px(f, 3, 10 + by, 2, 6, _SHIRT);
    px(f, 3, 16 + by, 2, 2, _SKIN);
    px(f, 11, 10 + by, 2, 6, _SHIRT);
    px(f, 11, 16 + by, 2, 2, _SKIN);
    // Slightly-spread landing legs
    px(f, 4, 20 + by, 3, 9, _PANTS_B);
    px(f, 9, 20 + by, 3, 9, _PANTS_F);
    px(f, 3, 29 + by, 4, 2, _SHOE_B);
    px(f, 9, 29 + by, 4, 2, _SHOE_F);
  }
}

/**
 * Full sprite-sheet generation for direct / non-split use.
 * Generates the complete 14-frame player sprite sheet in one call.
 */
export function generatePlayerSprites(scene: Phaser.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = _W * _FRAMES;
  canvas.height = _H;
  const ctx = canvas.getContext('2d')!;
  drawPlayerWalkFrames(canvas, ctx);
  drawPlayerFlipFrames(canvas, ctx);
  scene.textures.addSpriteSheet(
    'player',
    canvas as unknown as HTMLImageElement,
    { frameWidth: _W, frameHeight: _H },
  );
}
