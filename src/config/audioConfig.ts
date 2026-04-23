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
  ElevatorScene:     'music_elevator_jazz',
  PlatformTeamScene:       'music_platform',
  ArchitectureTeamScene:   'music_floor1',
  FinanceTeamScene:        'music_floor2',
  ProductLeadershipScene:  'music_floor2',
  CustomerSuccessScene:    'music_floor2',
  ExecutiveSuiteScene:     'music_executive',
  ProductIsyProjectControlsScene: 'music_floor2',
  ProductIsyBeskrivelseScene:     'music_floor2',
  ProductIsyRoadScene:            'music_floor2',
  ProductAdminLisensScene:        'music_floor2',
};

export interface MusicAsset {
  key: string;
  path: string;
}

/** Static music assets loaded by BootScene from /public/music. */
export const STATIC_MUSIC_ASSETS: ReadonlyArray<MusicAsset> = [
  { key: 'music_menu', path: 'music/8bit-chiptune/bgm_menu.mp3' },
  { key: 'music_elevator_jazz', path: 'music/elevator-jazz/elevator_jazz.mp3' },
  { key: 'music_elevator_ride', path: 'music/8bit-chiptune/bgm_action_3.mp3' },
  { key: 'music_floor1', path: 'music/8bit-chiptune/bgm_action_1.mp3' },
  { key: 'music_floor2', path: 'music/8bit-chiptune/bgm_action_2.mp3' },
  { key: 'music_platform', path: 'music/retro-synth/shadow_operations-loop1.ogg' },
  { key: 'music_quiz', path: 'music/retro-synth/hostile_territory-loop1.ogg' },
];

/**
 * Large or scene-specific music assets loaded on demand by the owning
 * scene's `preload()` rather than at BootScene startup. Keeps initial
 * load lean when a track is only needed by a single floor. Use the
 * `loadDeferredMusic()` helper from scene preload to pull one in.
 */
export const DEFERRED_MUSIC_ASSETS: ReadonlyArray<MusicAsset> = [
  { key: 'music_executive', path: 'music/boss/bossroom-battle-431358.mp3' },
];

/**
 * Queue a deferred music asset for load on a scene's loader. Safe to
 * call from `preload()` on every scene entry — Phaser skips audio keys
 * that are already cached, so subsequent visits don't re-download.
 */
export function loadDeferredMusic(
  scene: { load: { audio: (key: string, url: string) => unknown }; cache: { audio: { exists: (key: string) => boolean } } },
  key: string,
): void {
  if (scene.cache.audio.exists(key)) return;
  const asset = DEFERRED_MUSIC_ASSETS.find((a) => a.key === key);
  if (!asset) return;
  scene.load.audio(asset.key, asset.path);
}

export interface SoundtrackTrack {
  key: string;
  label: string;
}

/** Track list exposed in menu listen mode (cycled in-place). */
export const SOUNDTRACK_PLAYLIST: ReadonlyArray<SoundtrackTrack> = [
  { key: 'music_menu', label: 'MENU' },
  { key: 'music_elevator_jazz', label: 'ELEVATOR JAZZ' },
  { key: 'music_elevator_ride', label: 'ELEVATOR RIDE' },
  { key: 'music_floor1', label: 'FLOOR 1' },
  { key: 'music_floor2', label: 'FLOOR 2' },
  { key: 'music_platform', label: 'PLATFORM' },
  { key: 'music_quiz', label: 'QUIZ' },
  { key: 'music_executive', label: 'EXECUTIVE' },
  { key: 'music_lullaby', label: 'LULLABY' },
];

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
  'sfx:hit':          'hit',
  'sfx:stomp':        'stomp',
  'sfx:drop_au':      'drop_au',
  'sfx:recover_au':   'recover_au',
  'sfx:coffee_sip':   'coffee_sip',
};

/** Default volume for background music (0–1). */
export const MUSIC_VOLUME = 0.35;

/**
 * Default volume for looping ambience beds (0–1). Kept well below
 * MUSIC_VOLUME so the ambience reads as background texture underneath
 * the scene music rather than competing with it.
 */
export const AMBIENCE_VOLUME = 0.12;
