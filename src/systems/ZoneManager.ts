import { eventBus } from './EventBus';

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
 *   // Register (e.g. in scene create):
 *   zoneManager.register('my-zone', () => someCondition);
 *
 *   // Subscribe (e.g. in scene create, unsubscribe on shutdown):
 *   eventBus.on('zone:enter', (id) => { if (id === 'my-zone') show(); });
 *   eventBus.on('zone:exit',  (id) => { if (id === 'my-zone') hide(); });
 *
 *   // Drive from update loop:
 *   zoneManager.update();
 *
 *   // Keyboard input — synchronous query, no event needed:
 *   const active = zoneManager.getActiveZone(); // string | null
 */
export class ZoneManager {
  private zones = new Map<string, { check: () => boolean; active: boolean }>();

  /** Register a zone. Starts inactive; update() drives transitions. */
  register(zoneId: string, check: () => boolean): void {
    this.zones.set(zoneId, { check, active: false });
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
   * Synchronous query: returns the ID of the first currently-active zone,
   * or null. Use this for keyboard/input handlers in the update loop where
   * you need the value immediately rather than reactively.
   */
  getActiveZone(): string | null {
    for (const [zoneId, zone] of this.zones) {
      if (zone.active) return zoneId;
    }
    return null;
  }

  /**
   * Reset all zones to inactive without emitting events.
   * Call in scene init() before create() re-registers zones.
   */
  clear(): void {
    this.zones.clear();
  }
}
