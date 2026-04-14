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
}

function loadWav(scene: Phaser.Scene, key: string, wav: ArrayBuffer): void {
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  const revoke = (): void => URL.revokeObjectURL(url);
  scene.load.once(`filecomplete-audio-${key}`, revoke);
  scene.load.on('loaderror', (file: Phaser.Loader.File) => {
    if (file.key === key) revoke();
  });

  scene.load.audio(key, url);
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

/** Encode raw Float32 samples as a 16-bit PCM WAV file. */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
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
