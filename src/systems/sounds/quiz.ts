import { SAMPLE_RATE, encodeWAV } from './wav';

/** Short ascending ding — triangle wave for correct quiz answer. */
export function generateQuizCorrectSound(): ArrayBuffer {
  const duration = 0.12;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    const freq = 660 + 220 * progress;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const envelope = 1 - progress * 0.7;
    samples[i] = wave * envelope * 0.2;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Low buzz — square wave for wrong quiz answer. */
export function generateQuizWrongSound(): ArrayBuffer {
  const duration = 0.18;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    const freq = 160 - 30 * progress;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = Math.sign(Math.sin(phase));
    const envelope = Math.exp(-progress * 4);
    samples[i] = wave * envelope * 0.15;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Ascending major arpeggio fanfare — celebratory quiz pass sound. */
export function generateQuizSuccessSound(): ArrayBuffer {
  const duration = 0.7;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // C5=523, E5=659, G5=784, C6=1047
  const notes = [523, 659, 784, 1047];
  const noteLen = Math.floor(numSamples / notes.length);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const noteIdx = Math.min(Math.floor(i / noteLen), notes.length - 1);
    const noteProgress = (i - noteIdx * noteLen) / noteLen;
    const freq = notes[noteIdx]!;

    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const square = Math.sign(Math.sin(phase));
    const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const wave = square * 0.6 + triangle * 0.4;

    let envelope: number;
    if (noteIdx === notes.length - 1) {
      envelope = Math.exp(-noteProgress * 2.5);
    } else {
      const attack = Math.min(noteProgress * 20, 1);
      envelope = attack * (1 - noteProgress * 0.3);
    }
    samples[i] = wave * envelope * 0.25;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Two descending notes — somber quiz fail sound. */
export function generateQuizFailSound(): ArrayBuffer {
  const duration = 0.35;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // E4=330, C4=262
  const notes = [330, 262];
  const noteLen = Math.floor(numSamples / notes.length);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const noteIdx = Math.min(Math.floor(i / noteLen), notes.length - 1);
    const noteProgress = (i - noteIdx * noteLen) / noteLen;
    const freq = notes[noteIdx]!;

    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = Math.sign(Math.sin(phase));
    const attack = Math.min(noteProgress * 15, 1);
    const envelope = attack * Math.exp(-noteProgress * 3);
    samples[i] = wave * envelope * 0.2;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}
