import { describe, expect, it } from 'vitest';
import { SCENE_MUSIC, SOUNDTRACK_PLAYLIST, STATIC_MUSIC_ASSETS, DEFERRED_MUSIC_ASSETS } from './audioConfig';

describe('audioConfig eager tracks', () => {
  it('music_menu is eager so menu music is available immediately after boot', () => {
    const menuAsset = STATIC_MUSIC_ASSETS.find((a) => a.key === 'music_menu');
    expect(menuAsset).toBeDefined();
    expect(menuAsset?.eager).toBe(true);
  });

  it('only menu + elevator jazz are eager', () => {
    const eagerAssets = STATIC_MUSIC_ASSETS.filter((a) => a.eager === true);
    expect(eagerAssets.map((a) => a.key).sort()).toEqual(['music_elevator_jazz', 'music_menu']);
  });
});

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

  it('contains only known loaded music keys', () => {
    const knownKeys = new Set([
      ...STATIC_MUSIC_ASSETS.map((asset) => asset.key),
      ...DEFERRED_MUSIC_ASSETS.map((asset) => asset.key),
      'music_lullaby',
    ]);
    for (const track of SOUNDTRACK_PLAYLIST) {
      expect(knownKeys.has(track.key)).toBe(true);
    }
  });
});
