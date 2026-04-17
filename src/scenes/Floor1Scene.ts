import * as Phaser from 'phaser';
import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

/**
 * Floor 1 — Platform Team.
 *
 * Single-screen room (Impossible Mission style) with multiple platform
 * tiers connected by two in-room elevators.
 */
export class Floor1Scene extends LevelScene {
  constructor() {
    super('Floor1Scene', FLOORS.PLATFORM_TEAM);
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;
    const T1 = G - 220;
    const T2 = G - 440;
    const T3 = G - 660;

    // --- Platform-Team signpost: greets the player on entry ---
    this.add.image(260, G - 60, 'info_board').setDepth(3);
    this.add.text(260, G - 130, 'PLATFORM\n   TEAM', {
      fontFamily: 'monospace', fontSize: '13px', color: '#b8e6ff',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

    // --- "You build it, you run it" monitoring wall (animated) ---
    // Positioned between the ops desk (ends x≈798) and the right elevator
    // shaft (starts x≈1060).
    this.createMonitoringWall(930, G - 50);

    // Ground floor — server room feel
    this.add.image(500, G - 50, 'server_rack').setDepth(3);
    this.add.image(560, G - 50, 'server_rack').setDepth(3);
    this.add.image(620, G - 10, 'router').setDepth(3);
    this.add.image(750, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(500, G - 10, 'cables').setDepth(1);

    // Tier 1 — workstations
    this.add.image(700, T1 - 36, 'desk_monitor').setDepth(3);
    this.add.image(900, T1 - 22, 'monitor_dash').setDepth(3);
    this.add.image(1000, T1 - 10, 'router').setDepth(3);

    // Tier 2 — monitoring station
    this.add.image(250, T2 - 22, 'monitor_dash').setDepth(3);
    this.add.image(850, T2 - 50, 'server_rack').setDepth(3);
    this.add.image(850, T2 - 10, 'cables').setDepth(1);

    // Tier 3 — top level ops
    this.add.image(600, T3 - 36, 'desk_monitor').setDepth(11);
    this.add.image(750, T3 - 22, 'monitor_dash').setDepth(3);
    this.add.image(1000, T3 - 50, 'server_rack').setDepth(3);
    this.add.image(1060, T3 - 10, 'router').setDepth(3);
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
    const T1 = G - 220;                 // tier 1
    const T2 = G - 440;                 // tier 2
    const T3 = G - 660;                 // tier 3 (top)

    return {
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        // Ground floor — full width
        { x: 0, y: G, width: 10 },

        // Tier 1 — two platforms with a gap for elevator
        { x: 0, y: T1, width: 3 },
        { x: 640, y: T1, width: 5 },

        // Tier 2 — offset platforms
        { x: 128, y: T2, width: 4 },
        { x: 768, y: T2, width: 3 },

        // Tier 3 — top platforms
        { x: 0, y: T3, width: 3 },
        { x: 512, y: T3, width: 4 },
        { x: 896, y: T3, width: 3 },
      ],

      roomElevators: [
        // Left elevator: connects ground to tier 3
        // Room elevator is 12 px tall; center = surface + 6 aligns top with surface
        { x: 460, minY: T3 + 6, maxY: G + 6, startY: G + 6 },
        // Right elevator: connects tier 1 to tier 3
        { x: 1100, minY: T3 + 6, maxY: T1 + 6, startY: T1 + 6 },
      ],

      tokens: [
        // Ground level
        { x: 900, y: G - 40 },
        // Tier 1
        { x: 200, y: T1 - 40 },
        { x: 850, y: T1 - 40 },
        // Tier 2
        { x: 350, y: T2 - 40 },
        { x: 920, y: T2 - 40 },
        // Tier 3
        { x: 150, y: T3 - 40 },
        { x: 700, y: T3 - 40 },
        { x: 1050, y: T3 - 40 },
      ],

      infoPoints: [
        // Platform-team signpost — greets the player on entry (left side).
        { x: 260, y: G, contentId: 'platform-engineering' },
        // You-build-you-run — the animated monitoring wall on the ops deck.
        { x: 900, y: G, contentId: 'you-build-you-run' },
      ],
    };
  }
}
