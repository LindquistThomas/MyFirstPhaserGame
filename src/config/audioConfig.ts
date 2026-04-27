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
  BossArenaScene:          'music_executive',
  ProductIsyProjectControlsScene: 'music_floor2',
  ProductIsyBeskrivelseScene:     'music_floor2',
  ProductIsyRoadScene:            'music_floor2',
  ProductAdminLisensScene:        'music_floor2',
};

export interface MusicAsset {
  key: string;
  path: string;
  /** When true, BootScene preloads this track before the menu renders. */
  eager?: boolean;
}

/**
 * Full music asset catalog.
 *
 * `eager: true` entries are loaded by `BootScene.preload()` so they are
 * instantly available when the menu renders. Non-eager entries are loaded
 * on-demand: tracks referenced in `SCENE_MUSIC` are lazy-loaded by
 * `MusicPlugin` on scene `create`; other call sites must use
 * `music:request` / `music:request-push` (instead of `music:play` /
 * `music:push`) so that `MusicPlugin` can ensure the asset is cached
 * before `AudioManager` attempts playback.
 *
 * Replaces the former separate `STATIC_MUSIC_ASSETS` / `DEFERRED_MUSIC_ASSETS`
 * split — `BootScene` now filters by `eager === true`.
 */
export const STATIC_MUSIC_ASSETS: ReadonlyArray<MusicAsset> = [
  { key: 'music_menu',          path: 'music/8bit-chiptune/bgm_menu.mp3',                   eager: true },
  { key: 'music_elevator_jazz', path: 'music/elevator-jazz/elevator_jazz.mp3',       eager: true },
  { key: 'music_elevator_ride', path: 'music/8bit-chiptune/bgm_action_3.mp3' },
  { key: 'music_floor1',        path: 'music/8bit-chiptune/bgm_action_1.mp3' },
  { key: 'music_floor2',        path: 'music/8bit-chiptune/bgm_action_2.mp3' },
  { key: 'music_platform',      path: 'music/retro-synth/shadow_operations-loop1.ogg' },
  { key: 'music_quiz',          path: 'music/retro-synth/hostile_territory-loop1.ogg' },
  { key: 'music_executive',     path: 'music/boss/bossroom-battle-431358.mp3' },
];

/**
 * Backward-compat view: assets that are NOT eager (formerly DEFERRED_MUSIC_ASSETS).
 * Prefer reading `STATIC_MUSIC_ASSETS` and filtering by `!eager` in new code.
 */
export const DEFERRED_MUSIC_ASSETS: ReadonlyArray<MusicAsset> = STATIC_MUSIC_ASSETS.filter(
  (a) => !a.eager,
);

/**
 * @deprecated Use the automatic lazy-loading in `MusicPlugin` instead.
 *
 * Queue a music asset for load on a scene's loader. Safe to call from
 * `preload()` on every scene entry — Phaser skips audio keys that are
 * already cached, so subsequent visits don't re-download.
 *
 * This helper is no longer needed now that `MusicPlugin` lazy-loads on
 * first play, but is kept so existing call-sites don't break.
 */
export function loadDeferredMusic(
  scene: { load: { audio: (key: string, url: string) => unknown }; cache: { audio: { exists: (key: string) => boolean } } },
  key: string,
): void {
  if (scene.cache.audio.exists(key)) return;
  const asset = STATIC_MUSIC_ASSETS.find((a) => a.key === key);
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
  'sfx:jump':              'jump',
  'sfx:footstep_a':        'footstep_a',
  'sfx:footstep_b':        'footstep_b',
  'sfx:quiz_correct':      'quiz_correct',
  'sfx:quiz_wrong':        'quiz_wrong',
  'sfx:quiz_success':      'quiz_success',
  'sfx:quiz_fail':         'quiz_fail',
  'sfx:info_open':         'info_open',
  'sfx:link_click':        'link_click',
  'sfx:hit':               'hit',
  'sfx:stomp':             'stomp',
  'sfx:drop_au':           'drop_au',
  'sfx:recover_au':        'recover_au',
  'sfx:coffee_sip':        'coffee_sip',
  'sfx:fridge_open':       'fridge_open',
  // Boss / hostage SFX
  'sfx:boss_hit':          'boss_hit',
  'sfx:boss_defeated':     'boss_defeated',
  'sfx:mug_throw':         'mug_throw',
  'sfx:boss_phase':        'boss_phase',
  'sfx:briefcase_throw':   'briefcase_throw',
  'sfx:item_pickup':       'item_pickup',
  'sfx:bomb_disarm':       'bomb_disarm',
  'sfx:hostage_freed':     'hostage_freed',
  'sfx:pistol_shot':       'pistol_shot',
};

/** Default volume for background music (0–1). */
export const MUSIC_VOLUME = 0.35;

/** Crossfade duration (ms) when switching music tracks. */
export const MUSIC_FADE_MS = 300;

/**
 * Default volume for looping ambience beds (0–1). Kept well below
 * MUSIC_VOLUME so the ambience reads as background texture underneath
 * the scene music rather than competing with it.
 */
export const AMBIENCE_VOLUME = 0.12;
