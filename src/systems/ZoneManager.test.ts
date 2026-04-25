import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZoneManager } from './ZoneManager';
import { eventBus } from './EventBus';

type Listener = (...args: unknown[]) => void;

interface FakeScene {
  events: {
    on: (event: string, fn: Listener) => void;
    off: (event: string, fn: Listener) => void;
    emit: (event: string) => void;
  };
}

function makeScene(): FakeScene {
  const handlers: Record<string, Listener[]> = {};
  return {
    events: {
      on(event, fn) { (handlers[event] ??= []).push(fn); },
      off(event, fn) {
        handlers[event] = (handlers[event] ?? []).filter((h) => h !== fn);
      },
      emit(event) {
        for (const fn of handlers[event] ?? []) fn();
      },
    },
  };
}

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
    const active = true;
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

  it('bindScene auto-clears zones on scene shutdown', () => {
    const scene = makeScene();
    zm.bindScene(scene as never);

    zm.register('z', () => true);
    zm.update();
    expect(zm.getActiveZone()).toBe('z');

    scene.events.emit('shutdown');
    expect(zm.getActiveZone()).toBeNull();
  });

  it('bindScene can be called multiple times without adding duplicate handlers', () => {
    const scene = makeScene();
    zm.bindScene(scene as never);
    zm.bindScene(scene as never); // second call should not duplicate

    zm.register('z', () => true);
    zm.update();

    const clearSpy = vi.spyOn(zm, 'clear');
    scene.events.emit('shutdown');
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('zones from before shutdown are not present after auto-clear and re-registration', () => {
    const scene = makeScene();
    zm.bindScene(scene as never);

    zm.register('old', () => true);
    zm.update();
    expect(zm.getActiveZone()).toBe('old');

    // Simulate scene shutdown — auto-clear fires
    scene.events.emit('shutdown');

    // Simulate scene create() — register fresh zones
    zm.register('new', () => true);
    zm.update();
    expect(zm.getActiveZone()).toBe('new');
    // Old zone must not appear
    const allActive: string[] = [];
    const collectEnter = (id: string): void => { allActive.push(id); };
    eventBus.on('zone:enter', collectEnter);
    zm.update(); // no transition, already active
    expect(allActive).not.toContain('old');
    eventBus.off('zone:enter', collectEnter);
  });

  it('getActiveZone returns the highest-priority active zone', () => {
    zm.register('low', () => true, { priority: 1 });
    zm.register('high', () => true, { priority: 2 });

    zm.update();
    expect(zm.getActiveZone()).toBe('high');
  });

  it('getActiveZone falls back to lower priority when higher is inactive', () => {
    const a = true;
    let b = false;
    zm.register('low', () => a, { priority: 1 });
    zm.register('high', () => b, { priority: 2 });

    zm.update();
    expect(zm.getActiveZone()).toBe('low');

    b = true;
    zm.update();
    expect(zm.getActiveZone()).toBe('high');
  });

  it('register without priority defaults to 0, still wins over no active zones', () => {
    zm.register('default-prio', () => true);
    zm.update();
    expect(zm.getActiveZone()).toBe('default-prio');
  });
});
