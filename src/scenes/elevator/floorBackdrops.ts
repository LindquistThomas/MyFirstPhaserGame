/**
 * Per-floor themed near-layer backdrop for the elevator scene's hallway
 * strips on either side of the shaft. Sits in front of `buildingFacade`
 * (depth 0.4, parallax 0.85) but behind the shaft pillars (depth 2.1).
 * Drawn at scrollFactor 1 so each band stays locked to its real floor
 * slab — sidesteps the parallax-misalignment issue that forced the far
 * façade to stay floor-agnostic.
 *
 * Two-step pipeline (matches the codebase's pure-helper + thin-renderer
 * convention used by `skyBackdrop.ts`, `buildingFacade.ts`, and
 * `distantSkyline.ts`):
 *
 *   1. `specForBand(band, sideRect, blocked)` returns a deterministic
 *      `FloorBackdropSpec` (static rects + blinking rects). No Phaser
 *      dependency — fully unit-testable.
 *   2. `drawFloorBackdrops(scene, opts)` renders all specs: static rects
 *      collapsed into one `Graphics` per side per band, blinking rects
 *      become individual `Rectangle` game objects with their own alpha
 *      tweens (so each blink can be animated independently).
 *
 * Themed contents per floor (silhouette / architectural — restraint
 * applied where the floor scene already has dense foreground décor):
 *
 *   LOBBY        — wainscot stripe + framed picture silhouettes + sconce blink
 *   PLATFORM_TEAM
 *     left       — server-rack silhouettes with blinking LED rows
 *     right      — whiteboard with diagram blocks + marker tray
 *   BUSINESS
 *     left       — desk + monitor with blinking data points
 *     right      — cubicle dividers + support headset glyph + ticket screen
 *   EXECUTIVE    — wood panelling + bookshelf + warm lamp blink
 *   PRODUCTS     — utility corridor: pipes + vent + signage, avoiding
 *                  X ranges blocked by product doors.
 *
 * Depth: 0.5 (above façade 0.4, below hallway floor tiles 2).
 */
import type * as Phaser from 'phaser';
import { theme } from '../../style/theme';
import { FLOORS, FloorId } from '../../config/gameConfig';

/** Static rectangle (no animation). */
export interface BackdropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha?: number;
}

/** Rectangle that pulses alpha between `lo` and `hi` on a yoyo loop. */
export interface BackdropBlinkRect extends BackdropRect {
  blink: { lo: number; hi: number; durationMs: number; delayMs: number };
}

export interface FloorBackdropSpec {
  staticRects: BackdropRect[];
  blinkRects: BackdropBlinkRect[];
}

/** One floor band. yTop/yBottom are world coordinates (slab-aligned). */
export interface FloorBackdropBand {
  floorId: FloorId;
  yTop: number;
  yBottom: number;
}

/** Side strip in world coordinates, left or right of the shaft. */
export interface SideRect {
  xLeft: number;
  xRight: number;
  yTop: number;
  yBottom: number;
}

/** A blocked horizontal range, used to keep PRODUCTS clutter clear of doors. */
export interface BlockedRange {
  xMin: number;
  xMax: number;
}

export interface FloorBackdropOptions {
  /** Two side strips: [left of shaft, right of shaft] in world coords. */
  sides: [
    { xLeft: number; xRight: number },
    { xLeft: number; xRight: number },
  ];
  bands: FloorBackdropBand[];
  /**
   * Static keep-out X ranges in world coordinates. Currently consumed
   * only by the PRODUCTS band so backdrop décor doesn't overlap product
   * doors / door labels. Pass empty / omit if not relevant.
   */
  blockedRanges?: BlockedRange[];
}

export interface FloorBackdropHandle {
  objects: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
}

/** xorshift-based deterministic RNG (matches sibling backdrop modules). */
function rng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 0x12345678;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** True if `[xMin, xMax]` overlaps any blocked range. */
function overlapsBlocked(xMin: number, xMax: number, blocked: BlockedRange[]): boolean {
  for (const b of blocked) {
    if (xMax >= b.xMin && xMin <= b.xMax) return true;
  }
  return false;
}

type Side = 'left' | 'right';

