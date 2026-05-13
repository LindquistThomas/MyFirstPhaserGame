import { isReducedMotion } from './MotionPreference';

/**
 * Returns the original duration by default, and caps to `reducedMaxMs`
 * when reduced motion is enabled.
 */
export function reducedDuration(durationMs: number, reducedMaxMs = 80): number {
  return isReducedMotion() ? Math.min(durationMs, reducedMaxMs) : durationMs;
}

/** Semantic wrapper for readability at call sites. */
export function shouldSkipTween(): boolean {
  return isReducedMotion();
}
