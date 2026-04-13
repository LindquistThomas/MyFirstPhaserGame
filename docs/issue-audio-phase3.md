## Audio — Music & Sound Effects (Phase 3)

Add background music and sound effects to enhance game feel.

### Music

- **Menu theme** — chiptune/retro intro loop
- **Hub/Elevator** — ambient electronic loop
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
- Audio files go in `public/assets/audio/`
- Add mute/volume toggle to HUD

### Acceptance Criteria

- [ ] Background music for each scene
- [ ] SFX for core actions (jump, collect, elevator)
- [ ] Mute toggle in HUD
- [ ] Audio doesn't play until user interacts (browser autoplay policy)
