import { SAMPLE_RATE, encodeWAV } from './wav';

/** Short percussive thud — boss hit. */
export function generateBossHitSound(): ArrayBuffer {
  const duration = 0.18;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const freq = 180 - 100 * t;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const tone = Math.sign(Math.sin(phase)) * 0.4;
    const noise = (Math.random() * 2 - 1) * 0.3;
    samples[i] = (tone + noise) * Math.exp(-t * 8) * 0.3;
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Descending multi-note fanfare — boss defeated. */
export function generateBossDefeatedSound(): ArrayBuffer {
  const duration = 0.8;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  const notes = [523, 659, 784, 659, 523]; // C5-E5-G5-E5-C5
  const noteLen = Math.floor(n / notes.length);
  for (let ni = 0; ni < notes.length; ni++) {
    const freq = notes[ni]!;
    const start = ni * noteLen;
    const end = Math.min(start + noteLen, n);
    let phase = 0;
    for (let i = start; i < end; i++) {
      const t = (i - start) / (end - start);
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const env = Math.sin(Math.PI * t);
      samples[i] = Math.sin(phase) * env * 0.28;
    }
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Ceramic whoosh — mug throw. */
export function generateMugThrowSound(): ArrayBuffer {
  const duration = 0.22;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const freq = 900 + 400 * (1 - t);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const tone = Math.sin(phase) * 0.15;
    const noise = (Math.random() * 2 - 1) * 0.1;
    const env = Math.exp(-t * 4);
    samples[i] = (tone + noise) * env * 0.4;
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Tense low sting — boss phase transition. */
export function generateBossPhaseSound(): ArrayBuffer {
  const duration = 0.4;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const freq = 80 + 60 * t;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const env = t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) * 3);
    samples[i] = wave * env * 0.25;
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Paper-shuffle impact — briefcase throw. */
export function generateBriefcaseThrowSound(): ArrayBuffer {
  const duration = 0.14;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * 12);
    samples[i] = noise * env * 0.3;
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Bright chime — mission item pickup. */
export function generateItemPickupSound(): ArrayBuffer {
  const duration = 0.25;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  const freqs = [880, 1320];
  let phase0 = 0; let phase1 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    phase0 += (2 * Math.PI * freqs[0]!) / SAMPLE_RATE;
    phase1 += (2 * Math.PI * freqs[1]!) / SAMPLE_RATE;
    const env = Math.exp(-t * 5);
    samples[i] = (Math.sin(phase0) * 0.3 + Math.sin(phase1) * 0.2) * env;
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Descending beep sequence — bomb disarmed. */
export function generateBombDisarmSound(): ArrayBuffer {
  const duration = 0.5;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  const beeps = [800, 600, 400];
  const beepLen = Math.floor(n / beeps.length);
  for (let bi = 0; bi < beeps.length; bi++) {
    const freq = beeps[bi]!;
    const start = bi * beepLen;
    const end = Math.min(start + beepLen - Math.floor(SAMPLE_RATE * 0.02), n);
    let phase = 0;
    for (let i = start; i < end; i++) {
      const t = (i - start) / (end - start);
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const env = t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) * 6);
      samples[i] = Math.sin(phase) * env * 0.3;
    }
  }
  return encodeWAV(samples, SAMPLE_RATE);
}

/** Triumphant brass hit — hostage freed. */
export function generateHostageFreedSound(): ArrayBuffer {
  const duration = 0.7;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  const chord = [261, 329, 392, 523]; // C major chord
  const phases = chord.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 2.5);
    let s = 0;
    for (let ci = 0; ci < chord.length; ci++) {
      phases[ci] = (phases[ci] ?? 0) + (2 * Math.PI * chord[ci]!) / SAMPLE_RATE;
      const wave = (2 / Math.PI) * Math.asin(Math.sin(phases[ci]!));
      s += wave * 0.12;
    }
    samples[i] = s * env;
  }
  return encodeWAV(samples, SAMPLE_RATE);
}