/* -------------------------------------------------------------------------- *
 * Per-floor spec generators. Each takes the side rect in absolute world
 * coordinates and returns rects in absolute world coordinates too — the
 * caller doesn't have to do any offsetting.
 * -------------------------------------------------------------------------- */

function specForLobby(rect: SideRect, side: Side, seed: number): FloorBackdropSpec {
  const rand = rng(seed ^ 0x10b1_a000);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];

  if (w < 60 || h < 60) return { staticRects, blinkRects };

  // Wainscot: low horizontal panel along bottom 22 px of the band.
  const wainscotH = 22;
  const wainscotY = rect.yBottom - wainscotH - 6;
  staticRects.push({
    x: rect.xLeft + 4,
    y: wainscotY,
    width: w - 8,
    height: wainscotH,
    color: c.panelMid,
    alpha: 0.85,
  });
  // Wainscot top trim — single brighter pixel line.
  staticRects.push({
    x: rect.xLeft + 4,
    y: wainscotY,
    width: w - 8,
    height: 1,
    color: c.panelEdge,
    alpha: 0.9,
  });

  // 2 framed picture silhouettes spaced across the wall.
  const frameH = Math.min(28, Math.max(16, Math.floor(h * 0.32)));
  const frameW = Math.min(34, Math.max(20, Math.floor(w * 0.18)));
  const frameY = rect.yTop + Math.floor(h * 0.22);
  const slots = 2;
  const stride = Math.floor(w / (slots + 1));
  for (let i = 0; i < slots; i++) {
    const fx = rect.xLeft + stride * (i + 1) - Math.floor(frameW / 2);
    // Frame outer
    staticRects.push({
      x: fx,
      y: frameY,
      width: frameW,
      height: frameH,
      color: c.panelEdge,
      alpha: 0.9,
    });
    // Frame inner (canvas)
    staticRects.push({
      x: fx + 2,
      y: frameY + 2,
      width: frameW - 4,
      height: frameH - 4,
      color: c.panelDark,
      alpha: 0.9,
    });
    // Tiny abstract "art" stripe inside the frame.
    staticRects.push({
      x: fx + 4,
      y: frameY + Math.floor(frameH / 2),
      width: frameW - 8,
      height: 2,
      color: c.boardMarker,
      alpha: 0.6,
    });
  }

  // Wall sconce: small lit puck near the top with a soft blink.
  const sconceX =
    side === 'left' ? rect.xRight - 14 : rect.xLeft + 8;
  const sconceY = rect.yTop + 12 + Math.floor(rand() * 8);
  staticRects.push({
    x: sconceX,
    y: sconceY,
    width: 6,
    height: 3,
    color: c.panelEdge,
    alpha: 0.9,
  });
  blinkRects.push({
    x: sconceX - 1,
    y: sconceY + 3,
    width: 8,
    height: 3,
    color: c.lampWarm,
    alpha: 0.6,
    blink: { lo: 0.35, hi: 0.7, durationMs: 2400, delayMs: Math.floor(rand() * 600) },
  });

  return { staticRects, blinkRects };
}

