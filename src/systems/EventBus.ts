/**
 * Standalone event bus — zero framework dependencies.
 *
 * Provides pub/sub for loose coupling between game systems.
 * Imported as a singleton so any module can emit or listen
 * without needing a Phaser scene or game reference.
 */

type Callback = (...args: unknown[]) => void;

class EventBus {
  private listeners = new Map<string, Set<Callback>>();

  /** Subscribe to an event. */
  on(event: string, fn: Callback): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return this;
  }

  /** Unsubscribe from an event. */
  off(event: string, fn: Callback): this {
    this.listeners.get(event)?.delete(fn);
    return this;
  }

  /** Emit an event to all subscribers. */
  emit(event: string, ...args: unknown[]): this {
    this.listeners.get(event)?.forEach(fn => fn(...args));
    return this;
  }
}

/** Singleton game event bus — import anywhere, no framework dependency. */
export const eventBus = new EventBus();
