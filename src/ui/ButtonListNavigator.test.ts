import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

vi.mock('../style/theme', () => ({
  theme: {
    color: {
      ui: {
        accentAlt: 0x00aaff,
        hover: 0xffed4a,
      },
    },
  },
}));

function makeRing() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    'setScrollFactor', 'setDepth', 'setVisible', 'clear',
    'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'destroy',
  ]) {
    g[m] = vi.fn().mockReturnThis();
  }
  return g;
}

function makeScene() {
  const ring = makeRing();
  return {
    add: {
      graphics: vi.fn(() => ring),
    },
    _ring: ring,
  };
}

function makeFocusable(bounds = { x: 10, y: 20, width: 100, height: 30 }) {
  return {
    focus: vi.fn(),
    blur: vi.fn(),
    activate: vi.fn(),
    bounds: vi.fn(() => bounds as unknown as Phaser.Geom.Rectangle),
  };
}

import { ButtonListNavigator } from './ButtonListNavigator';

describe('ButtonListNavigator', () => {
  let scene: ReturnType<typeof makeScene>;
  let nav: ButtonListNavigator;

  beforeEach(() => {
    scene = makeScene();
    nav = new ButtonListNavigator(scene as unknown as Phaser.Scene);
  });

  it('wraps focus next and previous', () => {
    nav.add(makeFocusable());
    nav.add(makeFocusable());

    nav.setFocus(1);
    nav.focusNext();
    expect(nav.currentIndex()).toBe(0);

    nav.focusPrev();
    expect(nav.currentIndex()).toBe(1);
  });

  it('activates focused item', () => {
    const f = makeFocusable();
    nav.add(f);
    nav.setFocus(0);

    nav.activateFocused();
    expect(f.activate).toHaveBeenCalledTimes(1);
  });

  it('renders focus ring around focused bounds', () => {
    const f = makeFocusable({ x: 100, y: 200, width: 80, height: 20 });
    nav.add(f);

    nav.setFocus(0);

    expect(scene._ring.fillRoundedRect).toHaveBeenCalledWith(92, 194, 96, 32, 8);
    expect(scene._ring.strokeRoundedRect).toHaveBeenCalledWith(92, 194, 96, 32, 8);
    expect(scene._ring.setVisible).toHaveBeenCalledWith(true);
  });
});
