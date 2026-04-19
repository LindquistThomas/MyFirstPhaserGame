import * as Phaser from 'phaser';
import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { theme } from '../../../style/theme';

/**
 * Floor 1 — Architecture room (right side of the Platform Team floor).
 *
 * Reached by stepping OFF the elevator to the RIGHT at floor 1.
 * Hosts four architecture-discipline info points, left→right:
 *   - architecture-team           (signpost / help desk)
 *   - c4-diagrams                 (whiteboard with a C4 sketch)
 *   - vertical-slice-architecture (stacked-slices wall display)
 *   - architecture-decision-records (warm-amber CRT terminal)
 *
 * Shares FLOORS.PLATFORM_TEAM with PlatformTeamScene (same "floor", two rooms).
 * Token indices are disjoint from PlatformTeamScene so collection state does
 * not collide across the shared ProgressionSystem bookkeeping.
 */
export class ArchitectureTeamScene extends LevelScene {
  /** First token index used in this room — must not overlap PlatformTeamScene. */
  private static readonly TOKEN_INDEX_OFFSET = 5;

  constructor() {
    super('ArchitectureTeamScene', FLOORS.PLATFORM_TEAM);
    this.returnSide = 'right';
  }

  protected override getBannerTitle(): string {
    return 'Architecture Team';
  }