function specForPlatform(rect: SideRect, side: Side, seed: number): FloorBackdropSpec {
  const rand = rng(seed ^ 0xfa1_da7a);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];
  if (w < 70 || h < 70) return { staticRects, blinkRects };

  // 2 server-rack columns. Rack is a tall dark cabinet with horizontal
  // LED rows. Each rack is ~ 32 px wide, separated by an 18 px gap.
  const rackW = 32;
  const gap = 18;
  const rackH = Math.min(h - 16, 96);
  const rackY = rect.yBottom - rackH - 6;
  const totalW = 2 * rackW + gap;
  const startX = rect.xLeft + Math.floor((w - totalW) / 2);

  for (let r = 0; r < 2; r++) {
    const rx = startX + r * (rackW + gap);
    // Rack body
    staticRects.push({
      x: rx,
      y: rackY,
      width: rackW,
      height: rackH,
      color: c.rackBody,
      alpha: 0.95,
    });
    // Rack frame (lighter edge)
    staticRects.push({ x: rx, y: rackY, width: rackW, height: 1, color: c.rackEdge, alpha: 0.9 });
    staticRects.push({
      x: rx,
      y: rackY + rackH - 1,
      width: rackW,
      height: 1,
      color: c.rackEdge,
      alpha: 0.9,
    });
    // LED rows: 6 rows, each row has 4 small LEDs. Most are dim; a few blink.
    const rows = 6;
    const rowH = Math.floor((rackH - 8) / rows);
    for (let row = 0; row < rows; row++) {
      const ly = rackY + 4 + row * rowH;
      // Row strip (off colour)
      staticRects.push({
        x: rx + 4,
        y: ly,
        width: rackW - 8,
        height: 2,
        color: c.rackLedOff,
        alpha: 0.85,
      });
      // 4 LED dots
      for (let i = 0; i < 4; i++) {
        const lx = rx + 5 + i * Math.floor((rackW - 10) / 4);
        const isOn = rand() < 0.55;
        const isBlink = isOn && rand() < 0.18;
        if (isBlink) {
          blinkRects.push({
            x: lx,
            y: ly,
            width: 2,
            height: 2,
            color: rand() < 0.35 ? c.rackLedAmber : c.rackLedOn,
            alpha: 0.95,
            blink: {
              lo: 0.25,
              hi: 0.95,
              durationMs: 900 + Math.floor(rand() * 1400),
              delayMs: Math.floor(rand() * 1200),
            },
          });
        } else if (isOn) {
          staticRects.push({
            x: lx,
            y: ly,
            width: 2,
            height: 2,
            color: c.rackLedOn,
            alpha: 0.7,
          });
        }
      }
    }
  }

  return { staticRects, blinkRects };
}

function specForArchitecture(rect: SideRect, _side: Side, seed: number): FloorBackdropSpec {
  const rand = rng(seed ^ 0xa1c_b0a1);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];
  if (w < 80 || h < 70) return { staticRects, blinkRects };

  // Whiteboard: large light rect centered on the wall.
  const boardW = Math.min(w - 16, 110);
  const boardH = Math.min(h - 22, 56);
  const boardX = rect.xLeft + Math.floor((w - boardW) / 2);
  const boardY = rect.yTop + Math.floor((h - boardH) / 2) - 4;
  // Frame
  staticRects.push({
    x: boardX - 2,
    y: boardY - 2,
    width: boardW + 4,
    height: boardH + 4,
    color: c.boardFrame,
    alpha: 0.9,
  });
  // Surface
  staticRects.push({
    x: boardX,
    y: boardY,
    width: boardW,
    height: boardH,
    color: c.boardSurface,
    alpha: 0.85,
  });
  // Marker tray
  staticRects.push({
    x: boardX,
    y: boardY + boardH + 2,
    width: boardW,
    height: 2,
    color: c.boardFrame,
    alpha: 0.9,
  });

  // 4 diagram blocks connected by thin horizontal lines.
  const blockW = 16;
  const blockH = 10;
  const blockY = boardY + Math.floor(boardH / 2) - blockH / 2;
  const blockSpacing = Math.floor((boardW - blockW * 4) / 5);
  for (let i = 0; i < 4; i++) {
    const bx = boardX + blockSpacing + i * (blockW + blockSpacing);
    const color = i === 1 || i === 3 ? c.boardMarkerAlt : c.boardMarker;
    staticRects.push({
      x: bx,
      y: blockY,
      width: blockW,
      height: blockH,
      color,
      alpha: 0.85,
    });
    // Connecting arrow (thin horizontal line) to next block
    if (i < 3) {
      staticRects.push({
        x: bx + blockW,
        y: blockY + Math.floor(blockH / 2),
        width: blockSpacing,
        height: 1,
        color: c.boardMarker,
        alpha: 0.7,
      });
    }
  }
  // Title bar above blocks (a marker-stroke).
  staticRects.push({
    x: boardX + 6,
    y: boardY + 6,
    width: Math.floor(boardW * 0.4) + Math.floor(rand() * 6),
    height: 2,
    color: c.boardMarker,
    alpha: 0.7,
  });

  return { staticRects, blinkRects };
}

