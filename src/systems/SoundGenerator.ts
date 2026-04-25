import * as Phaser from 'phaser';
import { loadWav } from './sounds/wav';
import { generateFootstepSound } from './sounds/footsteps';
import { generateInfoOpenSound, generateLinkClickSound } from './sounds/ui';
import { generateHitSound, generateStompSound } from './sounds/combat';
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

/**
 * Composition root for runtime audio generation.
 *
 * Every SFX is built procedurally so the game ships with zero SFX
 * files (music is still streamed from MP3/OGG in BootScene).
 * Individual generators live under `./sounds/`; this file wires them up
 * for BootScene.
 */
export function generateSounds(scene: Phaser.Scene): void {
  loadWav(scene, 'jump', generateJumpSound());
  loadWav(scene, 'footstep_a', generateFootstepSound(100));
  loadWav(scene, 'footstep_b', generateFootstepSound(85));
  loadWav(scene, 'quiz_correct', generateQuizCorrectSound());
  loadWav(scene, 'quiz_wrong', generateQuizWrongSound());
  loadWav(scene, 'quiz_success', generateQuizSuccessSound());
  loadWav(scene, 'quiz_fail', generateQuizFailSound());
  loadWav(scene, 'info_open', generateInfoOpenSound());
  loadWav(scene, 'link_click', generateLinkClickSound());
  loadWav(scene, 'hit', generateHitSound());
  loadWav(scene, 'stomp', generateStompSound());
  loadWav(scene, 'drop_au', generateDropAUSound());
  loadWav(scene, 'recover_au', generateRecoverAUSound());
  loadWav(scene, 'ambience_datacenter', generateDatacenterAmbience());
  loadWav(scene, 'coffee_sip', generateCoffeeSipSound());
  loadWav(scene, 'fridge_open', generateFridgeOpenSound());
}

export { loadWav, encodeWAV } from './sounds/wav';
