import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Toast so tests have no Phaser dependency.
const showMock = vi.fn();
const destroyMock = vi.fn();
vi.mock('./Toast', () => ({
  Toast: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.show = showMock;
    this.destroy = destroyMock;
  }),
}));

import { mountBootErrorToast, _resetBootErrorCount } from './BootErrorToast';
import { eventBus } from '../systems/EventBus';

// A minimal fake scene that satisfies mountBootErrorToast's requirements.
function makeFakeScene() {
  const shutdownHandlers: (() => void)[] = [];
  return {
    events: {
      once: vi.fn((ev: string, fn: () => void) => {
        if (ev === 'shutdown') shutdownHandlers.push(fn);
      }),
    },
    fireShutdown() {
      for (const fn of shutdownHandlers) fn();
    },
  };
}

describe('mountBootErrorToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the pending counter so tests don't bleed into each other.
    _resetBootErrorCount();
    showMock.mockClear();
    destroyMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows one Toast when two consecutive music:load-error events fire within 500 ms', () => {
    const scene = makeFakeScene();
    mountBootErrorToast(scene as never);

    eventBus.emit('music:load-error', { key: 'music_a', url: 'music/a.ogg' });
    eventBus.emit('music:load-error', { key: 'music_b', url: 'music/b.ogg' });

    // Not shown yet — debounce window still open.
    expect(showMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(showMock).toHaveBeenCalledTimes(1);
    expect(showMock).toHaveBeenCalledWith(expect.stringContaining('failed to load'));

    // Clean up subscription.
    scene.fireShutdown();
  });

  it('shows the Toast after the debounce window for a single music:load-error', () => {
    const scene = makeFakeScene();
    mountBootErrorToast(scene as never);

    eventBus.emit('music:load-error', { key: 'music_a', url: 'music/a.ogg' });

    vi.advanceTimersByTime(499);
    expect(showMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(showMock).toHaveBeenCalledTimes(1);

    scene.fireShutdown();
  });

  it('shows one Toast for accumulated boot errors present at mount time', () => {
    // Simulate two boot:asset-error events that fired before the scene was created.
    // Drive them through the EventBus so the module-level subscriber updates the
    // counter exactly as it would in production.
    eventBus.emit('boot:asset-error', { key: 'music_menu', type: 'audio', url: '/music/menu.ogg' });
    eventBus.emit('boot:asset-error', { key: 'lobby_logo', type: 'svg', url: '/brand/logo.svg' });

    const scene = makeFakeScene();
    mountBootErrorToast(scene as never);

    vi.advanceTimersByTime(500);

    expect(showMock).toHaveBeenCalledTimes(1);

    scene.fireShutdown();
  });

  it('does not show Toast when no errors occurred', () => {
    const scene = makeFakeScene();
    _resetBootErrorCount();
    mountBootErrorToast(scene as never);

    vi.advanceTimersByTime(1000);
    expect(showMock).not.toHaveBeenCalled();

    scene.fireShutdown();
  });

  it('cancels the pending Toast and destroys on scene shutdown', () => {
    const scene = makeFakeScene();
    mountBootErrorToast(scene as never);

    eventBus.emit('music:load-error', { key: 'music_a', url: 'music/a.ogg' });

    // Shut down before the debounce window closes.
    scene.fireShutdown();

    vi.advanceTimersByTime(1000);

    expect(showMock).not.toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('ignores music:load-error events after scene shutdown', () => {
    const scene = makeFakeScene();
    mountBootErrorToast(scene as never);
    scene.fireShutdown();

    eventBus.emit('music:load-error', { key: 'music_a', url: 'music/a.ogg' });
    vi.advanceTimersByTime(1000);
    expect(showMock).not.toHaveBeenCalled();
  });
});
