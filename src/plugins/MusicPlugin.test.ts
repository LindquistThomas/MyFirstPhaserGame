import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal Phaser mock — only the surface MusicPlugin uses.
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

import { MusicPlugin } from './MusicPlugin';
import { eventBus } from '../systems/EventBus';

// ── Fake scene helpers ──────────────────────────────────────────────────────

type Listener = (...args: unknown[]) => void;

interface FakeEvents {
  on: (ev: string, fn: Listener, ctx?: unknown) => void;
  once: (ev: string, fn: Listener, ctx?: unknown) => void;
  off: (ev: string, fn: Listener, ctx?: unknown) => void;
  emit: (ev: string) => void;
  _handlers: Record<string, Array<{ fn: Listener; ctx?: unknown; once?: boolean }>>;
}

function makeFakeEvents(): FakeEvents {
  const _handlers: FakeEvents['_handlers'] = {};
  const fakeEvents: FakeEvents = {
    _handlers,
    on(ev, fn, ctx) { (_handlers[ev] ??= []).push({ fn, ctx }); },
    once(ev, fn, ctx) { (_handlers[ev] ??= []).push({ fn, ctx, once: true }); },
    off(ev, fn) {
      const list = _handlers[ev];
      if (!list) return;
      const i = list.findIndex((h) => h.fn === fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(ev) {
      const list = (_handlers[ev] ?? []).slice();
      for (const h of list) {
        h.fn.call(h.ctx);
        if (h.once) fakeEvents.off(ev, h.fn);
      }
    },
  };
  return fakeEvents;
}

interface FakeLoader {
  loadedKeys: string[];
  onceHandlers: Record<string, (() => void)[]>;
  audio: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  /** Helper: fire the filecomplete event for a key (simulates Phaser finishing load). */
  triggerComplete: (key: string) => void;
}

function makeFakeLoader(): FakeLoader {
  const loader: FakeLoader = {
    loadedKeys: [],
    onceHandlers: {},
    audio: vi.fn((key: string) => { loader.loadedKeys.push(key as string); }),
    once: vi.fn((event: string, fn: () => void) => {
      (loader.onceHandlers[event as string] ??= []).push(fn);
    }),
    start: vi.fn(),
    triggerComplete(key: string) {
      const ev = `filecomplete-audio-${key}`;
      for (const fn of (loader.onceHandlers[ev] ?? [])) fn();
      delete loader.onceHandlers[ev];
    },
  };
  return loader;
}

interface FakeCache {
  audio: { exists: ReturnType<typeof vi.fn> };
}

interface FakeScene {
  scene: { key: string };
  sys: { events: FakeEvents };
  cache: FakeCache;
  load: FakeLoader;
}

function makeScene(sceneKey: string, initialCachedKeys: string[] = []): FakeScene {
  const cachedKeys = new Set<string>(initialCachedKeys);
  return {
    scene: { key: sceneKey },
    sys: { events: makeFakeEvents() },
    cache: {
      audio: {
        exists: vi.fn((key: string) => cachedKeys.has(key as string)),
      },
    },
    load: makeFakeLoader(),
  };
}

// ── Plugin mount helper ─────────────────────────────────────────────────────

function mountPlugin(sceneKey: string, initialCachedKeys: string[] = []) {
  const fakeScene = makeScene(sceneKey, initialCachedKeys);
  const pluginManager = { game: {} };

  const plugin = new MusicPlugin(
    fakeScene as never,
    pluginManager as never,
    'music',
  );

  // Simulate plugin lifecycle: boot → start → create
  fakeScene.sys.events.emit('boot');
  fakeScene.sys.events.emit('start');

  return { plugin, fakeScene };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MusicPlugin', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  describe('playOrLoad() — first play (not cached)', () => {
    it('queues scene.load.audio with the correct path', () => {
      const { plugin, fakeScene } = mountPlugin('MenuScene');
      plugin.playOrLoad('music_menu');
      expect(fakeScene.load.audio).toHaveBeenCalledWith(
        'music_menu',
        expect.stringContaining('bgm_menu.mp3'),
      );
    });

    it('calls scene.load.start() to kick off the loader', () => {
      const { plugin, fakeScene } = mountPlugin('MenuScene');
      plugin.playOrLoad('music_menu');
      expect(fakeScene.load.start).toHaveBeenCalled();
    });

    it('does NOT emit music:play before loading completes', () => {
      const { plugin } = mountPlugin('MenuScene');
      const spy = vi.fn();
      eventBus.on('music:play', spy);
      plugin.playOrLoad('music_menu');
      // No triggerComplete call — loading still in progress
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits music:play with correct key once file is complete', () => {
      const { plugin, fakeScene } = mountPlugin('MenuScene');
      const spy = vi.fn();
      eventBus.on('music:play', spy);
      plugin.playOrLoad('music_menu');
      fakeScene.load.triggerComplete('music_menu');
      expect(spy).toHaveBeenCalledWith('music_menu');
    });
  });

  describe('playOrLoad() — second play (cached)', () => {
    it('emits music:play immediately without touching the loader', () => {
      const { plugin, fakeScene } = mountPlugin('MenuScene', ['music_menu']);

      const spy = vi.fn();
      eventBus.on('music:play', spy);
      plugin.playOrLoad('music_menu');

      expect(spy).toHaveBeenCalledWith('music_menu');
      expect(fakeScene.load.audio).not.toHaveBeenCalled();
      expect(fakeScene.load.start).not.toHaveBeenCalled();
    });
  });

  describe('playOrLoad() — unknown key', () => {
    it('still emits music:play so AudioManager can handle the miss gracefully', () => {
      const { plugin, fakeScene } = mountPlugin('MenuScene');
      const spy = vi.fn();
      eventBus.on('music:play', spy);

      plugin.playOrLoad('music_unknown_xyz');

      expect(spy).toHaveBeenCalledWith('music_unknown_xyz');
      expect(fakeScene.load.start).not.toHaveBeenCalled();
    });
  });

  describe('loadAndEmitPush() — push-stack lazy loading', () => {
    it('emits music:push immediately when key is cached', () => {
      const { plugin } = mountPlugin('PlatformTeamScene', ['music_quiz']);
      const spy = vi.fn();
      eventBus.on('music:push', spy);

      plugin.loadAndEmitPush('music_quiz');

      expect(spy).toHaveBeenCalledWith('music_quiz');
    });

    it('defers music:push until file is loaded when not cached', () => {
      const { plugin, fakeScene } = mountPlugin('PlatformTeamScene');
      const spy = vi.fn();
      eventBus.on('music:push', spy);

      plugin.loadAndEmitPush('music_quiz');

      expect(spy).not.toHaveBeenCalled();
      fakeScene.load.triggerComplete('music_quiz');
      expect(spy).toHaveBeenCalledWith('music_quiz');
    });

    it('queues load for the correct path', () => {
      const { plugin, fakeScene } = mountPlugin('PlatformTeamScene');
      plugin.loadAndEmitPush('music_quiz');
      expect(fakeScene.load.audio).toHaveBeenCalledWith(
        'music_quiz',
        expect.stringContaining('hostile_territory-loop1.ogg'),
      );
    });
  });

  describe('music:request event — scene-lifecycle subscription', () => {
    it('handles music:request while scene is active (not cached → deferred play)', () => {
      const { fakeScene } = mountPlugin('ElevatorScene');
      const spy = vi.fn();
      eventBus.on('music:play', spy);

      eventBus.emit('music:request', 'music_elevator_ride');

      expect(fakeScene.load.audio).toHaveBeenCalledWith(
        'music_elevator_ride',
        expect.stringContaining('bgm_action_3.mp3'),
      );
      expect(spy).not.toHaveBeenCalled();

      fakeScene.load.triggerComplete('music_elevator_ride');
      expect(spy).toHaveBeenCalledWith('music_elevator_ride');
    });

    it('handles music:request when key is already cached (immediate play)', () => {
      const { fakeScene } = mountPlugin('ElevatorScene', ['music_elevator_jazz']);
      const spy = vi.fn();
      eventBus.on('music:play', spy);

      eventBus.emit('music:request', 'music_elevator_jazz');

      expect(spy).toHaveBeenCalledWith('music_elevator_jazz');
      expect(fakeScene.load.start).not.toHaveBeenCalled();
    });

    it('unsubscribes from music:request on scene shutdown', () => {
      const { fakeScene } = mountPlugin('ElevatorScene');
      const spy = vi.fn();
      eventBus.on('music:play', spy);

      fakeScene.sys.events.emit('shutdown');

      // After shutdown, music:request should be ignored
      eventBus.emit('music:request', 'music_elevator_ride');
      expect(fakeScene.load.audio).not.toHaveBeenCalled();
    });

    it('re-subscribes to music:request after scene restart', () => {
      const { fakeScene } = mountPlugin('ElevatorScene');

      // First lifecycle
      fakeScene.sys.events.emit('shutdown');

      // Restart
      fakeScene.sys.events.emit('start');

      const spy = vi.fn();
      eventBus.on('music:play', spy);

      // Cache the key so it plays immediately
      (fakeScene.cache.audio.exists as ReturnType<typeof vi.fn>).mockReturnValue(true);
      eventBus.emit('music:request', 'music_elevator_jazz');
      expect(spy).toHaveBeenCalledWith('music_elevator_jazz');
    });
  });

  describe('music:request-push event', () => {
    it('handles music:request-push while scene is active (not cached → deferred push)', () => {
      const { fakeScene } = mountPlugin('PlatformTeamScene');
      const spy = vi.fn();
      eventBus.on('music:push', spy);

      eventBus.emit('music:request-push', 'music_quiz');

      expect(spy).not.toHaveBeenCalled();
      fakeScene.load.triggerComplete('music_quiz');
      expect(spy).toHaveBeenCalledWith('music_quiz');
    });

    it('emits music:push immediately for a cached key', () => {
      const { fakeScene } = mountPlugin('PlatformTeamScene', ['music_quiz']);
      const spy = vi.fn();
      eventBus.on('music:push', spy);

      eventBus.emit('music:request-push', 'music_quiz');

      expect(spy).toHaveBeenCalledWith('music_quiz');
      expect(fakeScene.load.start).not.toHaveBeenCalled();
    });

    it('unsubscribes from music:request-push on scene shutdown', () => {
      const { fakeScene } = mountPlugin('PlatformTeamScene');
      const spy = vi.fn();
      eventBus.on('music:push', spy);

      fakeScene.sys.events.emit('shutdown');

      eventBus.emit('music:request-push', 'music_quiz');
      expect(fakeScene.load.audio).not.toHaveBeenCalled();
    });
  });

  describe('scene create integration', () => {
    it('lazy-loads a non-eager track when scene has SCENE_MUSIC entry', () => {
      // ElevatorScene → 'music_elevator_jazz' (not eager)
      const { fakeScene } = mountPlugin('ElevatorScene');
      const spy = vi.fn();
      eventBus.on('music:play', spy);

      // Simulate Phaser firing the 'create' event
      fakeScene.sys.events.emit('create');

      // Should have queued the load but NOT yet emitted music:play
      expect(fakeScene.load.audio).toHaveBeenCalledWith(
        'music_elevator_jazz',
        expect.stringContaining('elevator_jazz.mp3'),
      );
      expect(spy).not.toHaveBeenCalled();

      // Once Phaser finishes loading → play
      fakeScene.load.triggerComplete('music_elevator_jazz');
      expect(spy).toHaveBeenCalledWith('music_elevator_jazz');
    });

    it('emits music:play immediately for an eager (cached) track', () => {
      // MenuScene → 'music_menu' (eager — will be pre-cached at boot)
      const { fakeScene } = mountPlugin('MenuScene', ['music_menu']);

      const spy = vi.fn();
      eventBus.on('music:play', spy);

      fakeScene.sys.events.emit('create');

      expect(spy).toHaveBeenCalledWith('music_menu');
      expect(fakeScene.load.start).not.toHaveBeenCalled();
    });
  });
});
