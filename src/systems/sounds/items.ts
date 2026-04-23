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
