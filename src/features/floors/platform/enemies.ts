import type { LevelConfig } from '../_shared/LevelScene';
import { TIER_Y_T2, TIER_Y_T3 } from '../../../config/levelGeometry';

type EnemyList = NonNullable<LevelConfig['enemies']>;

/**
 * Platform floor enemies. `G` is the ground walking-surface y. The
 * mezzanines sit on thin catwalks at y=692 / 552 / 412 / 272 (T1..T4) —
 * see `PlatformTeamScene.getLevelConfig` for the full geometry.
 *
 * Patrol ranges avoid the three lift shafts (A ≈ x=120..200,
 * B ≈ x=600..680, C ≈ x=1060..1140) so enemies never block boarding.
 *
 *   - Ground slime patrols the workstation lane between lift A and lift B.
 *   - A rogue deploy bot patrols the T3 Observability catwalk (y=480).
 *   - A security bot patrols the T2 right ledge (y=600) — thematically
 *     "traffic arriving from the internet" just below Edge Security.
 */
export function enemiesForGroundY(G: number): EnemyList {
  const T3 = TIER_Y_T3;
  const T2 = TIER_Y_T2;
  return [
    // Ground workstations lane slime — between lift A (x≈160) and lift B
    // (x≈640), clear of the signpost (x≈260).
    { type: 'slime', x: 480, y: G - 20, minX: 340, maxX: 580, speed: 55 },
    // Rogue deploy bot on T3 Observability (x=760..1120).
    { type: 'bot', x: 940, y: T3 - 30, minX: 790, maxX: 1090, speed: 75 },
    // Security bot on T2 right ledge (x=880..1060) — below the WAF panel.
    { type: 'bot', x: 970, y: T2 - 30, minX: 900, maxX: 1040, speed: 70 },
  ];
}
