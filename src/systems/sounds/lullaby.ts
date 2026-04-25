import { encodeWAV } from './wav';

/**
 * 22050 Hz is sufficient for a slow, soft lullaby and keeps generation fast.
 */
const SAMPLE_RATE = 22050;

/* ------------------------------------------------------------------ */
/*  Waveform primitives                                               */
/* ------------------------------------------------------------------ */

function sine(phase: number): number {
  return Math.sin(phase);
}

function triangle(phase: number): number {
  const t = (phase / (2 * Math.PI)) % 1;
  return 4 * Math.abs(t - 0.5) - 1;
}

/** Simple low-pass by averaging with previous sample. */
function lowPass(samples: Float32Array, amount: number): void {
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = prev + amount * (samples[i] - prev);
    prev = samples[i];
  }
}

/** MIDI note number → frequency (A4 = 69 = 440 Hz). */
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Simple attack-release envelope for a note at a given position. */
function noteEnvelope(
  tInNote: number, noteDuration: number,
  attack: number, release: number,
): number {
  if (tInNote < attack) return tInNote / attack;
  if (tInNote > noteDuration - release) {
    return Math.max(0, (noteDuration - tInNote) / release);
  }
  return 1;
}

/* ------------------------------------------------------------------ */
/*  MIDI note constants (only those used by the lullaby)             */
/* ------------------------------------------------------------------ */

// MIDI note numbers: C4 (middle C) = 60, each semitone = +1.
// Formula: A4 = 69 = 440 Hz; midiToFreq(n) = 440 * 2^((n-69)/12).
const C3 = 48, F3 = 53, G3 = 55, A3 = 57, Bb3 = 58;
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, Bb4 = 70;
const C5 = 72;

/* ------------------------------------------------------------------ */
/*  Lullaby                                                           */
/* ------------------------------------------------------------------ */

/**
 * Soft, looping lullaby for the lobby sofa rest interaction. A slow 3/4
 * waltz on sine-wave pads plus a simple celesta-ish melody — intentionally
 * sleepy so sitting down feels like a lull.
 */
export function generateLullaby(): ArrayBuffer {
  const bpm = 66; // very slow waltz
  const beatDur = 60 / bpm;
  // Brahms-inspired descending lullaby phrase in F major (single pass, loops).
  // Each entry: [midi note, beats]. Rests are represented with note = 0.
  const melody: Array<[number, number]> = [
    [F4, 1], [F4, 1], [A4, 2],
    [F4, 1], [F4, 1], [A4, 2],
    [F4, 1], [A4, 1], [C5, 2],
    [Bb4, 1], [A4, 1], [G4, 2],
    [G4, 1], [A4, 1], [Bb4, 1],
    [A4, 1], [G4, 1], [F4, 3],
  ];
  // Gentle root-fifth pad per 3-beat bar, F / C / F / Bb / F / F.
  const padBars = [
    [F3, C4, F4],
    [C3, G3, E4],
    [F3, C4, F4],
    [Bb3, D4, F4],
    [F3, C4, F4],
    [F3, A3, C4],
  ];
  const totalBeats = melody.reduce((s, [, b]) => s + b, 0);
  const duration = totalBeats * beatDur;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  const melPhase = { v: 0 };
  const padPhases = [0, 0, 0];

  // Precompute note start times.
  const noteStarts: number[] = [];
  let acc = 0;
  for (const [, b] of melody) {
    noteStarts.push(acc);
    acc += b;
  }

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const beat = t / beatDur;

    // --- Melody ---
    let noteIdx = 0;
    for (let k = melody.length - 1; k >= 0; k--) {
      if (beat >= noteStarts[k]) { noteIdx = k; break; }
    }
    const [note, noteBeats] = melody[noteIdx];
    const noteDur = noteBeats * beatDur;
    const tInNote = t - noteStarts[noteIdx] * beatDur;
    let melSample = 0;
    if (note > 0) {
      const freq = midiToFreq(note);
      melPhase.v += (2 * Math.PI * freq) / SAMPLE_RATE;
      const env = noteEnvelope(tInNote, noteDur, 0.08, noteDur * 0.5);
      // Sine + tiny triangle overtone for a music-box feel.
      melSample = (sine(melPhase.v) * 0.75 + triangle(melPhase.v) * 0.15) * env * 0.14;
    }

    // --- Pad (one bar = 3 beats per padBars entry) ---
    const barIdx = Math.floor(beat / 3) % padBars.length;
    const bar = padBars[barIdx];
    const tInBar = (beat % 3) * beatDur;
    const barDur = 3 * beatDur;
    const padEnv = noteEnvelope(tInBar, barDur, 0.5, 0.8);
    let padSample = 0;
    for (let p = 0; p < bar.length; p++) {
      const freq = midiToFreq(bar[p]);
      padPhases[p] += (2 * Math.PI * freq) / SAMPLE_RATE;
      padSample += sine(padPhases[p]);
    }
    padSample = (padSample / bar.length) * padEnv * 0.09;

    samples[i] = melSample + padSample;
  }

  // Heavy low-pass — soft, hazy lullaby timbre.
  lowPass(samples, 0.25);
  lowPass(samples, 0.25);

  return encodeWAV(samples, SAMPLE_RATE);
}
