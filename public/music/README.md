# Music Assets

Background music for the game lives in this directory as MP3 / OGG files organized by pack. Files are declared in `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts` (the full catalog). `BootScene.preload()` eagerly loads only `music_menu` and `music_elevator_jazz`; all other tracks are deferred so the menu renders fast while first-visited scenes still avoid silence. Tracks reach the Phaser cache via the mechanisms described below. Scene-to-track mapping is defined by `SCENE_MUSIC` in the same config file and applied automatically by `src/plugins/MusicPlugin.ts`.

SFX (jump, land, token collect, quiz feedback, info-card / link clicks, elevator cues, etc.) are **not** loaded from this directory — they are procedurally generated at runtime by `src/systems/SoundGenerator.ts`, which also generates the procedural lullaby track (no separate MusicGenerator module).

## Eager tracks (loaded at boot)

Tracks marked `eager: true`:

- `music_menu` (`8bit-chiptune/bgm_menu.ogg`)
- `music_elevator_jazz` (`elevator-jazz/elevator_jazz.mp3`)

All other tracks arrive via background mechanisms so time-to-interactive stays low.

## Lazy-loaded tracks

All tracks in `STATIC_MUSIC_ASSETS` are loaded in the background after first paint. There are three code paths:

### Via SCENE_MUSIC (automatic — MusicPlugin)
`MusicPlugin` intercepts the scene `create` lifecycle event, looks up the scene key in `SCENE_MUSIC`, and calls `playOrLoad()`. If the audio isn't cached yet, it queues a load on the scene's loader and emits `music:play` once the `filecomplete` event fires. Subsequent scene entries use the Phaser cache and play instantly. This path handles each scene's **own** background track and is the only path that wires up the `filecomplete→music:play` callback.

### Via MenuScene.idlePreloadMusic() (background prefetch)
`MenuScene.create()` calls `idlePreloadMusic()`, which proactively queues all non-eager, non-own-scene tracks and starts the loader during the idle time the player spends on the menu. This pre-warms the Phaser cache for floor/quiz/executive tracks so their `MusicPlugin` path hits the cache immediately. Skipped automatically on `saveData` and `2g`/`slow-2g` connections.

### Via music:request / music:request-push (imperative call sites)
Any code that needs to play or push a non-eager track imperatively must emit `music:request` (instead of `music:play`) or `music:request-push` (instead of `music:push`). `MusicPlugin` subscribes to these while the scene is active and performs the same load-then-play / load-then-push sequence.

| Asset key | File | Used by | Load path |
| --- | --- | --- | --- |
| `music_menu` | `8bit-chiptune/bgm_menu.ogg` | `MenuScene` (via `SCENE_MUSIC`) | Eager boot load + automatic |
| `music_elevator_jazz` | `elevator-jazz/elevator_jazz.mp3` | `ElevatorScene` (via `SCENE_MUSIC`); `ElevatorController` on elevator stop (`music:request`) | Eager boot load + automatic + imperative |
| `music_elevator_ride` | `8bit-chiptune/bgm_action_3.mp3` | `ElevatorController` on elevator start (`music:request`) | Imperative |
| `music_floor1` | `8bit-chiptune/bgm_action_1.mp3` | `ArchitectureTeamScene` (via `SCENE_MUSIC`) | Automatic |
| `music_floor2` | `8bit-chiptune/bgm_action_2.mp3` | `FinanceTeamScene`, `ProductLeadershipScene`, `CustomerSuccessScene`, and the Product sub-scenes (via `SCENE_MUSIC`) | Automatic |
| `music_platform` | `retro-synth/shadow_operations-loop1.ogg` | `PlatformTeamScene` (via `SCENE_MUSIC`) | Automatic |
| `music_quiz` | `retro-synth/hostile_territory-loop1.ogg` | `QuizDialog` on open (`music:request-push`); `QuizDialog` on close (`music:pop`) | Imperative |
| `music_executive` | `boss/bossroom-battle.ogg` | `ExecutiveSuiteScene` and `BossArenaScene` (via `SCENE_MUSIC`) | Automatic |

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

MP3 background tracks are re-encoded using **FFmpeg / libmp3lame**; OGG tracks (menu, boss battle, and retro-synth loops) use **libvorbis**. The two boss rescue-cue WAV files (`boss_tension.wav` / `boss_victory.wav`) are short procedural sounds kept at their original PCM quality and are not subject to the table below.

| Group | Bitrate | Channels | Sample rate | Re-encode command |
| --- | --- | --- | --- | --- |
| Menu track (`8bit-chiptune/bgm_menu.ogg`) | **64 kbps VBR** | mono | 44 100 Hz | `ffmpeg -i in.mp3 -c:a libvorbis -b:a 64k -ac 1 -ar 44100 bgm_menu.ogg` |
| 8-bit chiptune (`8bit-chiptune/*.mp3`) | **64 kbps CBR** | mono | 44 100 Hz | `ffmpeg -i in.mp3 -codec:a libmp3lame -b:a 64k -ar 44100 -ac 1 out.mp3` |
| Elevator jazz (`elevator-jazz/*.mp3`) | **96 kbps CBR** | stereo | 44 100 Hz | `ffmpeg -i in.mp3 -codec:a libmp3lame -b:a 96k -ar 44100 -ac 2 out.mp3` |
| Boss battle (`boss/bossroom-battle.ogg`) | **~28 kbps ABR** | mono | 22 050 Hz | `ffmpeg -i in.mp3 -ac 1 -ar 22050 -c:a libvorbis -b:a 28k -minrate 20k -maxrate 36k out.ogg` |
| OGG loops (`retro-synth/*.ogg`) | **96 kbps CBR** | stereo | 48 000 Hz | `ffmpeg -i in.ogg -c:a libvorbis -b:a 96k -ac 2 -ar 48000 out.ogg` |

> **Unused reserve tracks** (`8bit-chiptune/bgm_action_4.mp3`, `bgm_action_5.mp3`; `retro-synth/retro_synth.mp3`; `retro-synth/deadly_contracts-loop1.ogg` etc.) have not yet been re-encoded. Apply the matching group's command from the table above before activating any of them.

> **Note on track lengths and file sizes**: The chiptune, elevator-jazz, and boss tracks are full songs (47–192 s), so their deployed file sizes are large relative to the bitrate. Reducing bitrates further risks audible generation loss since these files are already lossy-encoded MP3s with no lossless source retained. The current settings are the minimum that avoids noticeable artefacts in a browser game context.

## Licensing

Tracks come from royalty-free / CC0 sources (OpenGameArt, Pixabay, Archive.org, and bundled chiptune and retro-synth packs). Verify the specific licence of any track you add before committing it, and note the author / source here if the licence requires attribution.
