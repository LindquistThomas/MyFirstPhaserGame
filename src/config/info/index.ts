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
 */

import { FloorId } from '../gameConfig';
import { InfoPointDef } from './types';
import { INFO_LOBBY } from '../../features/floors/lobby/info';
import { INFO_PLATFORM } from '../../features/floors/platform/info';
import { INFO_ARCHITECTURE } from '../../features/floors/architecture/info';
import { INFO_EXEC } from '../../features/floors/executive/info';
import { INFO_FINANCE } from '../../features/floors/finance/info';
import { INFO_PRODUCT } from '../../features/floors/product/info';
import { INFO_CUSTOMER } from '../../features/floors/customer/info';

export type { InfoPointDef } from './types';

/** Merged info-point catalogue keyed by info-point id. */
export const INFO_POINTS: Record<string, InfoPointDef> = {
  ...INFO_LOBBY,
  ...INFO_PLATFORM,
  ...INFO_ARCHITECTURE,
  ...INFO_EXEC,
  ...INFO_FINANCE,
  ...INFO_PRODUCT,
  ...INFO_CUSTOMER,
};

/** Return the info points that belong to a given floor. */
export function getInfoPointsFor(floorId: FloorId): Record<string, InfoPointDef> {
  const out: Record<string, InfoPointDef> = {};
  for (const [key, def] of Object.entries(INFO_POINTS)) {
    if (def.floorId === floorId) out[key] = def;
  }
  return out;
}