function specForBusinessPL(rect: SideRect, _side: Side, seed: number): FloorBackdropSpec {
  const rand = rng(seed ^ 0xb1a_de51);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];
  if (w < 80 || h < 70) return { staticRects, blinkRects };

  // Desk runs along bottom of the band.
  const deskH = 16;
  const deskY = rect.yBottom - deskH - 6;
  staticRects.push({
    x: rect.xLeft + 6,
    y: deskY,
    width: w - 12,
    height: deskH,
    color: c.deskSurface,
    alpha: 0.95,
  });
  // Desk top edge highlight
  staticRects.push({
    x: rect.xLeft + 6,
    y: deskY,
    width: w - 12,
    height: 1,
    color: c.deskEdge,
    alpha: 0.9,
  });

  // Monitor centered on the desk.
  const monW = Math.min(54, Math.max(36, Math.floor(w * 0.45)));
  const monH = Math.min(34, Math.max(24, Math.floor(h * 0.45)));
  const monX = rect.xLeft + Math.floor((w - monW) / 2);
  const monY = deskY - monH - 2;
  // Bezel
  staticRects.push({
    x: monX,
    y: monY,
    width: monW,
    height: monH,
    color: c.monitorBezel,
    alpha: 0.95,
  });
  // Screen
  const screenInset = 2;
  staticRects.push({
    x: monX + screenInset,
    y: monY + screenInset,
    width: monW - screenInset * 2,
    height: monH - screenInset * 2,
    color: c.monitorScreen,
    alpha: 0.95,
  });
  // Stand
  staticRects.push({
    x: monX + Math.floor(monW / 2) - 2,
    y: monY + monH,
    width: 4,
    height: 2,
    color: c.monitorBezel,
    alpha: 0.95,
  });

  // Chart: 5 bars rising along the screen, 2 of them blink to imply
  // "live data."
  const barCount = 5;
  const screenX = monX + screenInset;
  const screenY = monY + screenInset;
  const screenW = monW - screenInset * 2;
  const screenH = monH - screenInset * 2;
  const barGap = 2;
  const barW = Math.max(2, Math.floor((screenW - 6 - barGap * (barCount - 1)) / barCount));
  const heights = [3, 5, 4, 7, 6];
  for (let i = 0; i < barCount; i++) {
    const bh = Math.min(screenH - 6, (heights[i] ?? 4) + Math.floor(rand() * 2));
    const bx = screenX + 3 + i * (barW + barGap);
    const by = screenY + screenH - 3 - bh;
    if (i === 1 || i === 3) {
      blinkRects.push({
        x: bx,
        y: by,
        width: barW,
        height: bh,
        color: c.monitorChart,
        alpha: 0.95,
        blink: {
          lo: 0.4,
          hi: 1,
          durationMs: 1400 + i * 380,
          delayMs: i * 220,
        },
      });
    } else {
      staticRects.push({
        x: bx,
        y: by,
        width: barW,
        height: bh,
        color: c.monitorChart,
        alpha: 0.7,
      });
    }
  }

  // Coffee mug silhouette on the desk.
  const mugX = rect.xLeft + 12 + Math.floor(rand() * 6);
  staticRects.push({
    x: mugX,
    y: deskY - 5,
    width: 5,
    height: 5,
    color: c.panelEdge,
    alpha: 0.9,
  });

  return { staticRects, blinkRects };
}

