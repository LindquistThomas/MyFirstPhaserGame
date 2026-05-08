import * as Phaser from 'phaser';
import { loadWav } from './sounds/wav';
import { generateFootstepSound } from './sounds/footsteps';
import { generateInfoOpenSound, generateLinkClickSound } from './sounds/ui';
import { generateHitSound, generateStompSound, generateHeartbeatSound } from './sounds/combat';
import {
  generateQuizCorrectSound,
  generateQuizWrongSound,
  generateQuizSuccessSound,
  generateQuizFailSound,
} from './sounds/quiz';
import {
  generateJumpSound,
  generateDropAUSound,
  generateRecoverAUSound,
} from './sounds/movement';
import { generateDatacenterAmbience } from './sounds/ambience';
import { generateCoffeeSipSound, generateFridgeOpenSound } from './sounds/items';
import { generateLullaby } from './sounds/lullaby';
import {
  generateBossHitSound,
  generateBossDefeatedSound,
  generateMugThrowSound,
  generateBossPhase2Sound,
  generateBossPhase3Sound,
  generateBriefcaseThrowSound,
  generateItemPickupSound,
  generateBombDisarmSound,
  generateHostageFreedSound,
  generatePistolShotSound,
} from './sounds/boss';
import { generateFloorUnlockedSound } from './sounds/mission';

import type { GeneratorPhase } from './SpriteGenerator';

/**
 * Ordered sound generation phases exposed for frame-yielding pipelines.
 *
 * `BootScene` iterates this array via `time.addEvent` so each phase runs
 * on its own frame tick and the progress bar updates smoothly. The cache
 * guard (`cache.audio.exists('jump')`) is checked by the caller before
 * starting the pipeline.
 */
export const SOUND_PHASES: readonly GeneratorPhase[] = [
  {
    label: 'Initializing audio (movement)',
    run: (s) => {
      loadWav(s, 'jump', generateJumpSound());
      loadWav(s, 'footstep_a', generateFootstepSound(100));
      loadWav(s, 'footstep_b', generateFootstepSound(85));
      loadWav(s, 'drop_au', generateDropAUSound());
      loadWav(s, 'recover_au', generateRecoverAUSound());
    },
  },
  {
    label: 'Initializing audio (UI)',
    run: (s) => {
      loadWav(s, 'quiz_correct', generateQuizCorrectSound());
      loadWav(s, 'quiz_wrong', generateQuizWrongSound());
      loadWav(s, 'quiz_success', generateQuizSuccessSound());
      loadWav(s, 'quiz_fail', generateQuizFailSound());
      loadWav(s, 'info_open', generateInfoOpenSound());
      loadWav(s, 'link_click', generateLinkClickSound());
      loadWav(s, 'floor_unlocked', generateFloorUnlockedSound());
    },
  },
  {
    label: 'Initializing audio (combat)',
    run: (s) => {
      loadWav(s, 'hit', generateHitSound());
      loadWav(s, 'stomp', generateStompSound());
      loadWav(s, 'heartbeat', generateHeartbeatSound());
    },
  },
  {
    label: 'Initializing audio (environment)',
    run: (s) => {
      loadWav(s, 'ambience_datacenter', generateDatacenterAmbience());
    },
  },
  {
    label: 'Generating music',
    run: (s) => {
      loadWav(s, 'music_lullaby', generateLullaby());
    },
  },
  {
    label: 'Initializing audio (boss)',
    run: (s) => {
      loadWav(s, 'boss_hit',        generateBossHitSound());
      loadWav(s, 'boss_defeated',   generateBossDefeatedSound());
      loadWav(s, 'mug_throw',       generateMugThrowSound());
      loadWav(s, 'boss_phase_2',    generateBossPhase2Sound());
      loadWav(s, 'boss_phase_3',    generateBossPhase3Sound());
      loadWav(s, 'briefcase_throw', generateBriefcaseThrowSound());
      loadWav(s, 'item_pickup',     generateItemPickupSound());
      loadWav(s, 'bomb_disarm',     generateBombDisarmSound());
      loadWav(s, 'hostage_freed',   generateHostageFreedSound());
      loadWav(s, 'pistol_shot',     generatePistolShotSound());
    },
  },
];

/** Sounds that are safe to warm up globally in MenuScene. */
export const MENU_EAGER_SOUND_PHASES: readonly GeneratorPhase[] = SOUND_PHASES.slice(0, 5);

/** Lazy subset: generated only in scenes that can consume coffee/fridge interactions. */
export const COFFEE_FRIDGE_SOUND_PHASES: readonly GeneratorPhase[] = [
  {
    label: 'Initializing audio (consumables)',
    run: (s) => {
      loadWav(s, 'coffee_sip', generateCoffeeSipSound());
      loadWav(s, 'fridge_open', generateFridgeOpenSound());
    },
  },
];

