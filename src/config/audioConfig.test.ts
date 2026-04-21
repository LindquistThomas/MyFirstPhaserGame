import { describe, expect, it } from 'vitest';
import { SCENE_MUSIC, SOUNDTRACK_PLAYLIST } from './audioConfig';

describe('audioConfig soundtrack listen mode', () => {
  it('exposes unique soundtrack keys for menu cycling', () => {
    const keys = SOUNDTRACK_PLAYLIST.map((track) => track.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('includes every scene background track in the soundtrack playlist', () => {
    const playlistKeys = new Set(SOUNDTRACK_PLAYLIST.map((track) => track.key));
    for (const musicKey of Object.values(SCENE_MUSIC)) {
      expect(playlistKeys.has(musicKey)).toBe(true);
    }
  });
});
