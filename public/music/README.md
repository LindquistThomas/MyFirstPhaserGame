# Music Assets

Background music is loaded from the MP3 files in this directory:

- `retro-synth/retro_synth.mp3` — default game music (MenuScene, Floor1Scene, Floor2Scene)
- `elevator-jazz/elevator_jazz.mp3` — elevator shaft (HubScene)

These are loaded in `src/scenes/BootScene.ts` via `this.load.audio(...)`. SFX (jumps, footsteps, quiz feedback, info-card and link clicks) remain procedurally generated in `src/systems/SoundGenerator.ts`.

The procedural music generator `src/systems/MusicGenerator.ts` is retained for reference / fallback but is no longer called.

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

## Swapping in a different track

To switch to a different MP3, drop it into the appropriate subdirectory and update the path in `src/scenes/BootScene.ts` (the `this.load.audio(...)` calls in `preload()`). The EventBus, MusicPlugin and AudioManager will pick up the new file with no further changes.

## Licensing

All sources listed above offer CC0 or royalty-free tracks. Always verify the license on the specific track you download. Even for CC0 content, it's good practice to credit the author here.