  protected override getBannerDescription(): string {
    return 'Diagrams, decisions, and vertical slices.';
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // Ambient plants
    this.add.image(90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(160, G - 32, 'plant_small').setDepth(11);

    // ---- Anchor 1: Architecture-team signpost ----
    // The room's "help desk" — establishes the team's role.
    this.add.image(230, G - 60, 'info_board').setDepth(3);
    this.add.text(230, G - 130, 'ARCHITECTURE\n    TEAM', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffe6b8',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // ---- Anchor 2: C4 diagram whiteboard ----
    this.createC4Whiteboard(490, G - 50);

    // ---- Anchor 3: Vertical slices wall display ----
    this.createVerticalSliceWall(800, G - 50);

    // ---- Anchor 4: ADR archive terminal ----
    this.createAdrKiosk(1080, G - 50);
  }

  /**
   * Whiteboard sketching a tiny C4 context diagram: a system box in the
   * middle with a user and an external system around it. Purely decorative.
   */
  private createC4Whiteboard(cx: number, baseY: number): void {
    const W = 220;
    const H = 160;
    const x = cx - W / 2;
    const y = baseY - H - 10;

    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x5a3a20, 1).fillRect(x - 6, y - 6, W + 12, H + 12);
    g.fillStyle(0xf3f1e6, 1).fillRect(x, y, W, H);
    g.lineStyle(1, 0xa8a79a, 1).strokeRect(x, y, W, H);

    this.add.text(cx, y + 10, 'C4 — CONTEXT', {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a4a66', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    // Little stick figure on the left
    g.lineStyle(2, 0x333, 1);
    const ux = x + 28, uy = y + 80;
    g.strokeCircle(ux, uy, 6);
    g.lineBetween(ux, uy + 6, ux, uy + 22);
    g.lineBetween(ux - 8, uy + 14, ux + 8, uy + 14);
    g.lineBetween(ux, uy + 22, ux - 6, uy + 32);
    g.lineBetween(ux, uy + 22, ux + 6, uy + 32);
    this.add.text(ux, uy + 40, 'User', {
      fontFamily: 'monospace', fontSize: '9px', color: '#333',
    }).setOrigin(0.5).setDepth(4);

    // System box (center)
    g.lineStyle(2, 0x1f77b4, 1).strokeRect(x + 68, y + 60, 84, 48);
    this.add.text(x + 110, y + 78, 'System', {
      fontFamily: 'monospace', fontSize: '10px', color: '#1f77b4', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    this.add.text(x + 110, y + 94, '[in scope]', {
      fontFamily: 'monospace', fontSize: '8px', color: '#555',
    }).setOrigin(0.5).setDepth(4);

    // External system on the right (dashed)
    g.lineStyle(2, 0x888, 1);
    const ex = x + 176, ey = y + 70;
    for (let i = 0; i < 4; i++) {
      g.lineBetween(ex + i * 6, ey, ex + i * 6 + 3, ey);
      g.lineBetween(ex + i * 6, ey + 30, ex + i * 6 + 3, ey + 30);
    }
    g.lineBetween(ex, ey, ex, ey + 30);
    g.lineBetween(ex + 18, ey, ex + 18, ey + 30);
    this.add.text(ex + 9, ey + 15, 'Ext', {
      fontFamily: 'monospace', fontSize: '8px', color: '#555',
    }).setOrigin(0.5).setDepth(4);

    // Arrows user → system, system → external
    g.lineStyle(2, 0x444, 1);
    g.lineBetween(ux + 8, uy + 22, x + 68, y + 82);
    g.lineBetween(x + 152, y + 82, ex, ey + 15);

    // Marker tray
    g.fillStyle(0x8a6a40, 1).fillRect(x, y + H, W, 4);
    g.fillStyle(theme.color.status.danger, 1).fillRect(x + 20, y + H + 1, 14, 3);
    g.fillStyle(0x1976d2, 1).fillRect(x + 40, y + H + 1, 14, 3);
    g.fillStyle(0x388e3c, 1).fillRect(x + 60, y + H + 1, 14, 3);
  }

  /**
   * Wall display showing stacked "feature slices" — a visual metaphor
   * for vertical-slice architecture. A subtle highlight moves down the
   * stack so the player notices which slice is "active" right now.
   */
  private createVerticalSliceWall(cx: number, baseY: number): void {
    const W = 170;
    const H = 170;
    const x = cx - W / 2;
    const y = baseY - H - 10;

    const frame = this.add.graphics().setDepth(3);
    frame.fillStyle(0x1a2238, 1).fillRoundedRect(x, y, W, H, 6);
    frame.lineStyle(2, 0x3b5a8a, 1).strokeRoundedRect(x, y, W, H, 6);

    frame.fillStyle(0x3b5a8a, 1).fillRect(x + 4, y + 4, W - 8, 16);
    this.add.text(cx, y + 12, 'FEATURE SLICES', {
      fontFamily: 'monospace', fontSize: '10px', color: '#e8f1ff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    // Stack of slices
    const slices = [
      { name: 'CreateInvoice', col: 0x4fc3f7 },
      { name: 'VoidInvoice',   col: 0xba68c8 },
      { name: 'ListCustomers', col: 0x81c784 },
      { name: 'SendReceipt',   col: 0xffb74d },
      { name: 'RefundOrder',   col: 0xe57373 },
    ];

    const sliceX = x + 10;
    const sliceW = W - 20;
    const sliceH = 22;
    const top = y + 26;

    // Column "layers" behind the stack to evoke thin slices
    frame.fillStyle(0x263a5c, 0.6);
    frame.fillRect(sliceX, top, sliceW, slices.length * (sliceH + 2));

    const sliceRects: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < slices.length; i++) {
      const sy = top + i * (sliceH + 2);
      const r = this.add.rectangle(sliceX, sy, sliceW, sliceH, slices[i].col, 0.9)
        .setOrigin(0, 0).setDepth(4).setStrokeStyle(1, 0xffffff, 0.25);
      sliceRects.push(r);
      // left tab — HTTP | logic | data bands
      const g2 = this.add.graphics().setDepth(5);
      g2.fillStyle(0xffffff, 0.35);
      g2.fillRect(sliceX + 4, sy + 4, 6, sliceH - 8);
      g2.fillRect(sliceX + 14, sy + 4, 6, sliceH - 8);
      g2.fillRect(sliceX + 24, sy + 4, 6, sliceH - 8);

      this.add.text(sliceX + 38, sy + sliceH / 2, slices[i].name, {
        fontFamily: 'monospace', fontSize: '10px', color: '#0b1322', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(5);
    }

    // Caption
    this.add.text(cx, y + H - 10, 'one feature = one slice', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8fb8e6',
    }).setOrigin(0.5).setDepth(4);

    // Animated highlight: walk down the stack.
    let active = 0;
    const highlight = this.add.rectangle(sliceX - 2, top, sliceW + 4, sliceH, 0xffffff, 0)
      .setOrigin(0, 0).setDepth(6)
      .setStrokeStyle(2, 0xfff2b0, 0.9);
    const tick = () => {
      active = (active + 1) % slices.length;
      this.tweens.add({
        targets: highlight,
        y: top + active * (sliceH + 2),
        duration: 220,
        ease: 'Sine.easeInOut',
      });
      // subtle flash on the active slice
      const r = sliceRects[active];
      this.tweens.add({
        targets: r, alpha: 1, duration: 120, yoyo: true, onComplete: () => r.setAlpha(0.9),
      });
    };
    this.time.addEvent({ delay: 900, loop: true, callback: tick });
  }

  /**
   * "ADR ARCHIVE" — warm-amber CRT terminal with a scrolling list of
   * decision titles and a blinking cursor. Hosts the ADR info point.
   */
  private createAdrKiosk(cx: number, baseY: number): void {
    const W = 140;
    const H = 160;
    const x = cx - W / 2;
    const y = baseY - H - 10;

    const frame = this.add.graphics().setDepth(3);
    frame.fillStyle(0x3a2f1a, 1).fillRect(cx - W / 2 - 6, baseY - 10, W + 12, 10);
    frame.fillStyle(0x2a2218, 1).fillRect(cx - W / 2 - 2, baseY - 16, W + 4, 6);

    frame.fillStyle(0x2a1e12, 1).fillRoundedRect(x, y, W, H, 4);
    frame.lineStyle(2, 0x7a5e36, 1).strokeRoundedRect(x, y, W, H, 4);

    frame.fillStyle(0x7a5e36, 1).fillRect(x + 4, y + 4, W - 8, 16);
    this.add.text(cx, y + 12, 'ADR ARCHIVE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#1a0f05', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    const sx = x + 8;
    const sy = y + 26;
    const sw = W - 16;
    const sh = H - 36;
    frame.fillStyle(0x08140a, 1).fillRect(sx, sy, sw, sh);
    frame.lineStyle(1, 0xe0b860, 0.9).strokeRect(sx, sy, sw, sh);

    frame.fillStyle(theme.color.bg.dark, 0.25);
    for (let ly = sy + 1; ly < sy + sh; ly += 3) {
      frame.fillRect(sx + 1, ly, sw - 2, 1);
    }

    const live = this.add.graphics().setDepth(4);
    const textLayer = this.add.container(0, 0).setDepth(4);

    const ADRS = [
      'ADR-0001  Use PostgreSQL',
      'ADR-0002  Adopt ADRs',
      'ADR-0003  Blue/green deploys',
      'ADR-0004  Feature flags',
      'ADR-0005  Stop sharing DBs',
      'ADR-0006  Gateway per team',
      'ADR-0007  Structured logs',
      'ADR-0008  Contract tests',
      'ADR-0009  Canary rollouts',
      'ADR-0010  SLOs, not SLAs',
    ];

    const LINE_H = 11;
    const textObjs: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < ADRS.length; i++) {
      const t = this.add.text(sx + 6, 0, ADRS[i], {
        fontFamily: 'monospace', fontSize: '9px', color: '#f5c36a',
      });
      textLayer.add(t);
      textObjs.push(t);
    }

    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillStyle(0xffffff, 1).fillRect(sx, sy, sw, sh);
    textLayer.setMask(mask.createGeometryMask());

    let scroll = 0;
    const total = ADRS.length * LINE_H + sh;
    const cursorState = { on: true };

    const redraw = () => {
      scroll = (scroll + 0.6) % total;
      for (let i = 0; i < textObjs.length; i++) {
        const baseTY = sy + 6 + i * LINE_H - scroll;
        let ty = baseTY;
        if (ty < sy - LINE_H) ty += total;
        textObjs[i].setY(ty);
      }
      live.clear();
      cursorState.on = !cursorState.on;
      if (cursorState.on) {
        live.fillStyle(0xe0b860, 1);
        live.fillRect(sx + 2, sy + 6, 2, 9);
      }
      live.fillStyle(0xf5c36a, 0.08);
      live.fillRect(sx + 1, sy + 1, sw - 2, 4);
    };

    redraw();
    this.time.addEvent({ delay: 120, loop: true, callback: redraw });
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;
    const K = ArchitectureTeamScene.TOKEN_INDEX_OFFSET;

    return {
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Tokens arranged between anchors, reachable without overlapping info rects.
      tokens: [
        { x: 360,  y: G - 40, index: K + 0 },
        { x: 670,  y: G - 40, index: K + 1 },
        { x: 960,  y: G - 40, index: K + 2 },
        { x: 1200, y: G - 40, index: K + 3 },
      ],

      infoPoints: [
        {
          x: 230, y: G, contentId: 'architecture-team',
          zone: { shape: 'rect', width: 160, height: 220 },
        },
        {
          x: 490, y: G, contentId: 'c4-diagrams',
          zone: { shape: 'rect', width: 220, height: 220 },
        },
        {
          x: 800, y: G, contentId: 'vertical-slice-architecture',
          zone: { shape: 'rect', width: 180, height: 220 },
        },
        {
          x: 1080, y: G, contentId: 'architecture-decision-records',
          zone: { shape: 'rect', width: 160, height: 220 },
        },
      ],
    };
  }
}
