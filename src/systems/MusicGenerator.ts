import * as Phaser from 'phaser';
import { loadWav, encodeWAV } from './SoundGenerator';

/**
 * Procedural music generator — creates looping background tracks
 * from mathematical waveforms. No external audio files needed.
 */

/**
 * 22050 Hz is plenty for retro synth & lounge music, and keeps
 * synchronous generation fast (~330 k samples per 15 s track).
 */
const SAMPLE_RATE = 22050;

/* ------------------------------------------------------------------ */
/*  Waveform primitives                                               */
/* ------------------------------------------------------------------ */

function square(phase: number): number {
  return Math.sin(phase) >= 0 ? 1 : -1;
}

function sawtooth(phase: number): number {
  return 2 * ((phase / (2 * Math.PI)) % 1) - 1;
}

function triangle(phase: number): number {
  const t = (phase / (2 * Math.PI)) % 1;
  return 4 * Math.abs(t - 0.5) - 1;
}

function sine(phase: number): number {
  return Math.sin(phase);
}

/** Simple low-pass by averaging with previous sample. */
function lowPass(samples: Float32Array, amount: number): void {
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = prev + amount * (samples[i] - prev);
    prev = samples[i];
  }
}

/* ------------------------------------------------------------------ */
/*  Note helpers                                                      */
/* ------------------------------------------------------------------ */

/** MIDI note number → frequency (A4 = 69 = 440 Hz). */
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Convenient MIDI note names
const C2 = 36, D2 = 38, Eb2 = 39, F2 = 41, G2 = 43, Ab2 = 44, Bb2 = 46;
const C3 = 48, D3 = 50, Eb3 = 51, F3 = 53, G3 = 55, Ab3 = 56, A3 = 57, Bb3 = 58;
const C4 = 60, D4 = 62, Eb4 = 63, E4 = 64, F4 = 65, G4 = 67, Ab4 = 68, A4 = 69, Bb4 = 70;
const C5 = 72, D5 = 74, Eb5 = 75, G5 = 79;

/* ------------------------------------------------------------------ */
/*  Envelope                                                          */
/* ------------------------------------------------------------------ */

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
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/** Generate all music tracks and queue them for Phaser's audio loader. */
export function generateMusic(scene: Phaser.Scene): void {
  loadWav(scene, 'music_retro_synth', generateRetroSynth());
  loadWav(scene, 'music_elevator_jazz', generateElevatorJazz());
}

/* ------------------------------------------------------------------ */
/*  80s Retro Synth — default game music                              */
/* ------------------------------------------------------------------ */

function generateRetroSynth(): ArrayBuffer {
  const bpm = 128;
  const beatsPerChord = 8; // 2 bars per chord
  // Chord progression: Cm - Ab - Eb - Bb (single pass, loops via Phaser)
  const chordProgression = [
    { bass: C2,  arp: [C4, Eb4, G4, C5, G4, Eb4] },
    { bass: Ab2, arp: [Ab3, C4, Eb4, Ab4, Eb4, C4] },
    { bass: Eb2, arp: [Eb4, G4, Bb4, Eb5, Bb4, G4] },
    { bass: Bb2, arp: [Bb3, D4, F4, Bb4, F4, D4] },
  ];

  const totalBeats = chordProgression.length * beatsPerChord; // 32 beats — one pass
  const beatDur = 60 / bpm;
  const duration = totalBeats * beatDur; // ~15 seconds
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // Persistent phase accumulators to avoid clicks
  let arpPhase = 0;
  let bassPhase = 0;
  let padPhase1 = 0;
  let padPhase2 = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const beat = t / beatDur;
    const chordIdx = Math.floor(beat / beatsPerChord) % chordProgression.length;
    const chord = chordProgression[chordIdx];

    // --- Arpeggio (square wave, 16th notes) ---
    const arpNotesPerBeat = 4;
    const arpNoteIdx = Math.floor(beat * arpNotesPerBeat) % chord.arp.length;
    const arpFreq = midiToFreq(chord.arp[arpNoteIdx]);
    const arpNoteDur = beatDur / arpNotesPerBeat;
    const tInArpNote = (t % arpNoteDur);
    const arpEnv = noteEnvelope(tInArpNote, arpNoteDur, 0.005, arpNoteDur * 0.3);

    arpPhase += (2 * Math.PI * arpFreq) / SAMPLE_RATE;
    const arpSample = square(arpPhase) * arpEnv * 0.10;

    // --- Bass (sawtooth, 8th notes on root) ---
    const bassFreq = midiToFreq(chord.bass);
    const bassNoteDur = beatDur / 2;
    const tInBassNote = t % bassNoteDur;
    const bassEnv = noteEnvelope(tInBassNote, bassNoteDur, 0.01, bassNoteDur * 0.2);

    bassPhase += (2 * Math.PI * bassFreq) / SAMPLE_RATE;
    const bassSample = sawtooth(bassPhase) * bassEnv * 0.12;

    // --- Pad (soft triangle chord, root + 5th) ---
    const padFreq1 = midiToFreq(chord.arp[0]);
    const padFreq2 = midiToFreq(chord.arp[2]);
    padPhase1 += (2 * Math.PI * padFreq1) / SAMPLE_RATE;
    padPhase2 += (2 * Math.PI * padFreq2) / SAMPLE_RATE;
    const padSample = (triangle(padPhase1) + triangle(padPhase2)) * 0.04;

    samples[i] = arpSample + bassSample + padSample;
  }

  // Gentle low-pass to tame harshness
  lowPass(samples, 0.6);

  return encodeWAV(samples, SAMPLE_RATE);
}

