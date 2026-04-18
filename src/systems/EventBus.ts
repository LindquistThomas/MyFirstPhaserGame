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
}

export type GameEventName = keyof GameEvents;
export type GameEventHandler<K extends GameEventName> = (...args: GameEvents[K]) => void;

class EventBus {
  private listeners = new Map<GameEventName, Set<GameEventHandler<GameEventName>>>();

  /** Subscribe to an event. */
  on<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as GameEventHandler<GameEventName>);
    return this;
  }

  /** Unsubscribe from an event. */
  off<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    this.listeners.get(event)?.delete(fn as GameEventHandler<GameEventName>);
    return this;
  }

  /** Emit an event to all subscribers. */
  emit<K extends GameEventName>(event: K, ...args: GameEvents[K]): this {
    this.listeners.get(event)?.forEach(fn => (fn as GameEventHandler<K>)(...args));
    return this;
  }
}

/** Singleton game event bus — import anywhere, no framework dependency. */
export const eventBus = new EventBus();
