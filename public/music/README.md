# Music Assets

Background music is currently generated procedurally at runtime (see `src/systems/MusicGenerator.ts`). To replace with higher-quality tracks, download CC0/royalty-free MP3s from the sources below and update `BootScene.preload()` to load them via `this.load.audio()` instead of `generateMusic()`.

## 80s Retro Synth (default game music)

Used in: MenuScene, Floor1Scene, Floor2Scene

| Source | Link |
|--------|------|
| OpenGameArt — Retro Synthwave Loops | https://opengameart.org/content/retro-synthwave-loops |
| OpenGameArt — CC0 Retro Music | https://opengameart.org/content/cc0-retro-music |
| OpenGameArt — Calm Ambient 2 (Synthwave 15k) | https://opengameart.org/content/calm-ambient-2-synthwave-15k |
| OpenGameArt — 8-bit Music Pack (Loopable) | https://opengameart.org/content/8-bit-music-pack-loopable |
| Pixabay — Synthwave Loop | https://pixabay.com/music/search/synthwave%20loop/ |
| Pixabay — 80s Synth | https://pixabay.com/music/search/80s%20synth/ |
| Pixabay — Retrogaming | https://pixabay.com/music/search/retrogaming/ |

## Jazzy Elevator Music (HubScene)

Used in: HubScene (elevator shaft)

| Source | Link |
|--------|------|
| Pixabay — Jazz Lounge Elevator Music | https://pixabay.com/music/elevator-music-jazz-lounge-elevator-music-332339/ |
| Pixabay — Lounge Jazz Elevator Music | https://pixabay.com/music/elevator-music-lounge-jazz-elevator-music-342629/ |
| Pixabay — Elevator Music Search | https://pixabay.com/music/search/elevator%20music%20jazz/ |
| Archive.org — Elevator Music (Kevin MacLeod, CC0) | https://archive.org/details/elevator-musicchosic.com |
| Archive.org — Elevator Music Bossa Nova | https://archive.org/details/elevator-music-bossa-nova-background-music-version-60s |

## How to replace procedural music with MP3 files

1. Download tracks and save them as `public/music/retro_synth.mp3` and `public/music/elevator_jazz.mp3`
2. In `src/scenes/BootScene.ts`, replace `generateMusic(this)` with:
   ```typescript
   this.load.audio('music_retro_synth', 'music/retro_synth.mp3');
   this.load.audio('music_elevator_jazz', 'music/elevator_jazz.mp3');
   ```
3. Remove the `generateMusic` import from BootScene
4. Everything else (EventBus, MusicPlugin, AudioManager) works unchanged

## Licensing

All sources listed above offer CC0 or royalty-free tracks. Always verify the license on the specific track you download. Even for CC0 content, it's good practice to credit the author here.