/* ------------------------------------------------------------------ */
/*  Jazzy Elevator Music — HubScene                                   */
/* ------------------------------------------------------------------ */

function generateElevatorJazz(): ArrayBuffer {
  const bpm = 95;
  const beatsPerChord = 8; // 2 bars per chord
  // Jazz progression: Fmaj7 - Gm7 - Am7 - Bbmaj7 - Am7 - Gm7
  const chordProgression = [
    { bass: [F2, A3, C3, F2],     pad: [F3, A3, C4, E4] },   // Fmaj7
    { bass: [G2, Bb3, D3, G2],    pad: [G3, Bb3, D4, F4] },  // Gm7
    { bass: [A3, C3, A3, G2],     pad: [A3, C4, E4, G4] },   // Am7
    { bass: [Bb2, D3, F3, Bb2],   pad: [Bb3, D4, F4, A4] },  // Bbmaj7
    { bass: [A3, C3, E4, A3],     pad: [A3, C4, E4, G4] },   // Am7
    { bass: [G2, Bb3, D3, G2],    pad: [G3, Bb3, D4, F4] },  // Gm7
  ];

  const totalBeats = chordProgression.length * beatsPerChord / 2; // 24 beats — 3 chords
  const beatDur = 60 / bpm;
  const duration = totalBeats * beatDur; // ~15.2 seconds
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // Phase accumulators
  let bassPhase = 0;
  const padPhases = [0, 0, 0, 0];
  let melodyPhase = 0;

  // Simple melody line (quarter notes, chord tones with passing tones)
  const melodyPattern = [
    [F4, A4, C5, A4, G4, F4, E4, D4],     // over Fmaj7
    [G4, Bb4, D5, Bb4, A4, G4, F4, D4],   // over Gm7
    [A4, C5, E4, C5, D5, C5, A4, G4],     // over Am7
    [Bb4, D5, F4, D5, C5, Bb4, A4, F4],   // over Bbmaj7
    [A4, C5, E4, G4, A4, E4, C5, A4],     // over Am7
    [G4, Bb4, D4, F4, G4, D4, Bb4, G4],   // over Gm7
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const beat = t / beatDur;
    const chordIdx = Math.floor(beat / beatsPerChord) % chordProgression.length;
    const chord = chordProgression[chordIdx];
    const beatInChord = beat - Math.floor(beat / beatsPerChord) * beatsPerChord;

    // --- Walking bass (quarter notes) ---
    const bassNoteIdx = Math.floor(beatInChord) % chord.bass.length;
    const bassFreq = midiToFreq(chord.bass[bassNoteIdx]);
    const tInBassNote = (beatInChord % 1) * beatDur;
    const bassEnv = noteEnvelope(tInBassNote, beatDur, 0.02, beatDur * 0.15);

    bassPhase += (2 * Math.PI * bassFreq) / SAMPLE_RATE;
    // Mix triangle + sine for warm bass
    const bassSample = (triangle(bassPhase) * 0.6 + sine(bassPhase) * 0.4) * bassEnv * 0.13;

    // --- Pad (sine chord, whole notes with slow attack) ---
    let padSample = 0;
    for (let p = 0; p < chord.pad.length; p++) {
      const padFreq = midiToFreq(chord.pad[p]);
      padPhases[p] += (2 * Math.PI * padFreq) / SAMPLE_RATE;
      padSample += sine(padPhases[p]);
    }
    const padChordDur = beatsPerChord * beatDur;
    const tInChord = beatInChord * beatDur;
    const padEnv = noteEnvelope(tInChord, padChordDur, 0.3, 0.3);
    padSample = (padSample / chord.pad.length) * padEnv * 0.08;

    // --- Melody (quarter notes, sine + slight triangle) ---
    const melody = melodyPattern[chordIdx];
    const melNoteIdx = Math.floor(beatInChord) % melody.length;
    const melFreq = midiToFreq(melody[melNoteIdx]);
    const tInMelNote = (beatInChord % 1) * beatDur;
    const melEnv = noteEnvelope(tInMelNote, beatDur, 0.03, beatDur * 0.4);

    melodyPhase += (2 * Math.PI * melFreq) / SAMPLE_RATE;
    const melSample = (sine(melodyPhase) * 0.7 + triangle(melodyPhase) * 0.3) * melEnv * 0.09;

    samples[i] = bassSample + padSample + melSample;
  }

  // Smooth low-pass for warm jazz feel
  lowPass(samples, 0.4);

  return encodeWAV(samples, SAMPLE_RATE);
}