/** Lazy subset: generated only for executive rescue + boss fight flows. */
export const BOSS_RESCUE_SOUND_PHASES: readonly GeneratorPhase[] = [
  {
    label: 'Initializing audio (boss/rescue)',
    run: (s) => {
      loadWav(s, 'boss_hit',        generateBossHitSound());
      loadWav(s, 'boss_defeated',   generateBossDefeatedSound());
      loadWav(s, 'mug_throw',       generateMugThrowSound());
      loadWav(s, 'boss_phase_2',    generateBossPhase2Sound());
      loadWav(s, 'boss_phase_3',    generateBossPhase3Sound());
      loadWav(s, 'briefcase_throw', generateBriefcaseThrowSound());
      loadWav(s, 'bomb_disarm',     generateBombDisarmSound());
      loadWav(s, 'hostage_freed',   generateHostageFreedSound());
      loadWav(s, 'pistol_shot',     generatePistolShotSound());
    },
  },
];

/**
 * SOUND_PHASES batched into two callbacks for the MenuScene deferred warmup.
 *
 * Reduces the scheduler overhead from 6 × `time.addEvent` calls to 2 yield
 * points, cutting the total scheduling tax from ~36 ms to ~12 ms on
 * low-end hardware. The two batches are roughly equal in total work:
 *
 *   Batch 1 (phases 0–2): movement, UI/quiz, combat SFX
 *   Batch 2 (phases 3–4): ambience + lullaby
 *
 * Cache guard: check `cache.audio.exists('jump')` before running.
 */

/**
 * Index at which SOUND_PHASES is split into batch 1 vs batch 2.
 * Must equal MENU_EAGER_SOUND_PHASES.length / 2 (integer) so both batches get
 * an equal number of phases.
 */
const SOUND_BATCH_SPLIT = Math.ceil(MENU_EAGER_SOUND_PHASES.length / 2);

// Invariant: menu eager phases must have exactly 5 entries.
// If you add or remove a phase, update SOUND_BATCH_SPLIT and this comment.
if (import.meta.env.DEV && MENU_EAGER_SOUND_PHASES.length !== 5) {
  throw new Error(
    `[SoundGenerator] MENU_EAGER_SOUND_PHASES has ${MENU_EAGER_SOUND_PHASES.length} entries but BATCHED_SOUND_PHASES expects exactly 5. ` +
    `If you added or removed phases, update SOUND_BATCH_SPLIT and its invariant check.`,
  );
}

export const BATCHED_SOUND_PHASES: readonly [GeneratorPhase, GeneratorPhase] = [
  {
    label: 'Initializing audio (1/2)',
    run: (s) => {
      for (const phase of MENU_EAGER_SOUND_PHASES.slice(0, SOUND_BATCH_SPLIT)) phase.run(s);
    },
  },
  {
    label: 'Initializing audio (2/2)',
    run: (s) => {
      for (const phase of MENU_EAGER_SOUND_PHASES.slice(SOUND_BATCH_SPLIT)) phase.run(s);
    },
  },
];

function ensureSoundPhases(
  scene: Phaser.Scene,
  phases: readonly GeneratorPhase[],
  requiredAudioKeys: readonly string[],
): void {
  if (requiredAudioKeys.every((key) => scene.cache.audio.exists(key))) return;
  for (const phase of phases) phase.run(scene);
  scene.load.start();
}

export function ensureCoffeeFridgeSounds(scene: Phaser.Scene): void {
  ensureSoundPhases(scene, COFFEE_FRIDGE_SOUND_PHASES, ['coffee_sip', 'fridge_open']);
}

export function ensureBossRescueSounds(scene: Phaser.Scene): void {
  ensureSoundPhases(
    scene,
    BOSS_RESCUE_SOUND_PHASES,
    ['boss_hit', 'boss_defeated', 'mug_throw', 'boss_phase_2', 'boss_phase_3', 'briefcase_throw', 'bomb_disarm', 'hostage_freed', 'pistol_shot'],
  );
}

/**
 * Composition root for runtime audio generation.
 *
 * Every SFX is built procedurally so the game ships with zero SFX
 * files (music is still streamed from MP3/OGG in BootScene).
 * The procedural lullaby music track is also generated here.
 * Individual generators live under `./sounds/`; this file wires them up
 * for BootScene. Guarded by a cache check so re-entering BootScene does
 * not pay the generation cost again.
 *
 * For smooth boot-screen progress, prefer driving `SOUND_PHASES` directly
 * via a frame-yielding pipeline (see `BootScene`).
 */
export function generateSounds(scene: Phaser.Scene): void {
  if (scene.cache.audio.exists('jump')) return;
  for (const phase of SOUND_PHASES) {
    phase.run(scene);
  }
}

export { loadWav, encodeWAV } from './sounds/wav';
