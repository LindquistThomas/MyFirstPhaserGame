# Music Assets

Background music for the game lives in this directory as MP3 / OGG files organized by pack. Files are declared in `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts` and loaded by `BootScene.preload()` (which iterates that array). Scene-to-track mapping is defined by `SCENE_MUSIC` in the same config file and applied automatically by `src/plugins/MusicPlugin.ts`.

SFX (jump, land, token collect, quiz feedback, info-card / link clicks, elevator cues, etc.) are **not** loaded from this directory — they are procedurally generated at runtime by `src/systems/SoundGenerator.ts`. `src/systems/MusicGenerator.ts` produces a procedural lullaby used in the lobby sofa scene, and is otherwise retained as an unused fallback.

## Loaded tracks

The tracks currently wired up in `STATIC_MUSIC_ASSETS`:

| Asset key | File | Used by |
| --- | --- | --- |
| `music_menu` | `8bit-chiptune/bgm_menu.mp3` | `MenuScene` (via `SCENE_MUSIC`) |
| `music_elevator_jazz` | `elevator-jazz/elevator_jazz.mp3` | `ElevatorScene` (via `SCENE_MUSIC`) |
| `music_elevator_ride` | `8bit-chiptune/bgm_action_3.mp3` | `ElevatorController` — emitted imperatively with `music:play` during an active ride. |
| `music_floor1` | `8bit-chiptune/bgm_action_1.mp3` | `ArchitectureTeamScene` (via `SCENE_MUSIC`) |
| `music_floor2` | `8bit-chiptune/bgm_action_2.mp3` | `FinanceTeamScene`, `ProductLeadershipScene`, `CustomerSuccessScene`, `ExecutiveSuiteScene`, and the Product sub-scenes (`ProductIsyProjectControlsScene`, `ProductIsyBeskrivelseScene`, `ProductIsyRoadScene`, `ProductAdminLisensScene`) (via `SCENE_MUSIC`) |
| `music_platform` | `retro-synth/shadow_operations-loop1.ogg` | `PlatformTeamScene` (via `SCENE_MUSIC`) |
| `music_quiz` | `retro-synth/hostile_territory-loop1.ogg` | `QuizDialog` — emits `music:push` while a quiz is active, then pops back to scene music. |

## Unused tracks present on disk

The following files are part of the library but are not currently referenced by `STATIC_MUSIC_ASSETS`. They are kept so future floors / UI can pick them up without a round-trip through asset sourcing:

- `8bit-chiptune/bgm_action_4.mp3`
- `8bit-chiptune/bgm_action_5.mp3`
- `retro-synth/retro_synth.mp3`
- `retro-synth/deadly_contracts-loop1.ogg`
- `retro-synth/going_undercover-loop1.ogg`
- `retro-synth/the_price_of_freedom-loop1.ogg`

## Swapping in or adding a track

1. Drop the file into the appropriate subdirectory (`8bit-chiptune/`, `elevator-jazz/`, or `retro-synth/`) — or create a new pack directory.
2. Add an entry to `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts` with a `music_<name>` key and the path relative to `public/`.
3. Point one or more scenes at the new key in `SCENE_MUSIC` (same file). `MusicPlugin` picks it up automatically on the next scene transition — no scene code changes required.

## Licensing

Tracks come from royalty-free / CC0 sources (OpenGameArt, Pixabay, Archive.org, and bundled chiptune and retro-synth packs). Verify the specific licence of any track you add before committing it, and note the author / source here if the licence requires attribution.
