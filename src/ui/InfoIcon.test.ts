/**
 * Unit tests for InfoIcon cooldown chip.
 *
 * Covers:
 *   (a) startCooldown sets chip text to the expected "Retry in m:ss" format.
 *   (b) Formatting is correct for values ≥ 60 seconds.
 *   (c) The icon bg receives a grey desaturation tint when cooldown starts.
 *   (d) The grey tint is cleared when stopCooldown is called.
 *   (e) The timer updates the chip text every second via getCooldownRemaining.
 *   (f) Info-only icons (no contentId) are unaffected by startCooldown.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';
import { theme } from '../style/theme';

vi.mock('phaser', () => ({ default: {} }));

vi.mock('../systems/InfoDialogManager', () => ({
  hasBeenSeen: vi.fn(() => false),
  hasSeenAny: vi.fn(() => false),
}));

vi.mock('../input', () => ({
  actionPrompt: vi.fn(() => 'Press ↑'),
  initInputModeTracking: vi.fn(),
  promptLabel: vi.fn(() => '↑'),
}));

const mockGetCooldownRemaining = vi.fn((_infoId: string) => 0);
vi.mock('../systems/QuizManager', () => ({
  getCooldownRemaining: (infoId: string) => mockGetCooldownRemaining(infoId),
}));

// ---------------------------------------------------------------------------
// Phaser scene helpers
// ---------------------------------------------------------------------------

function makeText() {
  const obj: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'setOrigin', 'setScrollFactor', 'setDepth', 'setVisible',
    'setColor', 'setText', 'setInteractive', 'on', 'destroy',
  ]) {
    obj[name] = vi.fn().mockReturnThis();
  }
  return obj;
}

function makeGraphics() {
  const obj: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'clear', 'fillStyle', 'fillRect', 'fillRoundedRect', 'fillCircle',
    'lineStyle', 'strokeRect', 'strokeRoundedRect', 'strokeCircle',
    'setScrollFactor', 'setDepth', 'destroy',
  ]) {
    obj[name] = vi.fn().mockReturnThis();
  }
  return obj;
}

function makeImage() {
  const obj: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'setTint', 'clearTint', 'setVisible', 'setScale', 'setAlpha', 'setY',
  ]) {
    obj[name] = vi.fn().mockReturnThis();
  }
  return obj;
}

function makeContainer() {
  const c: Record<string, unknown> = { visible: false };
  for (const name of [
    'add', 'setDepth', 'setScrollFactor', 'setScale', 'setAlpha', 'destroy',
  ]) {
    c[name] = vi.fn().mockReturnThis();
  }
  c.setVisible = vi.fn().mockImplementation((v: boolean) => {
    c.visible = v;
    return c;
  });
  return c;
}

function makeCanvasCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    imageSmoothingEnabled: false,
    fillStyle: '',
    lineWidth: 0,
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    createRadialGradient: vi.fn(() => gradient),
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
  };
}

type FakeTimerEvent = { destroyed: boolean; destroy: ReturnType<typeof vi.fn> };

function makeScene() {
  const timerCallbacks: Array<{ callback: () => void; event: FakeTimerEvent }> = [];
  const hitAreaHandlers: Record<string, () => void> = {};

  const scene = {
    textures: {
      exists: vi.fn(() => false),
      createCanvas: vi.fn(() => ({
        getContext: vi.fn(() => makeCanvasCtx()),
        refresh: vi.fn(),
      })),
    },
    add: {
      container: vi.fn(() => makeContainer()),
      image: vi.fn(() => makeImage()),
      rectangle: vi.fn(() => {
        const rect = {
          setInteractive: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: () => void) => {
            hitAreaHandlers[event] = handler;
            return rect;
          }),
        };
        return rect;
      }),
      text: vi.fn(() => makeText()),
      graphics: vi.fn(() => makeGraphics()),
    },
    time: {
      addEvent: vi.fn((cfg: { callback: () => void }) => {
        const event: FakeTimerEvent = {
          destroyed: false,
          destroy: vi.fn(() => { event.destroyed = true; }),
        };
        timerCallbacks.push({ callback: cfg.callback, event });
        return event;
      }),
    },
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
    events: { once: vi.fn() },
    /** Tick the most-recently registered timer callback N times. */
    _tickTimer(times = 1): void {
      const entry = timerCallbacks[timerCallbacks.length - 1];
      if (!entry || entry.event.destroyed) return;
      for (let i = 0; i < times; i++) {
        if (entry.event.destroyed) break;
        entry.callback();
      }
    },
    /** The image mock at call-index i (0-based). 0 = ring, 1 = bg. */
    _image(i: number) {
      return (scene.add.image as ReturnType<typeof vi.fn>).mock.results[i]?.value as
        ReturnType<typeof makeImage>;
    },
    /** The text mock at call-index i (0-based). */
    _text(i: number) {
      return (scene.add.text as ReturnType<typeof vi.fn>).mock.results[i]?.value as
        ReturnType<typeof makeText>;
    },
    /** Simulate a pointer event on the hit area. */
    _triggerHitArea(event: string): void {
      hitAreaHandlers[event]?.();
    },
  };

  return scene;
}

// Must be imported after all mocks are declared.
import { InfoIcon } from './InfoIcon';
import { eventBus } from '../systems/EventBus';
import * as input from '../input';

