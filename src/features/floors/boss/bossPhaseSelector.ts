export type BossPhase = 1 | 2 | 3;

function clampHealth(health: number): number {
  if (health === Number.POSITIVE_INFINITY) return Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(health)) return 0;
  return Math.max(0, health);
}

/**
 * Keep legacy boss phase thresholds centralized in a pure helper.
 * `hostagesAlive` is intentionally part of the API surface for future tuning.
 */
export function selectPhase(health: number, hostagesAlive: number): BossPhase {
  void hostagesAlive;
  const hp = clampHealth(health);
  if (hp <= 3) return 3;
  if (hp <= 7) return 2;
  return 1;
}
