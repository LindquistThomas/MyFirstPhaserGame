import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as MotionPreference from '../systems/MotionPreference';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

vi.mock('../input', () => ({
  pushContext: vi.fn(() => ({ id: 'modal-token' })),
  popContext: vi.fn(),
}));

import { ModalBase } from './ModalBase';
import * as input from '../input';

class TestModal extends ModalBase {
  public afterCloseCalls = 0;

  public open(duration?: number): void {
    this.fadeIn(duration);
  }

  protected override onAfterClose(): void {
    this.afterCloseCalls += 1;
  }
}

function makeScene() {
  const container = {
    add: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  return {
    add: {
      container: vi.fn(() => container),
      rectangle: vi.fn(() => ({
        setScrollFactor: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
      })),
    },
    tweens: {
      add: vi.fn((cfg: Record<string, unknown>) => cfg),
    },
    inputs: { on: vi.fn(), off: vi.fn() },
    events: { once: vi.fn(), off: vi.fn() },
  };
}

describe('ModalBase reduced-motion tween behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(input.pushContext).mockClear();
    vi.mocked(input.popContext).mockClear();
  });

  it('uses duration 0 for fadeIn and close tweens when reduced motion is active', () => {
    vi.spyOn(MotionPreference, 'isReducedMotion').mockReturnValue(true);
    const scene = makeScene();
    const modal = new TestModal(scene as never);

    modal.open(200);
    modal.close();

    const tweenAdd = scene.tweens.add as ReturnType<typeof vi.fn>;
    expect(tweenAdd).toHaveBeenNthCalledWith(1, expect.objectContaining({ duration: 0 }));
    expect(tweenAdd).toHaveBeenNthCalledWith(2, expect.objectContaining({ duration: 0 }));
  });

  it('close tween still exposes onComplete callback for teardown state machine', () => {
    vi.spyOn(MotionPreference, 'isReducedMotion').mockReturnValue(true);
    const scene = makeScene();
    const modal = new TestModal(scene as never);

    modal.close();

    const tweenCfg = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      onComplete?: () => void;
    };
    expect(typeof tweenCfg.onComplete).toBe('function');
    tweenCfg.onComplete?.();
    expect(modal.afterCloseCalls).toBe(1);
  });
});
