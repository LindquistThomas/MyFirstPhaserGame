import * as Phaser from 'phaser';
import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

/**
 * Floor 1 — Platform Team.
 *
 * Flat single-screen room in the spirit of the lobby: one wide ground
 * floor, open walking space, and ambient decorations. The two info
 * points (the platform-team signpost on entry and the animated "PROD
 * OPS" monitoring wall on the right) are the focal points; no tiers or
 * in-room elevators to get stuck on.
 */
export class Floor1Scene extends LevelScene {
  constructor() {
    super('Floor1Scene', FLOORS.PLATFORM_TEAM);
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    // --- Ambient plants (same aesthetic as the lobby) ---
    // Behind the player (depth < 10)
    this.add.image(90, G - 40, 'plant_tall').setDepth(3);
    this.add.image(440, G - 32, 'plant_small').setDepth(3);
    this.add.image(1200, G - 40, 'plant_tall').setDepth(3);
    // In front of the player (depth > 10) — a little parallax
    this.add.image(160, G - 32, 'plant_small').setDepth(11);
    this.add.image(1100, G - 32, 'plant_small').setDepth(11);

    // --- Platform-Team signpost: greets the player on entry ---
    this.add.image(260, G - 60, 'info_board').setDepth(3);
    this.add.text(260, G - 130, 'PLATFORM\n   TEAM', {
      fontFamily: 'monospace', fontSize: '13px', color: '#b8e6ff',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // --- Workstations flanking the center ---
    this.add.image(560, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(680, G - 10, 'router').setDepth(3);

    // --- Server rack cluster on the right, behind the monitoring wall ---
    this.add.image(760, G - 50, 'server_rack').setDepth(3);
    this.add.image(760, G - 10, 'cables').setDepth(1);

    // --- "You build it, you run it" monitoring wall (animated) ---
    this.createMonitoringWall(930, G - 50);
  }

  /**
   * Live-looking "you build it, you run it" ops dashboard.
   *
   * Three screens above a shared console: a scrolling latency sparkline, a
   * bar chart of service health, and a blinking "LIVE" indicator. Redraws on
   * a timer so the player sees it update while reading the info panel. The
   * timer is owned by scene.time so it's destroyed automatically on shutdown.
   */
  private createMonitoringWall(cx: number, baseY: number): void {
    // --- static console frame ---
    const frame = this.add.graphics().setDepth(3);
    const W = 240, H = 130;
    const x = cx - W / 2, y = baseY - H - 20;
    frame.fillStyle(0x1a1a22, 1).fillRoundedRect(x, y, W, H, 6);
    frame.lineStyle(2, 0x3b4a5c, 1).strokeRoundedRect(x, y, W, H, 6);
    // legs so it reads as a rack/console
    frame.fillStyle(0x2a2a33, 1);
    frame.fillRect(x + 10, y + H, 6, 18);
    frame.fillRect(x + W - 16, y + H, 6, 18);
    // "OPS" label
    this.add.text(x + 8, y + 4, 'PROD OPS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8fb8e6', fontStyle: 'bold',
    }).setDepth(4);

    // Screen rects for reference (inside the frame)
    const lineRect = { x: x + 8,   y: y + 20, w: 100, h: 60 };
    const barRect  = { x: x + 116, y: y + 20, w: 72,  h: 60 };
    const liveRect = { x: x + 196, y: y + 20, w: 36,  h: 60 };

    // Draw the static screen backgrounds once
    frame.fillStyle(0x06101c, 1);
    frame.fillRect(lineRect.x, lineRect.y, lineRect.w, lineRect.h);
    frame.fillRect(barRect.x,  barRect.y,  barRect.w,  barRect.h);
    frame.fillRect(liveRect.x, liveRect.y, liveRect.w, liveRect.h);
    frame.lineStyle(1, 0x3b4a5c, 0.8);
    frame.strokeRect(lineRect.x, lineRect.y, lineRect.w, lineRect.h);
    frame.strokeRect(barRect.x,  barRect.y,  barRect.w,  barRect.h);
    frame.strokeRect(liveRect.x, liveRect.y, liveRect.w, liveRect.h);

    // Little captions under each screen
    const caption = (text: string, px: number, py: number, color: string) =>
      this.add.text(px, py, text, {
        fontFamily: 'monospace', fontSize: '9px', color,
      }).setDepth(4);
    caption('latency (ms)', lineRect.x + 2, lineRect.y + lineRect.h + 2, '#6fa8d6');
    caption('services',     barRect.x  + 2, barRect.y  + barRect.h  + 2, '#6fa8d6');
    caption('status',       liveRect.x + 2, liveRect.y + liveRect.h + 2, '#6fa8d6');

    // --- animated layer ---
    const live = this.add.graphics().setDepth(4);

    // Rolling sparkline buffer + bar-chart state
    const SPARK_POINTS = 24;
    const spark: number[] = Array.from({ length: SPARK_POINTS }, () => 0.3 + Math.random() * 0.3);
    const bars = [0.6, 0.8, 0.5, 0.7, 0.4];          // 5 services
    const barTargets = bars.slice();
    let pulse = 0;

    const redraw = () => {
      live.clear();

      // 1. sparkline (scrolls left, new value appended)
      spark.shift();
      // occasional spike so it looks realistic
      const last = spark[spark.length - 1] ?? 0.4;
      const next = Phaser.Math.Clamp(last + (Math.random() - 0.5) * 0.25, 0.1, 0.95);
      spark.push(Math.random() < 0.08 ? Math.min(0.95, next + 0.3) : next);

      live.lineStyle(1.5, 0x00d0ff, 1);
      live.beginPath();
      for (let i = 0; i < spark.length; i++) {
        const px = lineRect.x + 2 + (i * (lineRect.w - 4)) / (SPARK_POINTS - 1);
        const py = lineRect.y + lineRect.h - 2 - spark[i] * (lineRect.h - 4);
        if (i === 0) live.moveTo(px, py);
        else live.lineTo(px, py);
      }
      live.strokePath();

      // faint threshold line
      live.lineStyle(1, 0xff5577, 0.4);
      const thresholdY = lineRect.y + lineRect.h * 0.25;
      live.lineBetween(lineRect.x + 2, thresholdY, lineRect.x + lineRect.w - 2, thresholdY);

      // 2. bars (ease toward new random targets)
      for (let i = 0; i < bars.length; i++) {
        bars[i] = Phaser.Math.Linear(bars[i], barTargets[i], 0.15);
        if (Math.abs(bars[i] - barTargets[i]) < 0.02) {
          barTargets[i] = 0.25 + Math.random() * 0.7;
        }
        const slotW = (barRect.w - 4) / bars.length;
        const bx = barRect.x + 2 + i * slotW;
        const bh = bars[i] * (barRect.h - 6);
        const by = barRect.y + barRect.h - 3 - bh;
        // green/amber/red depending on height
        const col = bars[i] > 0.8 ? 0xff5577 : bars[i] > 0.6 ? 0xffaa00 : 0x4caf50;
        live.fillStyle(col, 1);
        live.fillRect(bx + 1, by, slotW - 3, bh);
      }

      // 3. blinking "LIVE" dot + uptime bars
      pulse = (pulse + 1) % 10;
      const dotColor = pulse < 5 ? 0xff3355 : 0x551122;
      live.fillStyle(dotColor, 1);
      live.fillCircle(liveRect.x + 10, liveRect.y + 12, 4);
      // three thin "uptime OK" ticks that fill/empty
      for (let i = 0; i < 3; i++) {
        const on = ((pulse + i) % 6) < 4;
        live.fillStyle(on ? 0x4caf50 : 0x244422, 1);
        live.fillRect(liveRect.x + 8, liveRect.y + 24 + i * 10, liveRect.w - 16, 6);
      }
    };

    redraw();
    this.time.addEvent({ delay: 160, loop: true, callback: redraw });
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;  // ground (full tile visible)

    return {
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        // Single wide ground floor — no tiers, lobby-style flat layout.
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Tokens scattered along the ground, steering clear of the signpost
      // and the monitoring console so the player can walk up to each.
      tokens: [
        { x: 380, y: G - 40 },
        { x: 500, y: G - 40 },
        { x: 620, y: G - 40 },
        { x: 830, y: G - 40 },
        { x: 1060, y: G - 40 },
        { x: 1180, y: G - 40 },
      ],

      infoPoints: [
        // Platform-team signpost — greets the player on entry (left side).
        { x: 260, y: G, contentId: 'platform-engineering' },
        // You-build-you-run — the animated monitoring wall on the ops deck.
        { x: 930, y: G, contentId: 'you-build-you-run' },
      ],
    };
  }
}
