import { describe, it, expect, vi } from 'vitest';
import { eventBus } from './EventBus';

describe('EventBus', () => {
  it('delivers a payload to a subscribed listener', () => {
    const fn = vi.fn();
    eventBus.on('music:play', fn);
    eventBus.emit('music:play', 'music_lobby');
    expect(fn).toHaveBeenCalledWith('music_lobby');
    eventBus.off('music:play', fn);
  });

  it('supports payload-less events', () => {
    const fn = vi.fn();
    eventBus.on('sfx:jump', fn);
    eventBus.emit('sfx:jump');
    expect(fn).toHaveBeenCalledTimes(1);
    eventBus.off('sfx:jump', fn);
  });

  it('stops delivering after unsubscribe', () => {
    const fn = vi.fn();
    eventBus.on('zone:enter', fn);
    eventBus.emit('zone:enter', 'z1');
    eventBus.off('zone:enter', fn);
    eventBus.emit('zone:enter', 'z2');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('z1');
  });

  it('isolates listeners between events', () => {
    const onEnter = vi.fn();
    const onExit = vi.fn();
    eventBus.on('zone:enter', onEnter);
    eventBus.on('zone:exit', onExit);

    eventBus.emit('zone:enter', 'door');
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();

    eventBus.off('zone:enter', onEnter);
    eventBus.off('zone:exit', onExit);
  });

  it('delivers to every subscriber of an event', () => {
    const a = vi.fn();
    const b = vi.fn();
    eventBus.on('sfx:quiz_correct', a);
    eventBus.on('sfx:quiz_correct', b);
    eventBus.emit('sfx:quiz_correct');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    eventBus.off('sfx:quiz_correct', a);
    eventBus.off('sfx:quiz_correct', b);
  });

  it('ignores emits for events with no subscribers', () => {
    expect(() => eventBus.emit('music:stop')).not.toThrow();
  });

  describe('once()', () => {
    it('fires exactly once', () => {
      const fn = vi.fn();
      eventBus.once('zone:enter', fn);
      eventBus.emit('zone:enter', 'a');
      eventBus.emit('zone:enter', 'b');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('a');
    });

    it('can be cancelled via off() before it fires', () => {
      const fn = vi.fn();
      eventBus.once('zone:enter', fn);
      eventBus.off('zone:enter', fn);
      eventBus.emit('zone:enter', 'x');
      expect(fn).not.toHaveBeenCalled();
    });

    it('leaves no ghost wrapper after firing', () => {
      const fn = vi.fn();
      eventBus.once('sfx:jump', fn);
      eventBus.emit('sfx:jump');
      // A second on() + emit verifies the listener set is clean
      const fn2 = vi.fn();
      eventBus.on('sfx:jump', fn2);
      eventBus.emit('sfx:jump');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      eventBus.off('sfx:jump', fn2);
    });
  });
});
