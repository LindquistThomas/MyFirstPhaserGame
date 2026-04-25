import * as Phaser from 'phaser';

export const SAMPLE_RATE = 44100;

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

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
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