function specForBusinessCS(rect: SideRect, _side: Side, seed: number): FloorBackdropSpec {
  const rand = rng(seed ^ 0xc05_5dee);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];
  if (w < 80 || h < 70) return { staticRects, blinkRects };

  // Cubicle dividers — vertical short walls along the band, evenly spaced.
  const dividerCount = 3;
  const dividerW = 4;
  const dividerH = Math.min(48, Math.floor(h * 0.55));
  const dividerY = rect.yBottom - dividerH - 6;
  const stride = Math.floor((w - 16) / dividerCount);
  for (let i = 0; i < dividerCount; i++) {
    const dx = rect.xLeft + 8 + Math.floor(stride * (i + 0.5)) - dividerW / 2;
    staticRects.push({
      x: dx,
      y: dividerY,
      width: dividerW,
      height: dividerH,
      color: c.cubicleDivider,
      alpha: 0.9,
    });
    // Divider top accent.
    staticRects.push({
      x: dx,
      y: dividerY,
      width: dividerW,
      height: 1,
      color: c.cubicleAccent,
      alpha: 0.95,
    });
  }

  // "Ticket queue" mini-screen mounted on the wall.
  const screenW = 22;
  const screenH = 14;
  const screenX = rect.xLeft + Math.floor((w - screenW) / 2);
  const screenY = rect.yTop + 14 + Math.floor(rand() * 4);
  staticRects.push({
    x: screenX - 1,
    y: screenY - 1,
    width: screenW + 2,
    height: screenH + 2,
    color: c.monitorBezel,
    alpha: 0.95,
  });
  staticRects.push({
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    color: c.ticketScreen,
    alpha: 0.95,
  });
  // Ticket-number rows inside (3 horizontal lines).
  for (let row = 0; row < 3; row++) {
    staticRects.push({
      x: screenX + 2,
      y: screenY + 3 + row * 4,
      width: screenW - 6 - row * 2,
      height: 1,
      color: c.ticketGlow,
      alpha: 0.7,
    });
  }
  // Blinking "current" indicator dot.
  blinkRects.push({
    x: screenX + screenW - 4,
    y: screenY + 2,
    width: 2,
    height: 2,
    color: c.ticketGlow,
    alpha: 0.95,
    blink: { lo: 0.3, hi: 1, durationMs: 1100, delayMs: 0 },
  });

  // Headset glyph silhouette on a divider — small arc + earcup pair.
  const hsX = rect.xLeft + 12;
  const hsY = rect.yTop + 24;
  // Headband
  staticRects.push({ x: hsX, y: hsY, width: 10, height: 1, color: c.cubicleAccent, alpha: 0.9 });
  // Earcups
  staticRects.push({ x: hsX - 1, y: hsY + 1, width: 3, height: 4, color: c.cubicleAccent, alpha: 0.9 });
  staticRects.push({ x: hsX + 8, y: hsY + 1, width: 3, height: 4, color: c.cubicleAccent, alpha: 0.9 });

  return { staticRects, blinkRects };
}

function specForExecutive(rect: SideRect, side: Side, seed: number): FloorBackdropSpec {
  const rand = rng(seed ^ 0xe7e_c0a7);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];
  if (w < 70 || h < 60) return { staticRects, blinkRects };

  // Wood panelling: 3 horizontal bands faking grain lighting.
  const wainscotH = Math.min(h - 8, 80);
  const wainscotY = rect.yBottom - wainscotH - 4;
  staticRects.push({
    x: rect.xLeft + 4,
    y: wainscotY,
    width: w - 8,
    height: wainscotH,
    color: c.woodMid,
    alpha: 0.92,
  });
  // Top trim (lighter).
  staticRects.push({
    x: rect.xLeft + 4,
    y: wainscotY,
    width: w - 8,
    height: 2,
    color: c.woodLight,
    alpha: 0.95,
  });
  // Vertical chair-rail divisions every ~36 px.
  for (let x = rect.xLeft + 18; x < rect.xRight - 8; x += 36) {
    staticRects.push({
      x,
      y: wainscotY + 4,
      width: 1,
      height: wainscotH - 8,
      color: c.woodDark,
      alpha: 0.7,
    });
  }
  // Brass kickplate near floor.
  staticRects.push({
    x: rect.xLeft + 4,
    y: rect.yBottom - 6,
    width: w - 8,
    height: 1,
    color: c.brass,
    alpha: 0.4,
  });

  // Bookshelf silhouette (one tall shelf cluster on the inboard side).
  const shelfW = Math.min(46, Math.floor(w * 0.55));
  const shelfH = Math.min(wainscotH - 8, 56);
  const shelfX =
    side === 'left'
      ? rect.xRight - shelfW - 10
      : rect.xLeft + 10;
  const shelfY = wainscotY + Math.floor((wainscotH - shelfH) / 2);
  // Shelf carcase (slightly darker than panel).
  staticRects.push({
    x: shelfX,
    y: shelfY,
    width: shelfW,
    height: shelfH,
    color: c.woodDark,
    alpha: 0.9,
  });
  // 3 horizontal shelves
  const shelves = 3;
  for (let i = 1; i <= shelves; i++) {
    const sy = shelfY + Math.floor((shelfH * i) / (shelves + 1));
    staticRects.push({
      x: shelfX + 2,
      y: sy,
      width: shelfW - 4,
      height: 1,
      color: c.woodLight,
      alpha: 0.9,
    });
    // Books on each shelf — small vertical ticks of varying heights.
    let bx = shelfX + 3;
    while (bx < shelfX + shelfW - 4) {
      const bw = 2 + Math.floor(rand() * 2);
      const bh = 6 + Math.floor(rand() * 5);
      const palette = [c.boardMarker, c.boardMarkerAlt, c.brass, c.woodLight];
      const colour = palette[Math.floor(rand() * palette.length)] ?? c.woodLight;
      staticRects.push({
        x: bx,
        y: sy - bh,
        width: bw,
        height: bh,
        color: colour,
        alpha: 0.9,
      });
      bx += bw + 1;
    }
  }

  // Warm desk lamp blink — a small puck above one of the shelves.
  const lampX = side === 'left' ? rect.xLeft + 14 : rect.xRight - 18;
  const lampY = wainscotY + 6;
  staticRects.push({
    x: lampX,
    y: lampY,
    width: 4,
    height: 4,
    color: c.brass,
    alpha: 0.95,
  });
  blinkRects.push({
    x: lampX - 2,
    y: lampY + 4,
    width: 8,
    height: 4,
    color: c.lampWarm,
    alpha: 0.7,
    blink: { lo: 0.45, hi: 0.85, durationMs: 2800, delayMs: 0 },
  });

  return { staticRects, blinkRects };
}

