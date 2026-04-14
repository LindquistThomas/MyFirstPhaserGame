/**
 * Central audio configuration — single source of truth for all audio mappings.
 *
 * To add a new sound effect:
 *   1. Generate or load the sound in SoundGenerator / BootScene.preload()
 *   2. Add the event-to-key mapping in SFX_EVENTS below
 *   3. Emit the event from the relevant entity / system via eventBus
 */

/** Scene key → background music Phaser audio key. */
export const SCENE_MUSIC: Record<string, string> = {
  MenuScene:   'music_retro_synth',
  HubScene:    'music_elevator_jazz',
  Floor1Scene: 'music_retro_synth',
  Floor2Scene: 'music_retro_synth',
};

/** EventBus event name → Phaser SFX audio key. */
export const SFX_EVENTS: Record<string, string> = {
  'sfx:jump':         'jump',
  'sfx:footstep_a':   'footstep_a',
  'sfx:footstep_b':   'footstep_b',
  'sfx:quiz_correct': 'quiz_correct',
  'sfx:quiz_wrong':   'quiz_wrong',
  'sfx:quiz_success': 'quiz_success',
  'sfx:quiz_fail':    'quiz_fail',
};

/** Default volume for background music (0–1). */
export const MUSIC_VOLUME = 0.35;
