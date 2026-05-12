/**
 * Lightweight JSON cache for info/quiz content loaded from dynamic imports.
 *
 * On first load all floors are imported normally (triggered by BootScene's
 * eager preload) and their parsed data is serialized to localStorage under
 * `architect_content_cache_v1`.  On subsequent page loads the data is
 * restored directly from localStorage, bypassing the dynamic import and
 * JS parse+init cost entirely.
 *
 * Cache invalidation: the stored `version` field is compared against the
 * module-level `CONTENT_CACHE_VERSION` constant.  A mismatch silently
 * discards the stale entry and lets the normal dynamic-import path
 * repopulate the cache.
 *
 * Content schema changes (new fields on InfoPointDef / QuizDefinition) must
 * be paired with a `CONTENT_CACHE_VERSION` bump to prevent stale reads.
 */

import { createPersistedStore } from './PersistedStore';
import type { KVStorage } from './SaveManager';
import type { InfoPointDef } from '../config/info/types';
import type { QuizDefinition } from '../config/quiz/types';
import type { FloorId } from '../config/gameConfig';

/**
 * Increment this string whenever the shape of `InfoPointDef` or
 * `QuizDefinition` changes in a backwards-incompatible way.
 */
export const CONTENT_CACHE_VERSION = '1';

/** localStorage key used by this module. */
export const CONTENT_CACHE_KEY = 'architect_content_cache_v1';

/** Shape stored in localStorage under CONTENT_CACHE_KEY. */
export interface CachedPayload {
  version: string;
  /**
   * Per-floor info data (stringified FloorId as key).
   * Matches the data object returned by each INFO_LOADERS entry.
   */
  infoByFloor: Record<string, Record<string, InfoPointDef>>;
  /**
   * Per-floor quiz data (stringified FloorId as key).
   * Matches the data object returned by each QUIZ_LOADERS entry and stored
   * in `_quizFloorCache`.
   */
  quizByFloor: Record<string, Record<string, QuizDefinition>>;
}

const _store = createPersistedStore<CachedPayload | null>({
  key: CONTENT_CACHE_KEY,
  defaultValue: () => null,
  parse(raw: unknown): CachedPayload | null {
    if (
      raw == null ||
      typeof raw !== 'object' ||
      (raw as Record<string, unknown>).version !== CONTENT_CACHE_VERSION
    ) {
      return null;
    }
    const p = raw as Record<string, unknown>;
    if (
      typeof p['infoByFloor'] !== 'object' || p['infoByFloor'] == null ||
      typeof p['quizByFloor'] !== 'object' || p['quizByFloor'] == null
    ) {
      return null;
    }
    return raw as CachedPayload;
  },
});

/** Test seam — replace the underlying KVStorage and invalidate the cache. */
export function setContentCacheStorage(s: KVStorage): void {
  _store.setStorage(s);
}

/**
 * Read the content cache from localStorage.
 *
 * Returns the stored payload when the cache is present and the version
 * matches `CONTENT_CACHE_VERSION`; `null` otherwise.
 */
export function readContentCache(): CachedPayload | null {
  return _store.read();
}

/** Remove the persisted cache entry and reset the in-memory view. */
export function clearContentCache(): void {
  _store.clear();
}

/**
 * Persist a floor's info content to the cache.
 *
 * Merges `data` into any existing cached entry so that partial loads (e.g.
 * when the player only visits one floor in a session) are still preserved.
 * Writes are fire-and-forget; quota errors are surfaced via the
 * `persistence:error` EventBus event.
 */
export function writeInfoFloorToContentCache(
  floorId: FloorId,
  data: Record<string, InfoPointDef>,
): void {
  const prev = _store.read() ?? {
    version: CONTENT_CACHE_VERSION,
    infoByFloor: {},
    quizByFloor: {},
  };
  _store.write({
    version: CONTENT_CACHE_VERSION,
    infoByFloor: { ...prev.infoByFloor, [String(floorId)]: data },
    quizByFloor: prev.quizByFloor,
  });
}

/**
 * Persist a floor's quiz content to the cache.
 *
 * Merges `data` into any existing cached entry so that partial loads are
 * still preserved.
 */
export function writeQuizFloorToContentCache(
  floorId: FloorId,
  data: Record<string, QuizDefinition>,
): void {
  const prev = _store.read() ?? {
    version: CONTENT_CACHE_VERSION,
    infoByFloor: {},
    quizByFloor: {},
  };
  _store.write({
    version: CONTENT_CACHE_VERSION,
    infoByFloor: prev.infoByFloor,
    quizByFloor: { ...prev.quizByFloor, [String(floorId)]: data },
  });
}
