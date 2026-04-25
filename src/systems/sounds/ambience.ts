import { SAMPLE_RATE, encodeWAV } from './wav';

/**
 * Procedural datacenter ambience — an 8-second loopable bed of machine-room
 * noise designed to sit *under* the floor's music track.
 *
 * Composition:
 *   - 60 Hz sine (mains hum / transformer note).
 *   - 120 Hz partial (rack PSU buzz) with slow amplitude drift.
 *   - Filtered brown noise (server fan whoosh, continuous).
 *   - Sparse transient clicks (disk seeks) on irregular intervals.
 *
 * The buffer is crossfaded across its seam (linear ramp over the last
 * 0.25 s onto the first 0.25 s of samples) so Phaser's looping playback
 * stays seamless without a click at the loop point.
 *
 * Volume is intentionally low (peak ~0.25) — the AudioManager ambience
 * channel plays it at ~0.12 gain so it reads as atmosphere rather than
 * a foreground sound.
 */
export function generateDatacenterAmbience(): ArrayBuffer {
  const duration = 8.0;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // --- Brown noise (fan whoosh). Integrated white noise, tamed with a
  //     leaky integrator so it stays bounded.
  let brown = 0;
  let prevBrown = 0;
  const brownLeak = 0.995;

  // --- Mains hum phases.
  const hum60 = 2 * Math.PI * 60 / SAMPLE_RATE;
  const hum120 = 2 * Math.PI * 120 / SAMPLE_RATE;
  // Slow amplitude LFO for the 120 Hz partial (simulates PSU load swing).
  const lfoHz = 0.17;
  const lfo = 2 * Math.PI * lfoHz / SAMPLE_RATE;

  // --- Disk seek schedule. Irregular Poisson-ish intervals: 1.2–3.5 s.
  const seeks: number[] = []; // sample indices where a click should fire
  {
    let t = 0.9;
    while (t < duration - 0.2) {
      seeks.push(Math.floor(t * SAMPLE_RATE));
      t += 1.2 + Math.random() * 2.3;
    }
  }

  for (let i = 0; i < numSamples; i++) {
    // Brown noise accumulator.
    const white = Math.random() * 2 - 1;
    brown = brown * brownLeak + white * 0.05;
    // Gentle low-pass via 2-sample moving average (cheap & good enough).
    const fan = (brown + prevBrown) * 0.5;
    prevBrown = brown;

    // Mains hum + PSU buzz with slow amplitude drift.
    const humA = Math.sin(hum60 * i) * 0.07;
    const lfoVal = 0.5 + 0.5 * Math.sin(lfo * i);
    const humB = Math.sin(hum120 * i) * 0.04 * lfoVal;

    // Mix.
    samples[i] = fan * 0.85 + humA + humB;
  }

  // --- Disk seek clicks. A short rising-falling noise burst with a click
  //     head. Additive onto the bed.
  for (const seek of seeks) {
    const clickLen = Math.floor(SAMPLE_RATE * 0.08); // 80 ms
    for (let j = 0; j < clickLen; j++) {
      const idx = seek + j;
      if (idx >= numSamples) break;
      const progress = j / clickLen;
      // Attack 0..0.1, decay 0.1..1.
      const env = progress < 0.1
        ? progress / 0.1
        : Math.exp(-(progress - 0.1) * 6);
      // Tonal "tick" ~2.5 kHz mixed with narrow-band noise.
      const tick = Math.sin(2 * Math.PI * 2500 * (j / SAMPLE_RATE)) * 0.6;
      const noise = (Math.random() * 2 - 1) * 0.4;
      samples[idx] = samples[idx]! + (tick + noise) * env * 0.08;
    }
  }

  // --- Seamless loop crossfade. Blend the last `fadeLen` samples onto
  //     the corresponding head samples so the boundary is continuous.
  const fadeLen = Math.floor(SAMPLE_RATE * 0.25);
  for (let j = 0; j < fadeLen; j++) {
    const t = fadeLen > 1 ? j / (fadeLen - 1) : 1; // 0 at tail start, 1 at buffer end
    const tail = samples[numSamples - fadeLen + j]!;
    const head = samples[j]!;
    // Linear crossfade: tail ramps out (1→0), head ramps in (0→1) at the seam.
    samples[numSamples - fadeLen + j] = tail * (1 - t) + head * t;
  }

  // --- Normalise with a soft ceiling so the bed never exceeds ~0.25 peak.
  let peak = 0;
  for (let i = 0; i < numSamples; i++) {
    const a = Math.abs(samples[i]!);
    if (a > peak) peak = a;
  }
  if (peak > 0) {
    const gain = 0.25 / peak;
    for (let i = 0; i < numSamples; i++) samples[i] = samples[i]! * gain;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}
