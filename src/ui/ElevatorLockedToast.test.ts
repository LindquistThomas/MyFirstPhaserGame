import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastShowSpy = vi.hoisted(() => vi.fn());
const toastDestroySpy = vi.hoisted(() => vi.fn());
const announceSpy = vi.hoisted(() => vi.fn());

vi.mock('phaser', () => ({
  default: { Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
}));

vi.mock('./Toast', () => ({
  Toast: class {
    show = toastShowSpy;
    destroy = toastDestroySpy;
  },
}));

vi.mock('./ariaLive', () => ({
  announce: announceSpy,
}));

import { ElevatorLockedToast } from './ElevatorLockedToast';

function makeScene() {
  const handlers = new Map<string, (payload: unknown) => void>();
  const shutdownHandlers: Array<() => void> = [];
  return {
    scopedEvents: {
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, handler);
      }),
    },
    events: {
      once: vi.fn((_event: string, handler: () => void) => {
        shutdownHandlers.push(handler);
      }),
    },
    _emitScoped: (event: string, payload: unknown) => handlers.get(event)?.(payload),
    _shutdown: () => shutdownHandlers.forEach((handler) => handler()),
  };
}

describe('ElevatorLockedToast', () => {
  beforeEach(() => {
    toastShowSpy.mockReset();
    toastDestroySpy.mockReset();
    announceSpy.mockReset();
  });

  it('shows lock toast and announces message for locked floor attempts', () => {
    const scene = makeScene();
    new ElevatorLockedToast(scene as never);

    scene._emitScoped('ui:locked-floor-attempted', {
      floorId: 3,
      requiredAu: 8,
      currentAu: 0,
    });

    const expected = 'Business locked — need 8 AU (you have 0/8)';
    expect(toastShowSpy).toHaveBeenCalledWith(expected, 2_000);
    expect(announceSpy).toHaveBeenCalledWith(expected);
  });

  it('destroys toast on scene shutdown', () => {
    const scene = makeScene();
    new ElevatorLockedToast(scene as never);

    scene._shutdown();

    expect(toastDestroySpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to generic floor label when floor id is not in level data', () => {
    const scene = makeScene();
    new ElevatorLockedToast(scene as never);

    scene._emitScoped('ui:locked-floor-attempted', {
      floorId: 999,
      requiredAu: 42,
      currentAu: 0,
    });

    const expected = 'Floor 999 locked — need 42 AU (you have 0/42)';
    expect(toastShowSpy).toHaveBeenCalledWith(expected, 2_000);
    expect(announceSpy).toHaveBeenCalledWith(expected);
  });
});