describe('InfoIcon cooldown chip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.removeAllListeners();
    mockGetCooldownRemaining.mockReturnValue(0);
  });

  it('(a) displays "Retry in m:ss" text when startCooldown is called', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(18_000); // 18 seconds

    const chipText = scene._text(0); // first text = cooldown chip text
    expect(chipText.setText).toHaveBeenCalledWith('Retry in 0:18');
  });

  it('(b) formats cooldown correctly for values >= 60 seconds', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(90_000); // 1 minute 30 seconds

    const chipText = scene._text(0);
    expect(chipText.setText).toHaveBeenCalledWith('Retry in 1:30');
  });

  it('(b2) pads seconds to two digits', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(5_000); // 5 seconds → "0:05"

    const chipText = scene._text(0);
    expect(chipText.setText).toHaveBeenCalledWith('Retry in 0:05');
  });

  it('(c) applies a grey tint to the icon bg when cooldown starts', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(10_000);

    const bg = scene._image(1); // 0 = ring, 1 = bg
    expect(bg.setTint).toHaveBeenCalledWith(theme.color.status.lockedGrey);
  });

  it('(d) clears the grey tint when stopCooldown is called', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(10_000);
    icon.stopCooldown();

    const bg = scene._image(1);
    expect(bg.clearTint).toHaveBeenCalled();
  });

  it('(e) updates chip text each tick via getCooldownRemaining', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );
    icon.startCooldown(10_000);

    // Tick once — getCooldownRemaining returns 5 s remaining
    mockGetCooldownRemaining.mockReturnValue(5_000);
    scene._tickTimer();

    const chipText = scene._text(0); // first (and only) text = cooldown chip text
    // Last setText call should reflect 5-second remaining
    expect(chipText.setText).toHaveBeenLastCalledWith('Retry in 0:05');
  });

  it('(e2) clears cooldown and flashes when timer reaches zero', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(10_000);

    // Simulate expiry
    mockGetCooldownRemaining.mockReturnValue(0);
    scene._tickTimer();

    const bg = scene._image(1);
    // clearTint should have been called (from stopCooldown inside timer callback)
    expect(bg.clearTint).toHaveBeenCalled();
    // Flash tween should have been triggered
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('(f) startCooldown is a no-op for info-only icons (no contentId)', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(),
      /* contentId = */ undefined,
    );

    // Should not throw and should not create a timer
    icon.startCooldown(10_000);

    expect(scene.time.addEvent).not.toHaveBeenCalled();
  });

  it('(f2) startCooldown is a no-op when remainingMs is zero', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(0);

    expect(scene.time.addEvent).not.toHaveBeenCalled();
  });

  it('(g) pointerover during cooldown does NOT change the grey tint', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(10_000);

    const bg = scene._image(1);
    const setTintCallCount = (bg.setTint as ReturnType<typeof vi.fn>).mock.calls.length;

    // Hovering while locked must not call setTint again
    scene._triggerHitArea('pointerover');
    expect(bg.setTint).toHaveBeenCalledTimes(setTintCallCount);
  });

  it('(g2) pointerout during cooldown does NOT clear the grey tint', () => {
    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );

    icon.startCooldown(10_000);

    // pointerout while locked must not call clearTint
    const bg = scene._image(1);
    const clearTintCallsBefore = (bg.clearTint as ReturnType<typeof vi.fn>).mock.calls.length;

    scene._triggerHitArea('pointerout');
    expect(bg.clearTint).toHaveBeenCalledTimes(clearTintCallsBefore);
  });

  it('(h) refreshes visible hint label on input:mode-changed', () => {
    vi.mocked(input.actionPrompt)
      .mockReturnValueOnce('Press ↑')
      .mockReturnValueOnce('Tap');

    const scene = makeScene();
    const icon = new InfoIcon(
      scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-quiz',
    );
    icon.setVisible(true);

    const firstHintCall = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls
      .find((call) => call[2] === 'Press ↑');
    expect(firstHintCall).toBeDefined();

    eventBus.emit('input:mode-changed', 'touch');

    const secondHintCall = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls
      .find((call) => call[2] === 'Tap');
    expect(secondHintCall).toBeDefined();
  });
});

describe('InfoIcon visibility and badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCooldownRemaining.mockReturnValue(0);
  });

  it('setVisible(false) hides the container', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-id');
    icon.setVisible(false);
    // Container should have setVisible(false) called
    const container = (scene.add.container as ReturnType<typeof vi.fn>).mock.results[0]?.value as
      ReturnType<typeof makeContainer>;
    expect(container.setVisible).toHaveBeenCalledWith(false);
  });

  it('setVisible(true) on unseen icon starts attention animation', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-id');
    icon.setVisible(true);
    // tweens.add should have been called for the animation
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('setVisible(true) without contentId starts calm pulse', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn());
    icon.setVisible(true);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('markAsSeen() on visible attention-mode icon switches to calm mode', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-id');
    icon.setVisible(true); // starts in attention mode
    // Should not throw
    expect(() => icon.markAsSeen()).not.toThrow();
  });

  it('setQuizBadge creates badge elements and adds to container', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-id');
    icon.setQuizBadge(scene as unknown as Phaser.Scene, false);
    // scene.add.container called for badge
    expect(scene.add.container).toHaveBeenCalledTimes(2); // main container + badge
    expect(scene.add.graphics).toHaveBeenCalled();
    expect(scene.add.text).toHaveBeenCalled();
  });

  it('setQuizBadge(true) creates a checkmark badge', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-id');
    // Should not throw
    expect(() => icon.setQuizBadge(scene as unknown as Phaser.Scene, true)).not.toThrow();
  });

  it('destroy() stops tweens and destroys container', () => {
    const scene = makeScene();
    const icon = new InfoIcon(scene as unknown as Phaser.Scene, 0, 0, vi.fn(), 'test-id');
    // setVisible first to start some tweens
    icon.setVisible(true);
    icon.destroy();
    const container = (scene.add.container as ReturnType<typeof vi.fn>).mock.results[0]?.value as
      ReturnType<typeof makeContainer>;
    expect(container.destroy).toHaveBeenCalled();
  });
});
