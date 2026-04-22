## Audio — Music & Sound Effects (Phase 3)

> **Status: shipped — preserved as historical spec.** Scene music is driven by `SCENE_MUSIC` in `src/config/audioConfig.ts`; procedural SFX come from `src/systems/SoundGenerator.ts`; playback and mute are handled by `src/systems/AudioManager.ts` + `src/plugins/MusicPlugin.ts`; mute persists under localStorage key `architect_audio_muted_v1`. Keep this file for design context; do not treat the checklist below as an active TODO.

Add background music and sound effects to enhance game feel.

### Music

- **Menu theme** — chiptune/retro intro loop
- **Elevator shaft** — ambient electronic loop
- **Floor 1 (Platform Team)** — upbeat retro track
- **Floor 2 (Cloud Team)** — airy/atmospheric track
- **Victory jingle** — short fanfare when unlocking a new floor

### Sound Effects

- Jump
- Land (dust puff)
- Collect AU token (coin/ding)
- Elevator moving (mechanical hum)
- Elevator arrival (ding)
- Door open/enter
- UI button hover/click

### Implementation Notes

- Use Phaser's built-in `SoundManager`
- Music should loop per scene, crossfade on scene transitions
- SFX should be short, retro-style (8-bit or chiptune)
- Consider using free assets from [opengameart.org](https://opengameart.org) or [freesound.org](https://freesound.org)
- Audio files go in `public/music/` (loaded by `BootScene.preload()` via `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts`). No `public/assets/audio/` directory exists.
- Add mute toggle to HUD (volume slider is not implemented — only mute).

### Acceptance Criteria

- [x] Background music for each scene
- [x] SFX for core actions (jump, collect, elevator)
- [x] Mute toggle in HUD
- [x] Audio doesn't play until user interacts (browser autoplay policy)
