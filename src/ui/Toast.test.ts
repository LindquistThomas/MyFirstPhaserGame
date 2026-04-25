import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

import { Toast } from './Toast';

type DelayedCallFn = (delay: number, cb: () => void) => Phaser.Time.TimerEvent;
type TweenAddFn = (cfg: Record<string, unknown>) => { stop: () => void };
type TimerEvent = { remove: () => void };

function makeScene() {
  const tweens: Array<{ cfg: Record<string, unknown>; stub: { stop: ReturnType<typeof vi.fn> } }> = [];
  const timers: Array<{ delay: number; cb: () => void; stub: TimerEvent }> = [];

  const scene = {
    add: {
      container: vi.fn(() => {
        const c: Record<string, unknown> = {
          alpha: 1,
          visible: false,
        };
        c.setDepth = vi.fn().mockReturnValue(c);
        c.setScrollFactor = vi.fn().mockReturnValue(c);
        c.setAlpha = vi.fn((a: number) => { (c as { alpha: number }).alpha = a; return c; });
        c.setVisible = vi.fn((v: boolean) => { (c as { visible: boolean }).visible = v; return c; });
        c.add = vi.fn().mockReturnValue(c);
        return c;
      }),
      graphics: vi.fn(() => {
        const g: Record<string, unknown> = {};
        for (const m of ['clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect']) {
          g[m] = vi.fn().mockReturnThis();
        }
        return g;
      }),
      text: vi.fn(() => {
        const t: Record<string, unknown> = { text: '' };
        t.setOrigin = vi.fn().mockReturnValue(t);
        t.setText = vi.fn((s: string) => { (t as { text: string }).text = s; return t; });
        return t;
      }),
    },
    tweens: {
      add: vi.fn((cfg: Record<string, unknown>) => {
        const stub = { stop: vi.fn() };
        tweens.push({ cfg, stub });
        return stub;
      }) as unknown as TweenAddFn,
    },
    time: {
      delayedCall: vi.fn((delay: number, cb: () => void) => {
        const stub: TimerEvent = { remove: vi.fn() };
        timers.push({ delay, cb, stub });
        return stub as Phaser.Time.TimerEvent;
      }) as unknown as DelayedCallFn,
    },
    _tweens: tweens,
    _timers: timers,
  };

  return scene;
}

describe('Toast', () => {
  let scene: ReturnType<typeof makeScene>;

  beforeEach(() => {
    scene = makeScene();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts hidden with alpha 0 (container.visible = false)', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    expect(toast.isVisible()).toBe(false);
    // Alpha must be 0 so the fade-in actually animates from transparent
    const container = scene.add.container.mock.results[0]?.value as { alpha: number };
    expect(container.alpha).toBe(0);
  });

  it('shows the message after show() and sets container visible', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    toast.show('Storage full — close other tabs.');

    expect(toast.isVisible()).toBe(true);
    expect(toast.getMessage()).toBe('Storage full — close other tabs.');
  });

  it('resets container alpha to 0 before the fade-in tween so animation is visible', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    // Manually set alpha to 1 to simulate a partially-faded state
    const container = scene.add.container.mock.results[0]?.value as { alpha: number };
    (container as Record<string, unknown>).alpha = 1;

    toast.show('Test message');

    // setAlpha(0) should have been called during show() to reset before tweening
    const setAlpha = (container as Record<string, unknown>).setAlpha as ReturnType<typeof vi.fn>;
    expect(setAlpha).toHaveBeenCalledWith(0);
  });

  it('starts a fade-in tween when show() is called', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    toast.show('Test message');

    // A tween with alpha: 1 (fade-in) should be registered
    const fadeIn = scene._tweens.find((t) => t.cfg.alpha === 1);
    expect(fadeIn).toBeDefined();
  });

  it('stops the in-flight tween when show() is called again to prevent race with fade-out', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    toast.show('First message');

    const firstTweenStub = scene._tweens[0]?.stub;
    expect(firstTweenStub).toBeDefined();

    toast.show('Second message');

    // The first tween must have been stopped
    expect(firstTweenStub!.stop).toHaveBeenCalled();
  });

  it('schedules a dismiss timer of 5000 ms', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    toast.show('Test message');

    expect(scene._timers).toHaveLength(1);
    expect(scene._timers[0]?.delay).toBe(5_000);
    // Keep reference so the "auto-dismiss" test can fire it
    void toast;
  });

  it('hides the container after the dismiss timer fires (fade-out + setVisible false)', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    toast.show('Test message');

    // Fire the dismiss timer
    const timer = scene._timers[0];
    expect(timer).toBeDefined();
    timer!.cb();

    // A fade-out tween (alpha: 0) should be registered
    const fadeOut = scene._tweens.find((t) => t.cfg.alpha === 0);
    expect(fadeOut).toBeDefined();

    // Invoke the tween's onComplete to complete the hide
    const onComplete = fadeOut!.cfg.onComplete as (() => void) | undefined;
    expect(onComplete).toBeDefined();
    onComplete!();
    expect(toast.isVisible()).toBe(false);
  });

  it('resets the dismiss timer when show() is called again while showing', () => {
    const toast = new Toast(scene as unknown as Phaser.Scene);
    toast.show('First message');

    const firstTimerStub = scene._timers[0]?.stub;
    expect(firstTimerStub).toBeDefined();

    // Second show() while already visible
    toast.show('Second message');

    // The first timer's remove() should have been called
    expect(firstTimerStub!.remove).toHaveBeenCalled();
    // And a new timer scheduled
    expect(scene._timers).toHaveLength(2);
    expect(toast.getMessage()).toBe('Second message');
  });
});
