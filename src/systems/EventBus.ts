/**
 * Standalone event bus — zero framework dependencies.
 *
 * Provides typed pub/sub for loose coupling between game systems.
 * The `GameEvents` map below is the single source of truth for every
 * event name and its payload tuple — add new events here and call sites
 * are type-checked automatically.
 */

/** Event name → payload tuple. Each event's handler arguments are derived from this map. */
export interface GameEvents {
  'music:play': [key: string];
  'music:stop': [];
  /** Temporarily replace the current music with a new track; pair with `music:pop`. */
  'music:push': [key: string];
  /** Restore the music that was playing before the most recent `music:push`. */
  'music:pop': [];
  /** Toggle global audio mute (affects both music and SFX). */
  'audio:toggle-mute': [];
  /** Emitted by AudioManager when the mute state changes. */
  'audio:mute-changed': [muted: boolean];
  /**
   * Emitted by SettingsStore whenever any volume-related setting changes
   * (masterVolume, musicVolume, sfxVolume, muteAll). AudioManager listens
   * and re-applies the new levels to all active channels.
   */
  'audio:volume-changed': [];

  /** Start looping an ambience bed on the dedicated ambience channel. */
  'ambience:play': [key: string];
  /** Stop the current ambience bed. */
  'ambience:stop': [];

  'zone:enter': [zoneId: string];
  'zone:exit': [zoneId: string];

  'sfx:info_open': [];
  'sfx:link_click': [];
  'sfx:jump': [];
  'sfx:footstep_a': [];
  'sfx:footstep_b': [];
  'sfx:quiz_correct': [];
  'sfx:quiz_wrong': [];
  'sfx:quiz_success': [];
  'sfx:quiz_fail': [];

  /** Player took damage from an enemy. */
  'sfx:hit': [];
  /** Enemy defeated via stomp. */
  'sfx:stomp': [];
  /** AU dropped by the player on hit. */
  'sfx:drop_au': [];
  /** Dropped AU recovered. */
  'sfx:recover_au': [];
  /** Coffee pickup — a short slurp. */
  'sfx:coffee_sip': [];
  /** Energy drink fridge opened — mechanical click + cold air whoosh. */
  'sfx:fridge_open': [];

  /** Caffeine buff activated; payload is the total duration in ms. */
  'buff:caffeine_start': [durationMs: number];
  /** Caffeine buff expired. */
  'buff:caffeine_end': [];

  /**
   * A persisted-store write failed (quota exceeded, storage unavailable,
   * or serialisation error). HUD can surface a toast to the player.
   * Payload: storage key that failed, and the human-readable error message.
   */
  'persistence:error': [storageKey: string, message: string];
}

export type GameEventName = keyof GameEvents;
export type GameEventHandler<K extends GameEventName> = (...args: GameEvents[K]) => void;

class EventBus {
  private listeners = new Map<GameEventName, Set<GameEventHandler<GameEventName>>>();
  /** Maps original handler → once-wrapper handler so off(event, fn) can cancel a once() subscription. */
  private onceWrappers = new Map<GameEventHandler<GameEventName>, GameEventHandler<GameEventName>>();

  /** Subscribe to an event. */
  on<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as GameEventHandler<GameEventName>);
    return this;
  }

  /**
   * Subscribe to an event for exactly one invocation, then auto-unsubscribe.
   * Calling `off(event, fn)` with the original function cancels the subscription
   * before it fires.
   */
  once<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    const typed = fn as GameEventHandler<GameEventName>;
    const wrapper = (...args: GameEvents[K]): void => {
      this.off(event, fn);
      fn(...args);
    };
    this.onceWrappers.set(typed, wrapper as GameEventHandler<GameEventName>);
    return this.on(event, wrapper as GameEventHandler<K>);
  }

  /** Unsubscribe from an event. Also cancels a pending `once()` subscription. */
  off<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    const typed = fn as GameEventHandler<GameEventName>;
    const wrapper = this.onceWrappers.get(typed);
    if (wrapper) {
      this.onceWrappers.delete(typed);
      this.listeners.get(event)?.delete(wrapper);
    } else {
      this.listeners.get(event)?.delete(typed);
    }
    return this;
  }

  /** Emit an event to all subscribers. */
  emit<K extends GameEventName>(event: K, ...args: GameEvents[K]): this {
    this.listeners.get(event)?.forEach(fn => (fn as GameEventHandler<K>)(...args));
    return this;
  }

  /**
   * Remove every listener — primarily a test seam so suites can isolate
   * each case without reaching into private state. Safe at runtime too
   * (e.g. on a hard scene-graph reset), but production code should prefer
   * paired `on`/`off` with scene shutdown for narrower cleanup.
   */
  removeAllListeners(): this {
    this.listeners.clear();
    this.onceWrappers.clear();
    return this;
  }
}

/** Singleton game event bus — import anywhere, no framework dependency. */
export const eventBus = new EventBus();
