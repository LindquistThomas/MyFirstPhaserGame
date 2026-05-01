/**
 * Quiz module barrel.
 *
 * The Tier A split moved the quiz pool out of a single 2,794-line god file
 * into one file per floor. Each floor owner edits a smaller file; merges
 * only collide when two contributors touch the same floor.
 *
 * Callers import from this barrel (`config/quiz`) and keep the same
 * symbols they had before: `QUIZ_DATA`, `QUIZ_REWARDS`, difficulty mix,
 * thresholds, and the `QuizQuestion` / `QuizDefinition` types.
 *
 * Quiz content is lazy-loaded per floor via dynamic imports so that large
 * quiz catalogues (architecture, platform) are excluded from the main bundle
 * and only fetched when the player enters that floor.  Call
 * `preloadQuizFor(floorId)` early in a floor scene's `init()` to warm the
 * cache before the player can interact with info icons.
 */

import { FloorId, FLOORS } from '../gameConfig';
import { QuizDefinition } from './types';

export type {
  QuizDifficulty,
  QuizQuestion,
  QuizDefinition,
} from './types';
export {
  QUIZ_REWARDS,
  QUIZ_COOLDOWN_MS,
  QUIZ_QUESTION_COUNT,
  QUIZ_DIFFICULTY_MIX,
  QUIZ_PASS_THRESHOLD,
} from './types';

/**
 * Runtime-populated quiz catalogue keyed by infoId.
 *
 * Starts empty and is filled incrementally as floors are preloaded via
 * `preloadQuizFor(floorId)`.  Use `QUIZ_DATA[infoId]` as before — the
 * data is guaranteed to be present once the relevant floor has been
 * preloaded (which happens in `LevelScene.init()` and `ElevatorScene.init()`).
 */
export const QUIZ_DATA: Record<string, QuizDefinition> = {};

/** Per-floor dynamic import factories — each is a separate Vite chunk. */
const QUIZ_LOADERS: Partial<Record<FloorId, () => Promise<Record<string, QuizDefinition>>>> = {
  [FLOORS.LOBBY]: () =>
    import('../../features/floors/lobby/quiz').then((m) => m.QUIZ_LOBBY),
  // Floor 1 hosts both the Platform and Architecture rooms.
  [FLOORS.PLATFORM_TEAM]: () =>
    Promise.all([
      import('../../features/floors/platform/quiz').then((m) => m.QUIZ_PLATFORM),
      import('../../features/floors/architecture/quiz').then((m) => m.QUIZ_ARCHITECTURE),
    ]).then(([a, b]) => ({ ...a, ...b })),
  // Floor 3 hosts Finance (left) and Product Leadership (right).
  [FLOORS.BUSINESS]: () =>
    Promise.all([
      import('../../features/floors/finance/quiz').then((m) => m.QUIZ_FINANCE),
      import('../../features/floors/product/quiz').then((m) => m.QUIZ_PRODUCT),
    ]).then(([a, b]) => ({ ...a, ...b })),
  [FLOORS.EXECUTIVE]: () =>
    import('../../features/floors/executive/quiz').then((m) => m.QUIZ_EXEC),
  [FLOORS.PRODUCTS]: () =>
    import('../../features/floors/product/quiz').then((m) => m.QUIZ_PRODUCT),
  [FLOORS.BOSS]: () => Promise.resolve({}),
};

/** Per-floor quiz cache (for `getQuizFor`). */
const _quizFloorCache = new Map<FloorId, Record<string, QuizDefinition>>();

/** Track in-flight and completed preloads so we never fetch the same floor twice. */
const _quizLoadedFloors = new Set<FloorId>();
const _quizPendingFloors = new Map<FloorId, Promise<void>>();

/**
 * Kick off (or await) the dynamic import for a floor's quiz content.
 *
 * Safe to call multiple times — subsequent calls for the same floor return
 * the already-resolved/in-flight promise.  The loaded data is merged into
 * the shared `QUIZ_DATA` object so all existing call sites keep working
 * without modification.
 */
export function preloadQuizFor(floorId: FloorId): Promise<void> {
  if (_quizLoadedFloors.has(floorId)) return Promise.resolve();

  const existing = _quizPendingFloors.get(floorId);
  if (existing) return existing;

  const loader = QUIZ_LOADERS[floorId];
  if (!loader) {
    _quizLoadedFloors.add(floorId);
    _quizFloorCache.set(floorId, {});
    return Promise.resolve();
  }

  const p = loader().then((data) => {
    Object.assign(QUIZ_DATA, data);
    _quizFloorCache.set(floorId, data);
    _quizLoadedFloors.add(floorId);
    _quizPendingFloors.delete(floorId);
  });

  _quizPendingFloors.set(floorId, p);
  return p;
}

/**
 * Return the cached quiz catalogue for a specific floor (keyed by infoId).
 *
 * Returns an empty object if the floor has not been preloaded yet.
 * Use `preloadQuizFor` to warm the cache before calling this.
 */
export function getQuizFor(floorId: FloorId): Record<string, QuizDefinition> {
  return _quizFloorCache.get(floorId) ?? {};
}
