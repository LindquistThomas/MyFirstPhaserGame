import type * as Phaser from 'phaser';
import { eventBus } from './EventBus';

type ZoneEntry = { check: () => boolean; active: boolean; priority: number };

/** Options for {@link ZoneManager.register}. */
export interface ZoneOptions {
  /**
   * Higher values win when multiple zones are simultaneously active and
   * {@link ZoneManager.getActiveZone} is called. Defaults to `0`.
   */
  priority?: number;
}

/**
 * Tracks named content zones and broadcasts transitions via the EventBus.
 *
 * Each zone has an ID and a check function. ZoneManager knows nothing about
 * what responds to zone changes — UI components and scene code subscribe to
 * the events independently, keeping coupling in one direction.
 *
 * Events emitted:
 *   zone:enter  (zoneId: string) — player just entered this zone
 *   zone:exit   (zoneId: string) — player just left this zone
 *
 * The check() is called every frame but events are only emitted on transitions,
 * so subscribers are not hammered with per-frame calls.
 *
 * Usage:
 *   // Bind to scene lifecycle (auto-clears on shutdown):
 *   zoneManager.bindScene(scene); // call once, e.g. in create()
 *
 *   // Register (e.g. in scene create):
 *   zoneManager.register('my-zone', () => someCondition);
 *   zoneManager.register('overlay', () => otherCondition, { priority: 1 });
 *
 *   // Subscribe (e.g. in scene create, unsubscribe on shutdown):
 *   eventBus.on('zone:enter', (id) => { if (id === 'my-zone') show(); });
 *   eventBus.on('zone:exit',  (id) => { if (id === 'my-zone') hide(); });
 *
 *   // Drive from update loop:
 *   zoneManager.update();
 *
 *   // Keyboard input — synchronous query, no event needed:
 *   const active = zoneManager.getActiveZone(); // string | null (highest priority)
 */
export class ZoneManager {
  private zones = new Map<string, ZoneEntry>();

  /**
   * Stable bound handler reference so `bindScene` can remove it before
   * re-adding when called multiple times.
   */
  private readonly handleShutdown = (): void => { this.clear(); };

  /**
   * Register a zone. Starts inactive; update() drives transitions.
   *
   * @param zoneId  Unique zone identifier.
   * @param check   Predicate evaluated every frame.
   * @param opts    Optional configuration (e.g. `priority`).
   */
  register(zoneId: string, check: () => boolean, opts?: ZoneOptions): void {
    this.zones.set(zoneId, { check, active: false, priority: opts?.priority ?? 0 });
  }

  /**
   * Check every zone and emit zone:enter / zone:exit on the eventBus
   * whenever a zone's state changes. Call once per frame from update().
   */
  update(): void {
    for (const [zoneId, zone] of this.zones) {
      const inZone = zone.check();
      if (inZone !== zone.active) {
        zone.active = inZone;
        eventBus.emit(inZone ? 'zone:enter' : 'zone:exit', zoneId);
      }
    }
  }

  /**
   * Synchronous query: returns the ID of the highest-priority currently-active
   * zone, or null. When multiple zones are active simultaneously the one with
   * the largest `priority` value wins. Use this for keyboard/input handlers in
   * the update loop where you need the value immediately rather than reactively.
   */
  getActiveZone(): string | null {
    let bestId: string | null = null;
    let bestPriority = -Infinity;
    for (const [zoneId, zone] of this.zones) {
      if (zone.active && zone.priority > bestPriority) {
        bestId = zoneId;
        bestPriority = zone.priority;
      }
    }
    return bestId;
  }

  /**
   * Bind this ZoneManager to a Phaser scene so that zones are automatically
   * cleared whenever the scene shuts down. Call once — typically in `create()`.
   *
   * Safe to call multiple times on the same scene (duplicate listeners are
   * removed before a new one is added, so exactly one handler is active).
   */
  bindScene(scene: Phaser.Scene): void {
    scene.events.off('shutdown', this.handleShutdown);
    scene.events.on('shutdown', this.handleShutdown);
  }

  /**
   * Reset all zones without emitting events.
   * Called automatically on scene shutdown when {@link bindScene} has been used.
   */
  clear(): void {
    this.zones.clear();
  }
}
