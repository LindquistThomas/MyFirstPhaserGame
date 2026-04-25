import * as Phaser from 'phaser';
import { eventBus, type GameEventHandler, type GameEventName, type GameEvents } from '../systems/EventBus';

/**
 * Phaser ScenePlugin providing a scene-scoped view of the global {@link eventBus}.
 *
 * Every `on()` / `once()` subscription is automatically removed when the scene
 * shuts down, preventing listener accumulation across scene restarts.
 *
 * Usage inside any scene:
 *   this.scopedEvents.on('zone:enter', this.onEnter, this);
 *   // No manual cleanup needed — auto-unsubscribed on shutdown.
 *
 * `off()` is available for early unsubscription within a scene's lifetime.
 *
 * Auto-registered on every scene via the game config; access via `scene.scopedEvents`.
 */
export class ScopedEventBus extends Phaser.Plugins.ScenePlugin {
  /** All active registrations tracked for shutdown cleanup (stores the registered handler; for once() calls, this is the wrapper). */
  private _subs: Array<[GameEventName, GameEventHandler<GameEventName>]> = [];
  /** Maps original handler → once-wrapper so off(event, fn) can cancel a once() registration. */
  private _onceMap = new Map<GameEventHandler<GameEventName>, GameEventHandler<GameEventName>>();

  override boot(): void {
    const events = this.systems!.events;
    events.on('start', this._onStart, this);
    events.once('destroy', this._onDestroy, this);
  }

  private _onStart = (): void => {
    this.systems!.events.once('shutdown', this._cleanup);
  };

  private _cleanup = (): void => {
    for (const [event, fn] of this._subs) {
      eventBus.off(event, fn);
    }
    this._subs = [];
    this._onceMap.clear();
  };

  private _onDestroy = (): void => {
    this._cleanup();
    this.systems?.events.off('start', this._onStart, this);
  };

  /** Subscribe to a global eventBus event. Auto-unsubscribed on scene shutdown. */
  on<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    eventBus.on(event, fn);
    this._subs.push([event, fn as GameEventHandler<GameEventName>]);
    return this;
  }

  /**
   * Subscribe for exactly one invocation, then auto-unsubscribe.
   * Cleaned up on scene shutdown if the event never fires.
   */
  once<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    const typed = fn as GameEventHandler<GameEventName>;
    const wrapper = (...args: GameEvents[K]): void => {
      this._removeSub(event, wrapper as GameEventHandler<GameEventName>);
      this._onceMap.delete(typed);
      eventBus.off(event, wrapper as GameEventHandler<K>);
      fn(...args);
    };
    this._onceMap.set(typed, wrapper as GameEventHandler<GameEventName>);
    eventBus.on(event, wrapper as GameEventHandler<K>);
    this._subs.push([event, wrapper as GameEventHandler<GameEventName>]);
    return this;
  }

  /** Early unsubscription within a scene's lifetime. Also cancels a pending `once()`. */
  off<K extends GameEventName>(event: K, fn: GameEventHandler<K>): this {
    const typed = fn as GameEventHandler<GameEventName>;
    const wrapper = this._onceMap.get(typed);
    if (wrapper) {
      this._onceMap.delete(typed);
      this._removeSub(event, wrapper);
      eventBus.off(event, wrapper as GameEventHandler<K>);
    } else {
      this._removeSub(event, typed);
      eventBus.off(event, fn);
    }
    return this;
  }

  private _removeSub(event: GameEventName, fn: GameEventHandler<GameEventName>): void {
    const idx = this._subs.findIndex(([e, h]) => e === event && h === fn);
    if (idx !== -1) this._subs.splice(idx, 1);
  }
}
