import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { SceneLoadingOverlay } from './SceneLoadingOverlay';

vi.mock('phaser', () => {
  class Container {
    scene: unknown;
    x: number;
    y: number;
    visible = true;
    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }
    setDepth = vi.fn().mockReturnThis();
    setScrollFactor = vi.fn().mockReturnThis();
    setVisible = vi.fn((visible: boolean) => {
      this.visible = visible;
      return this;
    });
    add = vi.fn();
  }
  return { default: { GameObjects: { Container } }, GameObjects: { Container } };
});

function makeText() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
}

describe('SceneLoadingOverlay', () => {
  it('shows loading state and starts animated dots timer', () => {
    const loadingText = makeText();
    const hintText = makeText();
    let tick: (() => void) | undefined;
    const timer = { remove: vi.fn() };
    const scene = {
      cameras: { main: { width: 1280, height: 720 } },
      add: {
        existing: vi.fn(),
        text: vi
          .fn()
          .mockReturnValueOnce(loadingText as never)
          .mockReturnValueOnce(hintText as never),
      },
      time: {
        addEvent: vi.fn((cfg: { callback: () => void }) => {
          tick = cfg.callback;
          return timer;
        }),
      },
    } as unknown as Phaser.Scene;

    const overlay = new SceneLoadingOverlay(scene);
    overlay.showLoading();
    tick?.();
    tick?.();

    expect(scene.add.existing).toHaveBeenCalledWith(overlay);
    expect(loadingText.setText).toHaveBeenCalledWith('Loading');
    expect(scene.time.addEvent).toHaveBeenCalled();
  });

  it('shows retry copy on error and hides overlay cleanly', () => {
    const loadingText = makeText();
    const hintText = makeText();
    const timer = { remove: vi.fn() };
    const scene = {
      cameras: { main: { width: 1280, height: 720 } },
      add: {
        existing: vi.fn(),
        text: vi
          .fn()
          .mockReturnValueOnce(loadingText as never)
          .mockReturnValueOnce(hintText as never),
      },
      time: {
        addEvent: vi.fn(() => timer),
      },
    } as unknown as Phaser.Scene;

    const overlay = new SceneLoadingOverlay(scene);
    overlay.showLoading();
    overlay.showError('Failed loading scene', 'Press Retry');
    overlay.hide();

    expect(loadingText.setText).toHaveBeenCalledWith('Failed loading scene');
    expect(hintText.setText).toHaveBeenCalledWith('Press Retry');
    expect(timer.remove).toHaveBeenCalled();
  });
});
