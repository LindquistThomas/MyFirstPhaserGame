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
      loadWav(s, 'coffee_sip', generateCoffeeSipSound());
      loadWav(s, 'fridge_open', generateFridgeOpenSound());
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
