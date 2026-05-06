# Boss / Spy-theme pack

Royalty-free tracks with a dramatic, cinematic / spy-film feel.

## Tracks

| File | Source | Artist | License |
| --- | --- | --- | --- |
| `bossroom-battle.ogg` | [Pixabay #431358](https://pixabay.com/music/?id=431358) | — | [Pixabay Content License](https://pixabay.com/service/license-summary/) (free for commercial use, no attribution required) |

Used by `ExecutiveSuiteScene` and `BossArenaScene` via `SCENE_MUSIC` — picked for its James-Bond-style brass/spy-theme character.

Re-encoded from the original `bossroom-battle-431358.mp3` (80 kbps stereo MP3) to OGG Vorbis (22 050 Hz mono, ~28 kbps ABR) using:

```bash
ffmpeg -i bossroom-battle-431358.mp3 \
  -ac 1 -ar 22050 -c:a libvorbis -b:a 28k -minrate 20k -maxrate 36k \
  bossroom-battle.ogg
```
