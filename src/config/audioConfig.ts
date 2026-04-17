/**
 * Central audio configuration — single source of truth for all audio mappings.
 *
 * To add a new sound effect:
 *   1. Generate or load the sound in SoundGenerator / BootScene.preload()
 *   2. Declare the event in `GameEvents` (src/systems/EventBus.ts)
 *   3. Add the event-to-key mapping in SFX_EVENTS below
 *   4. Emit the event from the relevant entity / system via eventBus
 */
import type { GameEventName } from '../systems/EventBus';

/** SFX-style events map onto Phaser sound keys. */
type SfxEventName = Extract<GameEventName, `sfx:${string}`>;

/** Scene key → background music Phaser audio key. */
export const SCENE_MUSIC: Record<string, string> = {
  MenuScene:    'music_menu',
  HubScene:     'music_elevator_jazz',
  Floor0Scene:  'music_floor1',
  Floor1Scene:  'music_floor1',
  Floor2Scene:  'music_floor2',
};

/** EventBus event name → Phaser SFX audio key. */
export const SFX_EVENTS: Record<SfxEventName, string> = {
  'sfx:jump':         'jump',
  'sfx:footstep_a':   'footstep_a',
  'sfx:footstep_b':   'footstep_b',
  'sfx:quiz_correct': 'quiz_correct',
  'sfx:quiz_wrong':   'quiz_wrong',
  'sfx:quiz_success': 'quiz_success',
  'sfx:quiz_fail':    'quiz_fail',
  'sfx:info_open':    'info_open',
  'sfx:link_click':   'link_click',
};

/** Default volume for background music (0–1). */
export const MUSIC_VOLUME = 0.35;
