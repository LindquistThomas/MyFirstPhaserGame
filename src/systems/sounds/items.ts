import { SAMPLE_RATE, encodeWAV } from './wav';

export function generateCoffeeSipSound(): ArrayBuffer {
  const duration = 0.18;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  let noisePrev = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    const freq = 520 - 300 * progress;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const tone = Math.sin(phase) * 0.18;

    const noise = Math.random() * 2 - 1;
    noisePrev = noisePrev * 0.82 + noise * 0.18;

    const env = Math.sin(Math.PI * progress);
    samples[i] = (tone + noisePrev * 0.25) * env * 0.6;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/**
 * Fridge door opening: a short mechanical click followed by a brief cold
 * air whoosh — icy high-freq noise with a quick attack/decay envelope.
 */
export function generateFridgeOpenSound(): ArrayBuffer {
  const duration = 0.35;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  const clickEnd = Math.floor(SAMPLE_RATE * 0.04);
  const whooshStart = Math.floor(SAMPLE_RATE * 0.05);

  let noisePrev = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    let s = 0;

    // Mechanical click at the start
    if (i < clickEnd) {
      const clickEnv = 1 - i / clickEnd;
      s += (Math.random() * 2 - 1) * clickEnv * 0.7;
    }

    // Cold-air whoosh (filtered high-freq noise)
    if (i >= whooshStart) {
      const whooshProgress = (i - whooshStart) / (numSamples - whooshStart);
      const whooshEnv = Math.sin(Math.PI * whooshProgress) * 0.4;
      const noise = Math.random() * 2 - 1;
      noisePrev = noisePrev * 0.55 + noise * 0.45;
      s += noisePrev * whooshEnv;

      // Icy tonal shimmer
      const freq = 3200 + 800 * progress;
      s += Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * 0.06 * whooshEnv;
    }

    samples[i] = Math.max(-1, Math.min(1, s));
  }

  return encodeWAV(samples, SAMPLE_RATE);
}
