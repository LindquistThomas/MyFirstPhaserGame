# Music Assets

Background music for the game lives in this directory as MP3 / OGG files organized by pack. Files are declared in `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts` (the full catalog). `BootScene.preload()` loads only entries tagged `eager: true` (currently just the menu track); everything else is **lazy-loaded** the first time `MusicPlugin` needs to play it. Scene-to-track mapping is defined by `SCENE_MUSIC` in the same config file and applied automatically by `src/plugins/MusicPlugin.ts`.

SFX (jump, land, token collect, quiz feedback, info-card / link clicks, elevator cues, etc.) are **not** loaded from this directory — they are procedurally generated at runtime by `src/systems/SoundGenerator.ts`. `src/systems/MusicGenerator.ts` produces a procedural lullaby used in the lobby sofa scene, and is otherwise retained as an unused fallback.

## Eager tracks (loaded at boot)

Only these tracks are loaded before the menu renders:

| Asset key | File | Used by |
| --- | --- | --- |
| `music_menu` | `8bit-chiptune/bgm_menu.mp3` | `MenuScene` (via `SCENE_MUSIC`) |

## Lazy-loaded tracks

All other tracks in `STATIC_MUSIC_ASSETS` are lazy-loaded on demand. There are two code paths:

### Via SCENE_MUSIC (automatic)
`MusicPlugin` intercepts the scene `create` lifecycle event, looks up the scene key in `SCENE_MUSIC`, and calls `playOrLoad()`. If the audio isn't cached yet, it queues a load on the scene's loader and emits `music:play` once the `filecomplete` event fires. Subsequent scene entries use the Phaser cache and play instantly.

### Via music:request / music:request-push (imperative call sites)
Any code that needs to play or push a non-eager track imperatively must emit `music:request` (instead of `music:play`) or `music:request-push` (instead of `music:push`). `MusicPlugin` subscribes to these while the scene is active and performs the same load-then-play / load-then-push sequence.

| Asset key | File | Used by | Load path |
| --- | --- | --- | --- |
| `music_elevator_jazz` | `elevator-jazz/elevator_jazz.mp3` | `ElevatorScene` (via `SCENE_MUSIC`); `ElevatorController` on elevator stop (`music:request`) | Automatic + imperative |
| `music_elevator_ride` | `8bit-chiptune/bgm_action_3.mp3` | `ElevatorController` on elevator start (`music:request`) | Imperative |
| `music_floor1` | `8bit-chiptune/bgm_action_1.mp3` | `ArchitectureTeamScene` (via `SCENE_MUSIC`) | Automatic |
| `music_floor2` | `8bit-chiptune/bgm_action_2.mp3` | `FinanceTeamScene`, `ProductLeadershipScene`, `CustomerSuccessScene`, and the Product sub-scenes (via `SCENE_MUSIC`) | Automatic |
| `music_platform` | `retro-synth/shadow_operations-loop1.ogg` | `PlatformTeamScene` (via `SCENE_MUSIC`) | Automatic |
| `music_quiz` | `retro-synth/hostile_territory-loop1.ogg` | `QuizDialog` on open (`music:request-push`); `QuizDialog` on close (`music:pop`) | Imperative |
| `music_executive` | `boss/bossroom-battle-431358.mp3` | `ExecutiveSuiteScene` (via `SCENE_MUSIC`); also pre-loaded in its `preload()` to avoid any silence gap on first entry | Automatic + optional preload |

## Unused tracks present on disk

The following files are part of the library but are not currently referenced by `STATIC_MUSIC_ASSETS`. They are kept so future floors / UI can pick them up without a round-trip through asset sourcing:

- `8bit-chiptune/bgm_action_4.mp3`
- `8bit-chiptune/bgm_action_5.mp3`
- `retro-synth/retro_synth.mp3`
- `retro-synth/deadly_contracts-loop1.ogg`
- `retro-synth/going_undercover-loop1.ogg`
- `retro-synth/the_price_of_freedom-loop1.ogg`

## Swapping in or adding a track

1. Drop the file into an appropriate subdirectory under `public/music/` (current packs: `8bit-chiptune/`, `elevator-jazz/`, `retro-synth/`, `boss/` — or create a new pack directory).
2. Add an entry to `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts` with a `music_<name>` key, the path relative to `public/`, and `eager: true` only if it must be available before the menu renders (otherwise omit — it will be lazy-loaded).
3. Point one or more scenes at the new key in `SCENE_MUSIC` (same file). `MusicPlugin` picks it up automatically on the next scene transition and lazy-loads the file on first play.
4. For code that emits music events imperatively (outside SCENE_MUSIC), use `music:request` instead of `music:play`, or `music:request-push` instead of `music:push`. `MusicPlugin` intercepts these, loads the asset if needed, then forwards to AudioManager.

## Encoding

All files are re-encoded for web delivery. Target bitrates:

- 8-bit chiptune tracks (`8bit-chiptune/*.mp3`): **80 kbps** (originals were already at this bitrate)
- Regular music (`elevator-jazz/*.mp3`, `boss/*.mp3`): **128 kbps** / boss at **96 kbps**
- OGG loop tracks (`retro-synth/*.ogg`): **96 kbps CBR** or **VBR quality 2** (~80 kbps average)
- Unused reserve tracks: **80–96 kbps** (quality is acceptable since they serve as a library)

Re-encode command: `ffmpeg -i in.mp3 -b:a 128k -ac 2 out.mp3` (music), `ffmpeg -i in.ogg -c:a libvorbis -b:a 96k out.ogg` (loops).

## Licensing

Tracks come from royalty-free / CC0 sources (OpenGameArt, Pixabay, Archive.org, and bundled chiptune and retro-synth packs). Verify the specific licence of any track you add before committing it, and note the author / source here if the licence requires attribution.