function specForProducts(
  rect: SideRect,
  side: Side,
  seed: number,
  blocked: BlockedRange[],
): FloorBackdropSpec {
  const rand = rng(seed ^ 0x9b07_d05);
  const c = theme.color.floorBackdrop;
  const w = rect.xRight - rect.xLeft;
  const h = rect.yBottom - rect.yTop;
  const staticRects: BackdropRect[] = [];
  const blinkRects: BackdropBlinkRect[] = [];
  if (w < 60 || h < 60) return { staticRects, blinkRects };

  // Vertical pipe runs along the inboard edge (closest to the shaft) so
  // they stay clear of the outer wall window grid. Skip if the pipe X
  // overlaps a blocked range.
  const pipeX = side === 'left' ? rect.xRight - 10 : rect.xLeft + 6;
  if (!overlapsBlocked(pipeX, pipeX + 4, blocked)) {
    staticRects.push({
      x: pipeX,
      y: rect.yTop + 2,
      width: 4,
      height: h - 4,
      color: c.pipeBody,
      alpha: 0.95,
    });
    // Highlight stripe
    staticRects.push({
      x: pipeX,
      y: rect.yTop + 2,
      width: 1,
      height: h - 4,
      color: c.pipeEdge,
      alpha: 0.9,
    });
    // Pipe collars every 36 px.
    for (let py = rect.yTop + 16; py < rect.yBottom - 4; py += 36) {
      staticRects.push({
        x: pipeX - 1,
        y: py,
        width: 6,
        height: 3,
        color: c.pipeEdge,
        alpha: 0.95,
      });
    }
  }

  // Vent grille near the middle of the band, only if it fits clear of doors.
  const ventW = 28;
  const ventH = 16;
  const ventX = rect.xLeft + Math.floor((w - ventW) / 2);
  const ventY = rect.yTop + Math.floor(h * 0.35);
  if (!overlapsBlocked(ventX, ventX + ventW, blocked)) {
    // Frame
    staticRects.push({
      x: ventX - 1,
      y: ventY - 1,
      width: ventW + 2,
      height: ventH + 2,
      color: c.pipeEdge,
      alpha: 0.95,
    });
    // Body
    staticRects.push({
      x: ventX,
      y: ventY,
      width: ventW,
      height: ventH,
      color: c.ventGrille,
      alpha: 0.95,
    });
    // Slits — 5 horizontal stripes.
    for (let i = 0; i < 5; i++) {
      staticRects.push({
        x: ventX + 2,
        y: ventY + 2 + i * 3,
        width: ventW - 4,
        height: 1,
        color: c.ventSlit,
        alpha: 0.9,
      });
    }
  }

  // Signage rectangle with a contrasting bar — yellow caution or red exit.
  const signW = 18;
  const signH = 10;
  // Place sign offset toward the outer wall, half-band above the vent.
  const signX = rect.xLeft + 8 + Math.floor(rand() * Math.max(1, w - 24));
  const signY = rect.yTop + Math.max(8, Math.floor(h * 0.18));
  if (!overlapsBlocked(signX, signX + signW, blocked)) {
    const isExit = rand() < 0.5;
    staticRects.push({
      x: signX,
      y: signY,
      width: signW,
      height: signH,
      color: c.panelDark,
      alpha: 0.9,
    });
    staticRects.push({
      x: signX + 2,
      y: signY + 2,
      width: signW - 4,
      height: signH - 4,
      color: isExit ? c.signRed : c.signYellow,
      alpha: 0.9,
    });
    // Tiny inner "letter" stripe.
    staticRects.push({
      x: signX + 4,
      y: signY + Math.floor(signH / 2) - 1,
      width: signW - 8,
      height: 2,
      color: c.panelDark,
      alpha: 0.95,
    });
  }

  return { staticRects, blinkRects };
}

