# Archived Design Specifications

This directory contains historical design specifications for features that
have been fully implemented and shipped. Files are preserved for design
context only — do not treat any checklist items as active TODOs. For the
current state of the codebase, refer to `docs/architecture.md`.

## Index

| Spec | Shipped feature |
|------|-----------------|
| [`issue-enemies-phase2.md`](./issue-enemies-phase2.md) | Enemies & obstacles — base `Enemy` class + per-floor subclasses (`src/entities/enemies/`); placement via `LevelConfig.enemies`. |
| [`issue-audio-phase3.md`](./issue-audio-phase3.md) | Music & SFX — `SCENE_MUSIC` (`src/config/audioConfig.ts`), procedural SFX (`src/systems/SoundGenerator.ts`), `AudioManager` + `MusicPlugin`, settings via `SettingsStore`. |

When archiving a new spec, add a row here with a one-line note on what
shipped (and where in `src/` it lives) so future readers don't have to
diff history to find the implementation.
