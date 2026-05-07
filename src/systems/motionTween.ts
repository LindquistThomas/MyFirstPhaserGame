import { isReducedMotion } from './MotionPreference';

export function reducedDuration(durationMs: number, reducedMaxMs = 80): number {
  return isReducedMotion() ? Math.min(durationMs, reducedMaxMs) : durationMs;
}

export function shouldSkipTween(): boolean {
  return isReducedMotion();
}