/* -------------------------------------------------------------------------- */

/**
 * Pick the right per-floor / per-side spec. PLATFORM and BUSINESS bands
 * carry split-room scenes (Platform/Architecture and Product
 * Leadership/Customer Success), so left and right sides get different
 * themes. Other floors use the same theme on both sides.
 */
export function specForBand(
  band: FloorBackdropBand,
  side: Side,
  rect: SideRect,
  blocked: BlockedRange[] = [],
): FloorBackdropSpec {
  const seed = (band.floorId * 0x9e3779b1) ^ (side === 'left' ? 0x1111 : 0x2222);
  switch (band.floorId) {
    case FLOORS.LOBBY:
      return specForLobby(rect, side, seed);
    case FLOORS.PLATFORM_TEAM:
      return side === 'left'
        ? specForPlatform(rect, side, seed)
        : specForArchitecture(rect, side, seed);
    case FLOORS.BUSINESS:
      return side === 'left'
        ? specForBusinessPL(rect, side, seed)
        : specForBusinessCS(rect, side, seed);
    case FLOORS.EXECUTIVE:
      return specForExecutive(rect, side, seed);
    case FLOORS.PRODUCTS:
      return specForProducts(rect, side, seed, blocked);
    default:
      return { staticRects: [], blinkRects: [] };
  }
}

/**
 * Render every per-floor backdrop into the scene. Static rects collapse
 * into one `Graphics` per side per band; blinking rects each become a
 * `Rectangle` GameObject with its own alpha tween. All objects sit at
 * depth 0.5 with scrollFactor 1 so they stay slab-aligned.
 */
export function drawFloorBackdrops(
  scene: Phaser.Scene,
  opts: FloorBackdropOptions,
): FloorBackdropHandle {
  const { sides, bands, blockedRanges = [] } = opts;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const DEPTH_STATIC = 0.5;
  const DEPTH_BLINK = 0.51;

  for (let s = 0; s < sides.length; s++) {
    const side: Side = s === 0 ? 'left' : 'right';
    const sideCfg = sides[s];
    if (!sideCfg) continue;
    if (sideCfg.xRight - sideCfg.xLeft <= 0) continue;

    for (const band of bands) {
      const rect: SideRect = {
        xLeft: sideCfg.xLeft,
        xRight: sideCfg.xRight,
        yTop: band.yTop,
        yBottom: band.yBottom,
      };
      if (rect.yBottom - rect.yTop <= 0) continue;
      const spec = specForBand(band, side, rect, blockedRanges);

      if (spec.staticRects.length > 0) {
        const gfx = scene.add.graphics().setDepth(DEPTH_STATIC).setScrollFactor(1, 1);
        for (const r of spec.staticRects) {
          gfx.fillStyle(r.color, r.alpha ?? 1);
          gfx.fillRect(r.x, r.y, r.width, r.height);
        }
        objects.push(gfx);
      }

      for (const b of spec.blinkRects) {
        const rectObj = scene.add
          .rectangle(b.x + b.width / 2, b.y + b.height / 2, b.width, b.height, b.color, b.alpha ?? 1)
          .setDepth(DEPTH_BLINK)
          .setScrollFactor(1, 1);
        objects.push(rectObj);
        const tw = scene.tweens.add({
          targets: rectObj,
          alpha: { from: b.blink.hi, to: b.blink.lo },
          duration: b.blink.durationMs,
          delay: b.blink.delayMs,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        tweens.push(tw);
      }
    }
  }

  return { objects, tweens };
}
