import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSounds, SOUND_PHASES } from './SoundGenerator';

// Stub all sound generators so tests run without a real Phaser context.
vi.mock('./sounds/footsteps', () => ({ generateFootstepSound: vi.fn().mockReturnValue(new ArrayBuffer(0)) }));
vi.mock('./sounds/ui', () => ({
  generateInfoOpenSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateLinkClickSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));
vi.mock('./sounds/combat', () => ({
  generateHitSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateStompSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateHeartbeatSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));
vi.mock('./sounds/quiz', () => ({
  generateQuizCorrectSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateQuizWrongSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateQuizSuccessSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateQuizFailSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));
vi.mock('./sounds/movement', () => ({
  generateJumpSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateDropAUSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateRecoverAUSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));
vi.mock('./sounds/ambience', () => ({ generateDatacenterAmbience: vi.fn().mockReturnValue(new ArrayBuffer(0)) }));
vi.mock('./sounds/items', () => ({
  generateCoffeeSipSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateFridgeOpenSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));
vi.mock('./sounds/lullaby', () => ({ generateLullaby: vi.fn().mockReturnValue(new ArrayBuffer(0)) }));
vi.mock('./sounds/boss', () => ({
  generateBossHitSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateBossDefeatedSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateMugThrowSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateBossPhase2Sound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateBossPhase3Sound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateBriefcaseThrowSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateItemPickupSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateBombDisarmSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateHostageFreedSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generatePistolShotSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));
vi.mock('./sounds/mission', () => ({ generateFloorUnlockedSound: vi.fn().mockReturnValue(new ArrayBuffer(0)) }));
vi.mock('./sounds/wav', () => ({
  loadWav: vi.fn(),
  encodeWAV: vi.fn().mockReturnValue(new ArrayBuffer(0)),
}));

import { loadWav } from './sounds/wav';

function makeScene(audioCached: boolean) {
  return {
    cache: {
      audio: {
        exists: vi.fn().mockReturnValue(audioCached),
      },
    },
  };
}

describe('generateSounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls loadWav for every sound key on the first invocation', () => {
    const scene = makeScene(false);
    generateSounds(scene as never);
    // 5 movement + 7 UI + 3 combat + 3 env + 1 music + 10 boss = 29
    expect(loadWav).toHaveBeenCalledTimes(29);
  });

  it('skips all loadWav calls when audio is already cached', () => {
    const scene = makeScene(true);
    generateSounds(scene as never);
    expect(loadWav).not.toHaveBeenCalled();
  });

  it('checks the "jump" audio key for the cache guard', () => {
    const scene = makeScene(false);
    generateSounds(scene as never);
    expect(scene.cache.audio.exists).toHaveBeenCalledWith('jump');
  });
});

describe('SOUND_PHASES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a non-empty array', () => {
    expect(SOUND_PHASES.length).toBeGreaterThan(0);
  });

  it('every phase has a non-empty string label', () => {
    for (const phase of SOUND_PHASES) {
      expect(typeof phase.label).toBe('string');
      expect(phase.label.length).toBeGreaterThan(0);
    }
  });

  it('every phase has a run function', () => {
    for (const phase of SOUND_PHASES) {
      expect(typeof phase.run).toBe('function');
    }
  });

  it('running all phases calls loadWav for every sound key', () => {
    const scene = makeScene(false);
    for (const phase of SOUND_PHASES) {
      phase.run(scene as never);
    }
    // 5 movement + 7 UI + 3 combat + 3 env + 1 music + 10 boss = 29
    expect(loadWav).toHaveBeenCalledTimes(29);
  });

  it('phase labels are unique', () => {
    const labels = SOUND_PHASES.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
