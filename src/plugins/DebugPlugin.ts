import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

/** Height of the top HUD bar (AU counter, title). */
const HUD_TOP_H = 44;
/** Approximate top of the bottom instruction text zone. */
const HUD_BOTTOM_TOP = 915;

/**
 * ScenePlugin that adds a toggleable debug overlay (press D).
 *
 * When active:
 *  - Draws bounding boxes for all physics bodies (red = dynamic, green = static)
 *  - Shows cyan HUD safe-zone borders (top bar + bottom instruction text)
 *  - Shows FPS counter in the top-left corner
 */
export class DebugPlugin extends Phaser.Plugins.ScenePlugin {
  private legendText?: Phaser.GameObjects.Text;
  private toggleHandler?: () => void;
  private active = false;
  private gfx?: Phaser.GameObjects.Graphics;
  /** Screen-space graphics for HUD zone borders. */
  private hudGfx?: Phaser.GameObjects.Graphics;

  boot(): void {
    const events = this.systems!.events;
    events.on('start', this.onSceneStart, this);
    events.once('destroy', this.onSceneDestroy, this);
  }

  private onSceneStart(): void {
    const events = this.systems!.events;
    events.on('update', this.onUpdate, this);
    events.once('shutdown', this.onShutdown, this);

    this.active = !!this.game?.registry.get('debug_mode');

    this.toggleHandler = () => {
      this.active = !this.active;
      this.game?.registry.set('debug_mode', this.active);
      this.applyDebugState();
    };
    this.scene?.inputs.on('ToggleDebug', this.toggleHandler);

    this.createOverlay();
    this.applyDebugState();
  }

