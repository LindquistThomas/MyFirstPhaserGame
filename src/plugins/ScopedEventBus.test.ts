import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Phaser with the minimal surface ScopedEventBus needs.
vi.mock('phaser', () => {
  class ScenePlugin {
    scene: unknown;
    systems: unknown;
    game: unknown;
    pluginKey: string;
    constructor(
      scene: { sys?: { events?: { once?: (e: string, fn: () => void) => void } } },
      pluginManager: { game?: unknown },
      pluginKey: string,
    ) {
      this.scene = scene;
      this.systems = scene?.sys;
      this.game = pluginManager?.game;
      this.pluginKey = pluginKey;
      scene?.sys?.events?.once?.('boot', () => (this as unknown as { boot?: () => void }).boot?.());
    }
  }
  const phaser = { Plugins: { ScenePlugin } };
  return { ...phaser, default: phaser };
});

import { ScopedEventBus } from './ScopedEventBus';
import { eventBus } from '../systems/EventBus';

type Listener = (...args: unknown[]) => void;

interface FakeEvents {
  handlers: Record<string, Array<{ fn: Listener; ctx?: unknown }>>;
  on: (ev: string, fn: Listener, ctx?: unknown) => void;
  once: (ev: string, fn: Listener, ctx?: unknown) => void;
  off: (ev: string, fn: Listener, ctx?: unknown) => void;
  emit: (ev: string) => void;
}

function makeFakeEvents(): FakeEvents {
  const handlers: Record<string, Array<{ fn: Listener; ctx?: unknown }>> = {};
  return {
    handlers,
    on(ev, fn, ctx) { (handlers[ev] ??= []).push({ fn, ctx }); },
    once(ev, fn, ctx) { (handlers[ev] ??= []).push({ fn, ctx }); },
    off(ev, fn) {
      const list = handlers[ev];
      if (!list) return;
      const i = list.findIndex((h) => h.fn === fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(ev) {
      for (const h of (handlers[ev] ?? []).slice()) h.fn.call(h.ctx);
    },
  };
}

interface Harness {
  plugin: ScopedEventBus;
  sceneEvents: FakeEvents;
}

function mountPlugin(): Harness {
  const sceneEvents = makeFakeEvents();
  const scene = { sys: { events: sceneEvents } };
  const pluginManager = { game: {} };

  const plugin = new ScopedEventBus(
    scene as never,
    pluginManager as never,
    'scopedEvents',
  );

  // Boot the plugin (Phaser calls this via 'boot' event in the mock constructor)
  sceneEvents.emit('boot');
  // Simulate scene start to wire up the shutdown listener
  sceneEvents.emit('start');

  return { plugin, sceneEvents };
}

describe('ScopedEventBus', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  describe('on()', () => {
    it('delivers events to the handler', () => {
      const { plugin } = mountPlugin();
      const fn = vi.fn();
      plugin.on('zone:enter', fn);
      eventBus.emit('zone:enter', 'room-1');
      expect(fn).toHaveBeenCalledWith('room-1');
    });

    it('auto-unsubscribes on scene shutdown', () => {
      const { plugin, sceneEvents } = mountPlugin();
      const fn = vi.fn();
      plugin.on('zone:enter', fn);

      sceneEvents.emit('shutdown');
      eventBus.emit('zone:enter', 'room-2');
      expect(fn).toHaveBeenCalledTimes(0);
    });

    it('multiple handlers all unsubscribe on shutdown', () => {
      const { plugin, sceneEvents } = mountPlugin();
      const a = vi.fn();
      const b = vi.fn();
      plugin.on('zone:enter', a);
      plugin.on('zone:exit', b);

      sceneEvents.emit('shutdown');
      eventBus.emit('zone:enter', 'x');
      eventBus.emit('zone:exit', 'x');
      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
    });
  });

  describe('once()', () => {
    it('fires exactly once', () => {
      const { plugin } = mountPlugin();
      const fn = vi.fn();
      plugin.once('zone:enter', fn);
      eventBus.emit('zone:enter', 'first');
      eventBus.emit('zone:enter', 'second');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('first');
    });

    it('cleans up on shutdown if the event never fires', () => {
      const { plugin, sceneEvents } = mountPlugin();
      const fn = vi.fn();
      plugin.once('zone:enter', fn);

      sceneEvents.emit('shutdown');
      eventBus.emit('zone:enter', 'late');
      expect(fn).not.toHaveBeenCalled();
    });

    it('leaves no ghost listener after firing', () => {
      const { plugin } = mountPlugin();
      const fn = vi.fn();
      plugin.once('sfx:jump', fn);
      eventBus.emit('sfx:jump');

      // Verify the once-wrapper is gone from the global bus
      const outsider = vi.fn();
      eventBus.on('sfx:jump', outsider);
      eventBus.emit('sfx:jump');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(outsider).toHaveBeenCalledTimes(1);
      eventBus.off('sfx:jump', outsider);
    });
  });

  describe('off()', () => {
    it('unsubscribes an on() handler before shutdown', () => {
      const { plugin } = mountPlugin();
      const fn = vi.fn();
      plugin.on('zone:exit', fn);
      plugin.off('zone:exit', fn);
      eventBus.emit('zone:exit', 'gone');
      expect(fn).not.toHaveBeenCalled();
    });

    it('cancels a pending once() handler', () => {
      const { plugin } = mountPlugin();
      const fn = vi.fn();
      plugin.once('zone:enter', fn);
      plugin.off('zone:enter', fn);
      eventBus.emit('zone:enter', 'cancelled');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('scene restart', () => {
    it('accepts new subscriptions after shutdown + re-start', () => {
      const { plugin, sceneEvents } = mountPlugin();

      // First lifecycle
      const fn1 = vi.fn();
      plugin.on('zone:enter', fn1);
      sceneEvents.emit('shutdown');

      // Re-start
      sceneEvents.emit('start');
      const fn2 = vi.fn();
      plugin.on('zone:enter', fn2);
      eventBus.emit('zone:enter', 'restart');
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledWith('restart');

      // Cleanup
      sceneEvents.emit('shutdown');
    });
  });

  describe('destroy', () => {
    it('cleans up on destroy even without a prior shutdown', () => {
      const { plugin, sceneEvents } = mountPlugin();
      const fn = vi.fn();
      plugin.on('zone:enter', fn);

      sceneEvents.emit('destroy');
      eventBus.emit('zone:enter', 'destroyed');
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
