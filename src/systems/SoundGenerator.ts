import * as Phaser from 'phaser';

/**
 * Procedural audio generator — mirrors SpriteGenerator for visuals.
 * Creates WAV blobs from mathematical waveforms and loads them
 * through Phaser's standard audio pipeline.
 */

const SAMPLE_RATE = 44100;

/** Generate all game sounds and queue them for Phaser's audio loader. */
export function generateSounds(scene: Phaser.Scene): void {
  loadWav(scene, 'jump', generateJumpSound());
  loadWav(scene, 'footstep_a', generateFootstepSound(100));
  loadWav(scene, 'footstep_b', generateFootstepSound(85));
  loadWav(scene, 'quiz_correct', generateQuizCorrectSound());
  loadWav(scene, 'quiz_wrong', generateQuizWrongSound());
  loadWav(scene, 'quiz_success', generateQuizSuccessSound());
  loadWav(scene, 'quiz_fail', generateQuizFailSound());
}

export function loadWav(scene: Phaser.Scene, key: string, wav: ArrayBuffer): void {
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  let revoked = false;
  const revokeUrl = (): void => {
    if (revoked) return;
    revoked = true;
    URL.revokeObjectURL(url);
  };

  const onLoadError = (file: Phaser.Loader.File): void => {
    if (file.key !== key || file.type !== 'audio') return;
    scene.load.off('loaderror', onLoadError);
    revokeUrl();
  };

  scene.load.once(`filecomplete-audio-${key}`, () => {
    scene.load.off('loaderror', onLoadError);
    revokeUrl();
  });
  scene.load.on('loaderror', onLoadError);

  scene.load.audio(key, url);
}

/** Short percussive footstep — low thud + noise scuff. */
function generateFootstepSound(baseFreq: number): ArrayBuffer {
  const duration = 0.04;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    // Exponential decay envelope
    const envelope = Math.exp(-progress * 8);
    // Low-frequency square wave thud
    phase += (2 * Math.PI * baseFreq) / SAMPLE_RATE;
    const tonal = Math.sign(Math.sin(phase)) * 0.6;
    // Noise component (scuff)
    const noise = (Math.random() * 2 - 1) * 0.4;
    samples[i] = (tonal + noise) * envelope * 0.15;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Short upward frequency sweep — retro 8-bit jump "bwip". */
function generateJumpSound(): ArrayBuffer {
  const duration = 0.15;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    // Frequency sweep 200 Hz → 600 Hz
    const freq = 200 + 400 * progress;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    // Square wave
    const wave = Math.sign(Math.sin(phase));
    // Linear decay envelope
    const envelope = 1 - progress;
    samples[i] = wave * envelope * 0.3;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Short ascending ding — triangle wave for correct quiz answer. */
function generateQuizCorrectSound(): ArrayBuffer {
  const duration = 0.12;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = numSamples > 1 ? i / (numSamples - 1) : 1;
    // Ascending sweep 660 → 880 Hz (triangle wave)
    const freq = 660 + 220 * progress;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const envelope = 1 - progress * 0.7;
    samples[i] = wave * envelope * 0.2;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Low buzz — square wave for wrong quiz answer. */
function generateQuizWrongSound(): ArrayBuffer {
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
function generateQuizSuccessSound(): ArrayBuffer {
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
    const freq = notes[noteIdx];

    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    // Square wave with a touch of triangle for warmth
    const square = Math.sign(Math.sin(phase));
    const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const wave = square * 0.6 + triangle * 0.4;

    // Per-note envelope: quick attack, sustain, soft tail on last note
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
function generateQuizFailSound(): ArrayBuffer {
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
    const freq = notes[noteIdx];

    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const wave = Math.sign(Math.sin(phase));
    const attack = Math.min(noteProgress * 15, 1);
    const envelope = attack * Math.exp(-noteProgress * 3);
    samples[i] = wave * envelope * 0.2;
  }

  return encodeWAV(samples, SAMPLE_RATE);
}

/** Encode raw Float32 samples as a 16-bit PCM WAV file. */
export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);            // chunk size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples (float → 16-bit int)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcmSample = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
    view.setInt16(headerSize + i * 2, pcmSample, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