  private createOverlay(): void {
    if (!this.scene) return;
    // Depth high enough to draw on top of sprites/tiles so tiny or
    // overlapping physics bodies are never hidden behind scenery.
    this.gfx = this.scene.add.graphics().setDepth(998);

    // Screen-space HUD zone indicators
    this.hudGfx = this.scene.add.graphics().setDepth(998).setScrollFactor(0);
    this.drawHudZones();

    this.legendText = this.scene.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 4 },
      lineSpacing: 2,
    })
      .setDepth(999)
      .setScrollFactor(0)
      .setVisible(this.active);
  }

  /** Draw cyan borders around the top HUD bar and bottom instruction text. */
  private drawHudZones(): void {
    const g = this.hudGfx;
    if (!g) return;
    g.clear();
    g.lineStyle(2, 0x00ffff, 0.8);
    // Top HUD zone
    g.strokeRect(0, 0, GAME_WIDTH, HUD_TOP_H);
    // Bottom instruction zone
    g.strokeRect(0, HUD_BOTTOM_TOP, GAME_WIDTH, GAME_HEIGHT - HUD_BOTTOM_TOP);
  }

  private applyDebugState(): void {
    this.legendText?.setVisible(this.active);
    this.gfx?.setVisible(this.active);
    this.hudGfx?.setVisible(this.active);
    if (!this.active) this.gfx?.clear();
  }

  private getWorld(): Phaser.Physics.Arcade.World | undefined {
    return (this.scene as unknown as { physics: Phaser.Physics.Arcade.ArcadePhysics })
      ?.physics?.world;
  }

  private drawBodies(): void {
    const world = this.getWorld();
    const g = this.gfx;
    if (!world || !g) return;
    g.clear();

    // --- World bounds — magenta (invisible wall at canvas edges) ---
    if (world.bounds) {
      g.lineStyle(2, 0xff00ff, 0.9);
      g.strokeRect(world.bounds.x, world.bounds.y, world.bounds.width, world.bounds.height);
    }

    let staticCount = 0;
    let dynamicCount = 0;
    let disabledCount = 0;

    // --- Static bodies — translucent green fill + outline ---
    for (const b of world.staticBodies.entries) {
      const body = b as Phaser.Physics.Arcade.StaticBody;
      if (!body.enable) {
        this.drawDisabledBody(g, body.x, body.y, body.width, body.height);
        disabledCount++;
        continue;
      }
      staticCount++;
      g.fillStyle(0x00ff00, 0.18);
      g.fillRect(body.x, body.y, body.width, body.height);
      g.lineStyle(2, 0x00ff00, 0.95);
      g.strokeRect(body.x, body.y, body.width, body.height);
      this.markDisabledSides(g, body);
    }

    // --- Dynamic bodies — translucent red fill + outline + sprite-vs-body indicators ---
    for (const b of world.bodies.entries) {
      const body = b as Phaser.Physics.Arcade.Body;
      if (!body.enable) {
        this.drawDisabledBody(g, body.x, body.y, body.width, body.height);
        disabledCount++;
        continue;
      }
      dynamicCount++;

      g.fillStyle(0xff0000, 0.18);
      g.fillRect(body.x, body.y, body.width, body.height);
      g.lineStyle(2, 0xff2222, 0.95);
      g.strokeRect(body.x, body.y, body.width, body.height);
      this.markDisabledSides(g, body);

      // Body center
      const cx = body.x + body.width / 2;
      const cy = body.y + body.height / 2;
      g.fillStyle(0xffff00, 1);
      g.fillCircle(cx, cy, 2.5);

      // Game-object position (sprite origin). If this is offset from the
      // body, it exposes the hitbox-vs-sprite mismatch that can feel like
      // "being blocked by nothing".
      const go = body.gameObject as (Phaser.GameObjects.GameObject & { x?: number; y?: number }) | undefined;
      if (go && typeof go.x === 'number' && typeof go.y === 'number') {
        g.fillStyle(0x00ffff, 1);
        g.fillCircle(go.x, go.y, 2.5);
        if (Phaser.Math.Distance.Between(go.x, go.y, cx, cy) > 1) {
          g.lineStyle(1, 0x00ffff, 0.8);
          g.lineBetween(go.x, go.y, cx, cy);
        }
      }

      // Velocity indicator
      if (body.velocity.x !== 0 || body.velocity.y !== 0) {
        g.lineStyle(1, 0xffff00, 0.9);
        g.lineBetween(cx, cy, cx + body.velocity.x * 0.1, cy + body.velocity.y * 0.1);
      }
    }

    this.updateLegend(staticCount, dynamicCount, disabledCount);
  }

  /** Faint dashed grey outline for disabled bodies (not currently blocking). */
  private drawDisabledBody(g: Phaser.GameObjects.Graphics, x: number, y: number,
                           w: number, h: number): void {
    g.lineStyle(1, 0x888888, 0.4);
    const dash = 4;
    // Top / bottom
    for (let dx = 0; dx < w; dx += dash * 2) {
      g.lineBetween(x + dx, y, x + Math.min(dx + dash, w), y);
      g.lineBetween(x + dx, y + h, x + Math.min(dx + dash, w), y + h);
    }
    // Left / right
    for (let dy = 0; dy < h; dy += dash * 2) {
      g.lineBetween(x, y + dy, x, y + Math.min(dy + dash, h));
      g.lineBetween(x + w, y + dy, x + w, y + Math.min(dy + dash, h));
    }
  }

  /** Overlay an "X" on any side with checkCollision disabled. */
  private markDisabledSides(g: Phaser.GameObjects.Graphics,
                            body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): void {
    const c = body.checkCollision;
    if (c.up && c.down && c.left && c.right) return;
    g.lineStyle(2, 0xff9900, 0.95);
    const s = 6;
    if (!c.up) {
      const mx = body.x + body.width / 2;
      g.lineBetween(mx - s, body.y - s, mx + s, body.y + s);
      g.lineBetween(mx - s, body.y + s, mx + s, body.y - s);
    }
    if (!c.down) {
      const mx = body.x + body.width / 2;
      const y = body.y + body.height;
      g.lineBetween(mx - s, y - s, mx + s, y + s);
      g.lineBetween(mx - s, y + s, mx + s, y - s);
    }
    if (!c.left) {
      const my = body.y + body.height / 2;
      g.lineBetween(body.x - s, my - s, body.x + s, my + s);
      g.lineBetween(body.x - s, my + s, body.x + s, my - s);
    }
    if (!c.right) {
      const my = body.y + body.height / 2;
      const x = body.x + body.width;
      g.lineBetween(x - s, my - s, x + s, my + s);
      g.lineBetween(x - s, my + s, x + s, my - s);
    }
  }

  private updateLegend(staticCount: number, dynamicCount: number, disabledCount: number): void {
    if (!this.legendText) return;
    const sceneKey = this.scene?.sys.settings.key ?? '?';
    const lines: string[] = [
      `Scene: ${sceneKey}`,
    ];
    const extra = this.getSceneDebugInfo();
    if (extra.length) lines.push(...extra);
    lines.push(
      `FPS: ${Math.round(this.game?.loop.actualFps ?? 0)}`,
      `static: ${staticCount}  dynamic: ${dynamicCount}  disabled: ${disabledCount}`,
      'green=static  red=dynamic  magenta=world bounds',
      'cyan dot=sprite origin  yellow dot=body center',
      'orange X=disabled side  grey dashed=disabled body',
    );
    this.legendText.setText(lines);
  }

  /** Optional per-scene debug info. Scenes may implement `getDebugInfo(): string[]`. */
  private getSceneDebugInfo(): string[] {
    const s = this.scene as unknown as { getDebugInfo?: () => string[] } | undefined;
    if (!s || typeof s.getDebugInfo !== 'function') return [];
    try {
      const info = s.getDebugInfo();
      return Array.isArray(info) ? info.filter(line => typeof line === 'string') : [];
    } catch {
      return [];
    }
  }

  private onUpdate(): void {
    if (this.active && this.game) {
      this.drawBodies();
    }
  }

  private onShutdown(): void {
    this.systems?.events.off('update', this.onUpdate, this);
    if (this.toggleHandler) {
      this.scene?.inputs.off('ToggleDebug', this.toggleHandler);
      this.toggleHandler = undefined;
    }
    this.legendText?.destroy();
    this.legendText = undefined;
    this.gfx?.destroy();
    this.gfx = undefined;
    this.hudGfx?.destroy();
    this.hudGfx = undefined;
  }

  private onSceneDestroy(): void {
    this.onShutdown();
    this.systems?.events.off('start', this.onSceneStart, this);
  }
}
