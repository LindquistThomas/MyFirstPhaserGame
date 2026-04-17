import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZoneManager } from './ZoneManager';
import { eventBus } from './EventBus';

describe('ZoneManager', () => {
  let zm: ZoneManager;
  const onEnter = vi.fn();
  const onExit = vi.fn();

  beforeEach(() => {
    zm = new ZoneManager();
    onEnter.mockClear();
    onExit.mockClear();
    eventBus.on('zone:enter', onEnter);
    eventBus.on('zone:exit', onExit);
  });

  afterEach(() => {
    // Unsubscribe here (not at the end of each test) so a failing test
    // doesn't leak listeners into the next one.
    eventBus.off('zone:enter', onEnter);
    eventBus.off('zone:exit', onExit);
  });

  it('emits zone:enter on the first frame a zone becomes active', () => {
    let active = false;
    zm.register('z', () => active);

    zm.update();
    expect(onEnter).not.toHaveBeenCalled();

    active = true;
    zm.update();
    expect(onEnter).toHaveBeenCalledWith('z');
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('only emits on state transitions, not every frame', () => {
    let active = true;
    zm.register('z', () => active);

    zm.update();
    zm.update();
    zm.update();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();

    active = false;
    zm.update();
    zm.update();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('getActiveZone reports the current zone after update', () => {
    let active = false;
    zm.register('z', () => active);

    expect(zm.getActiveZone()).toBeNull();
    active = true;
    zm.update();
    expect(zm.getActiveZone()).toBe('z');
    active = false;
    zm.update();
    expect(zm.getActiveZone()).toBeNull();
  });

  it('tracks multiple zones independently', () => {
    let a = false;
    let b = false;
    zm.register('a', () => a);
    zm.register('b', () => b);

    a = true;
    zm.update();
    expect(onEnter).toHaveBeenCalledWith('a');
    expect(onEnter).not.toHaveBeenCalledWith('b');

    b = true;
    zm.update();
    expect(onEnter).toHaveBeenCalledWith('b');
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('clear() removes registrations without firing events', () => {
    let active = true;
    zm.register('z', () => active);
    zm.update();
    onEnter.mockClear();
    onExit.mockClear();

    zm.clear();
    zm.update();
    expect(onEnter).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    expect(zm.getActiveZone()).toBeNull();
  });
});
