import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

// ── Minimal stubs ──────────────────────────────────────────────────────────

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
    'setDepth', 'setScrollFactor',
  ]) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  t.setOrigin = vi.fn().mockReturnThis();
  return t as unknown as { setOrigin: ReturnType<typeof vi.fn> };
}

type PointerHandler = () => void;

function makeRectangle() {
  const handlers: Record<string, PointerHandler> = {};
  const r = {
    setInteractive: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, fn: PointerHandler) => {
      handlers[event] = fn;
      return r;
    }),
    _fire: (event: string) => handlers[event]?.(),
  };
  return r;
}

function makeContainer() {
  const items: unknown[] = [];
  const c = {
    add: vi.fn((item: unknown) => { items.push(item); return c; }),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    _items: items,
  };
  return c;
}

function makeScene() {
  const graphics: ReturnType<typeof makeGraphics>[] = [];
  const rectangles: ReturnType<typeof makeRectangle>[] = [];
  const containers: ReturnType<typeof makeContainer>[] = [];

  const scene = {
    add: {
      graphics: vi.fn(() => {
        const g = makeGraphics();
        graphics.push(g);
        return g;
      }),
      text: vi.fn((_x: number, _y: number, _s: string, _style?: unknown) => makeText()),
      rectangle: vi.fn((_x: number, _y: number, _w: number, _h: number) => {
        const r = makeRectangle();
        rectangles.push(r);
        return r;
      }),
      container: vi.fn((_x: number, _y: number) => {
        const c = makeContainer();
        containers.push(c);
        return c;
      }),
    },
    _graphics: graphics,
    _rectangles: rectangles,
    _containers: containers,
  };

  return scene;
}

import { CallElevatorButton } from './CallElevatorButton';

describe('CallElevatorButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a container with graphics, text, and hit-zone on construction', () => {
    const scene = makeScene();
    const cb = vi.fn();
    new CallElevatorButton(scene as unknown as Phaser.Scene, cb);

    expect(scene.add.container).toHaveBeenCalled();
    expect(scene.add.graphics).toHaveBeenCalled();
    expect(scene.add.text).toHaveBeenCalled();
    expect(scene.add.rectangle).toHaveBeenCalled();
  });

  it('calls the onCall callback on pointerup', () => {
    const scene = makeScene();
    const cb = vi.fn();
    new CallElevatorButton(scene as unknown as Phaser.Scene, cb);

    const hitZone = scene._rectangles[0]!;
    hitZone._fire('pointerup');

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onCall on pointerdown', () => {
    const scene = makeScene();
    const cb = vi.fn();
    new CallElevatorButton(scene as unknown as Phaser.Scene, cb);

    const hitZone = scene._rectangles[0]!;
    hitZone._fire('pointerdown');

    expect(cb).not.toHaveBeenCalled();
  });

  it('pointerdown redraws background in pressed state', () => {
    const scene = makeScene();
    const cb = vi.fn();
    new CallElevatorButton(scene as unknown as Phaser.Scene, cb);

    const gfx = scene._graphics[0]!;
    const clearBefore = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;

    scene._rectangles[0]!._fire('pointerdown');

    const clearAfter = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(clearAfter).toBeGreaterThan(clearBefore);
  });

  it('pointerout redraws background in released state', () => {
    const scene = makeScene();
    const cb = vi.fn();
    new CallElevatorButton(scene as unknown as Phaser.Scene, cb);

    const gfx = scene._graphics[0]!;
    const clearBefore = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;

    scene._rectangles[0]!._fire('pointerout');

    const clearAfter = (gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(clearAfter).toBeGreaterThan(clearBefore);
  });

  it('pointerupoutside redraws background in released state and does NOT call callback', () => {
    const scene = makeScene();
    const cb = vi.fn();
    new CallElevatorButton(scene as unknown as Phaser.Scene, cb);

    scene._rectangles[0]!._fire('pointerupoutside');

    expect(cb).not.toHaveBeenCalled();
    const gfx = scene._graphics[0]!;
    expect((gfx.clear as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('setVisible() delegates to the container', () => {
    const scene = makeScene();
    const btn = new CallElevatorButton(scene as unknown as Phaser.Scene, vi.fn());

    btn.setVisible(false);
    btn.setVisible(true);

    const container = scene._containers[0]!;
    expect(container.setVisible).toHaveBeenCalledWith(false);
    expect(container.setVisible).toHaveBeenCalledWith(true);
  });
});
