import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
    'setScrollFactor', 'setDepth', 'setX', 'destroy',
  ]) {
    g[name] = vi.fn().mockReturnThis();
  }
  // expose scene so shake() can read it
  (g as unknown as { scene: unknown }).scene = null; // assigned per test
  return g;
}

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn> | string> = {
    text: '',
  };
  t.setOrigin = vi.fn().mockReturnThis();
  t.setScrollFactor = vi.fn().mockReturnThis();
  t.setDepth = vi.fn().mockReturnThis();
  t.setText = vi.fn((s: string) => { t.text = s; return t; });
  t.destroy = vi.fn();
  return t as unknown as {
    text: string;
    setOrigin: ReturnType<typeof vi.fn>;
    setScrollFactor: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setText: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
}

function makeContainer() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.setScrollFactor = vi.fn().mockReturnThis();
  c.setDepth = vi.fn().mockReturnThis();
  c.destroy = vi.fn();
  return c as unknown as {
    setScrollFactor: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
}

function makeScene() {
  const tweensAdd = vi.fn((config: Record<string, unknown>) => ({
    stop: vi.fn(),
    targets: config.targets,
    onComplete: config.onComplete as (() => void) | undefined,
  }));

  const graphicsInstances: ReturnType<typeof makeGraphics>[] = [];
  const textInstances: ReturnType<typeof makeText>[] = [];
  const containerInstances: ReturnType<typeof makeContainer>[] = [];

  const scene = {
    add: {
      graphics: vi.fn(() => {
        const g = makeGraphics();
        (g as unknown as { scene: unknown }).scene = scene;
        graphicsInstances.push(g);
        return g;
      }),
      text: vi.fn((_x: number, _y: number, _s: string, _style?: unknown) => {
        const t = makeText();
        textInstances.push(t);
        return t;
      }),
      container: vi.fn((_x: number, _y: number, _items?: unknown[]) => {
        const c = makeContainer();
        containerInstances.push(c);
        return c;
      }),
    },
    tweens: { add: tweensAdd },
    _graphics: graphicsInstances,
    _texts: textInstances,
    _containers: containerInstances,
  };

  return scene;
}

import { BossHealthBar } from './BossHealthBar';

describe('BossHealthBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates graphics, label text, and container on construction', () => {
    const scene = makeScene();
    new BossHealthBar(scene as unknown as Phaser.Scene, 'THE BOSS', 10);

    expect(scene.add.graphics).toHaveBeenCalled();
    expect(scene.add.text).toHaveBeenCalled();
    expect(scene.add.container).toHaveBeenCalled();
  });

  it('draws the initial fill on construction', () => {
    const scene = makeScene();
    new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);

    const gfx = scene._graphics[0]!;
    expect(gfx.fillRoundedRect).toHaveBeenCalled();
  });

  it('update() redraws and shakes when HP changes', () => {
    const scene = makeScene();
    const bar = new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);

    const gfx = scene._graphics[0]!;
    const clearCallsBefore = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;

    bar.update(8);

    const clearCallsAfter = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(clearCallsAfter).toBeGreaterThan(clearCallsBefore);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('update() does NOT redraw when HP is unchanged', () => {
    const scene = makeScene();
    const bar = new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);

    const gfx = scene._graphics[0]!;
    const clearCallsBefore = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;

    bar.update(10); // same as initial HP

    const clearCallsAfter = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(clearCallsAfter).toBe(clearCallsBefore);
  });

  it('update() updates the label text to show new HP', () => {
    const scene = makeScene();
    const bar = new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);

    bar.update(5);

    const label = scene._texts[0]!;
    expect(label.setText).toHaveBeenCalledWith('5 / 10');
  });

  it('draw() uses gold fill when HP > 70%', () => {
    const scene = makeScene();
    new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);
    // HP = 10 → ratio 1.0 → gold (0xffd700)
    const gfx = scene._graphics[0]!;
    const fillStyleCalls = (gfx.fillStyle as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const goldCall = fillStyleCalls.find((args) => args[0] === 0xffd700);
    expect(goldCall).toBeTruthy();
  });

  it('draw() uses orange fill when HP is in the mid-range (30% < HP ≤ 70%)', () => {
    const scene = makeScene();
    const bar = new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);
    bar.update(5); // 50% → orange (0xff8c00)
    const gfx = scene._graphics[0]!;
    const fillStyleCalls = (gfx.fillStyle as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const orangeCall = fillStyleCalls.find((args) => args[0] === 0xff8c00);
    expect(orangeCall).toBeTruthy();
  });

  it('draw() uses red fill when HP ≤ 30%', () => {
    const scene = makeScene();
    const bar = new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);
    bar.update(3); // 30% exactly — should be red (0xcc2222)
    const gfx = scene._graphics[0]!;
    const fillStyleCalls = (gfx.fillStyle as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const redCall = fillStyleCalls.find((args) => args[0] === 0xcc2222);
    expect(redCall).toBeTruthy();
  });

  it('destroy() destroys container, graphics, and label', () => {
    const scene = makeScene();
    const bar = new BossHealthBar(scene as unknown as Phaser.Scene, 'Boss', 10);

    bar.destroy();

    expect(scene._containers[0]!.destroy).toHaveBeenCalled();
    expect(scene._graphics[0]!.destroy).toHaveBeenCalled();
    expect(scene._texts[0]!.destroy).toHaveBeenCalled();
  });
});
