import { SAMPLE_RATE, encodeWAV } from './wav';

/** Short ascending UI blip — triangle wave for opening an info card. */
export function generateInfoOpenSound(): ArrayBuffer {
  const duration = 0.1;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    const freq = 500 + 300 * progress;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const envelope = 1 - progress;
    samples[i] = wave * envelope * 0.2;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Short damped click — square wave for link activation. */
export function generateLinkClickSound(): ArrayBuffer {
  const duration = 0.05;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    phase += (2 * Math.PI * 1000) / SAMPLE_RATE;
    const wave = Math.sign(Math.sin(phase));
    const envelope = Math.exp(-progress * 12);
    samples[i] = wave * envelope * 0.15;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Friendly two-note bleep for NPC interaction. */
export function generateNpcGreetSound(): ArrayBuffer {
  const duration = 0.16;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    const freq = progress < 0.5 ? 440 : 660;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const envelope = Math.sin(Math.PI * progress);
    samples[i] = Math.sin(phase) * envelope * 0.16;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}
