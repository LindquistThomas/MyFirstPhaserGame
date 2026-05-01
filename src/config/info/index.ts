/**
 * Info content module barrel.
 *
 * The Tier A split moved all educational copy out of a single 576-line
 * file into one file per floor/room. Each floor owner edits a small,
 * well-scoped file; merges only collide when two contributors touch the
 * same floor's info content.
 *
 * Callers import from this barrel (`config/info`) and keep the existing
 * `INFO_POINTS` record shape.
 *
 * Info content is lazy-loaded per floor via dynamic imports so that large
 * info catalogues are excluded from the main bundle and only fetched when
 * the player enters that floor.  Call `preloadInfoFor(floorId)` early in a
 * floor scene's `init()` to warm the cache before the player can interact
 * with info icons.
 */

import { FloorId, FLOORS } from '../gameConfig';
import { InfoPointDef } from './types';

export type { InfoPointDef } from './types';

/**
 * Runtime-populated info-point catalogue keyed by info-point id.
 *
 * Starts empty and is filled incrementally as floors are preloaded via
 * `preloadInfoFor(floorId)`.  Use `INFO_POINTS[contentId]` as before — the
 * data is guaranteed to be present once the relevant floor has been
 * preloaded (which happens in `LevelScene.init()` and `ElevatorScene.init()`).
 */
export const INFO_POINTS: Record<string, InfoPointDef> = {};

/** Per-floor dynamic import factories — each is a separate Vite chunk. */
const INFO_LOADERS: Partial<Record<FloorId, () => Promise<Record<string, InfoPointDef>>>> = {
  [FLOORS.LOBBY]: () =>
    import('../../features/floors/lobby/info').then((m) => m.INFO_LOBBY),
  // Floor 1 hosts both the Platform and Architecture rooms.
  [FLOORS.PLATFORM_TEAM]: () =>
    Promise.all([
      import('../../features/floors/platform/info').then((m) => m.INFO_PLATFORM),
      import('../../features/floors/architecture/info').then((m) => m.INFO_ARCHITECTURE),
    ]).then(([a, b]) => ({ ...a, ...b })),
  // Floor 3 hosts Finance (left), Product Leadership (right), and a mix of
  // Customer Success entries.  INFO_PRODUCT also has a BUSINESS-tagged entry
  // ("product-leadership"), so it must be loaded here too.
  [FLOORS.BUSINESS]: () =>
    Promise.all([
      import('../../features/floors/finance/info').then((m) => m.INFO_FINANCE),
      import('../../features/floors/product/info').then((m) => m.INFO_PRODUCT),
      import('../../features/floors/customer/info').then((m) => m.INFO_CUSTOMER),
    ]).then(([a, b, c]) => ({ ...a, ...b, ...c })),
  [FLOORS.EXECUTIVE]: () =>
    import('../../features/floors/executive/info').then((m) => m.INFO_EXEC),
  // Floor 5 (Products hall) shares product + customer content.
  [FLOORS.PRODUCTS]: () =>
    Promise.all([
      import('../../features/floors/product/info').then((m) => m.INFO_PRODUCT),
      import('../../features/floors/customer/info').then((m) => m.INFO_CUSTOMER),
    ]).then(([a, b]) => ({ ...a, ...b })),
  [FLOORS.BOSS]: () => Promise.resolve({}),
};

/** Track in-flight and completed preloads so we never fetch the same floor twice. */
const _infoLoadedFloors = new Set<FloorId>();
const _infoPendingFloors = new Map<FloorId, Promise<void>>();

/**
 * Kick off (or await) the dynamic import for a floor's info content.
 *
 * Safe to call multiple times — subsequent calls for the same floor return
 * the already-resolved/in-flight promise.  The loaded data is merged into
 * the shared `INFO_POINTS` object so all existing call sites keep working
 * without modification.  If the import fails the floor is removed from the
 * pending map so the next call can retry.
 */
export function preloadInfoFor(floorId: FloorId): Promise<void> {
  if (_infoLoadedFloors.has(floorId)) return Promise.resolve();

  const existing = _infoPendingFloors.get(floorId);
  if (existing) return existing;

  const loader = INFO_LOADERS[floorId];
  if (!loader) {
    _infoLoadedFloors.add(floorId);
    return Promise.resolve();
  }

  const p = loader().then((data) => {
    Object.assign(INFO_POINTS, data);
    _infoLoadedFloors.add(floorId);
    _infoPendingFloors.delete(floorId);
  }).catch(() => {
    // Remove from pending so callers can retry on the next interaction.
    _infoPendingFloors.delete(floorId);
  });

  _infoPendingFloors.set(floorId, p);
  return p;
}

/** Return the info points that belong to a given floor (from the cache). */
export function getInfoPointsFor(floorId: FloorId): Record<string, InfoPointDef> {
  const out: Record<string, InfoPointDef> = {};
  for (const [key, def] of Object.entries(INFO_POINTS)) {
    if (def.floorId === floorId) out[key] = def;
  }
  return out;
}
