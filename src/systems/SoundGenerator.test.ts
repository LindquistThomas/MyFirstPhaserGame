import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSounds,
  SOUND_PHASES,
  BATCHED_SOUND_PHASES,
  ensureCoffeeFridgeSounds,
  ensureBossRescueSounds,
} from './SoundGenerator';

// Stub all sound generators so tests run without a real Phaser context.
vi.mock('./sounds/footsteps', () => ({ generateFootstepSound: vi.fn().mockReturnValue(new ArrayBuffer(0)) }));
vi.mock('./sounds/ui', () => ({
  generateInfoOpenSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateLinkClickSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
  generateNpcGreetSound: vi.fn().mockReturnValue(new ArrayBuffer(0)),
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
    load: {
      start: vi.fn(),
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
    // 5 movement + 8 UI + 3 combat + 1 env + 1 music + 10 boss = 28
    expect(loadWav).toHaveBeenCalledTimes(28);
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
    // 5 movement + 8 UI + 3 combat + 1 env + 1 music + 10 boss = 28
    expect(loadWav).toHaveBeenCalledTimes(28);
  });

  it('phase labels are unique', () => {
    const labels = SOUND_PHASES.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('BATCHED_SOUND_PHASES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has exactly two batches', () => {
    expect(BATCHED_SOUND_PHASES).toHaveLength(2);
  });

  it('together cover all SOUND_PHASES entries', () => {
    const scene = makeScene(false);
    for (const batch of BATCHED_SOUND_PHASES) {
      batch.run(scene as never);
    }
    // Running both batches must call loadWav for the eager subset only.
    expect(loadWav).toHaveBeenCalledTimes(18);
  });

  it('split point produces two non-empty batches that cover all phases', () => {
    // Each batch must run at least one phase.
    const scene = makeScene(false);
    BATCHED_SOUND_PHASES[0].run(scene as never);
    const afterBatch0 = (loadWav as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(afterBatch0).toBeGreaterThan(0);

    vi.clearAllMocks();
    BATCHED_SOUND_PHASES[1].run(scene as never);
    const afterBatch1 = (loadWav as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(afterBatch1).toBeGreaterThan(0);

    // Together they must account for all 18 eager loadWav calls.
    expect(afterBatch0 + afterBatch1).toBe(18);
  });

  it('batch labels are non-empty strings', () => {
    for (const batch of BATCHED_SOUND_PHASES) {
      expect(typeof batch.label).toBe('string');
      expect(batch.label.length).toBeGreaterThan(0);
    }
  });
});

describe('lazy ensure helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensureCoffeeFridgeSounds queues sounds and starts loader when missing', () => {
    const scene = makeScene(false);
    ensureCoffeeFridgeSounds(scene as never);
    expect(loadWav).toHaveBeenCalledTimes(2);
    expect(scene.load.start).toHaveBeenCalledTimes(1);
  });

  it('ensureBossRescueSounds no-ops when boss/rescue keys already cached', () => {
    const scene = makeScene(true);
    ensureBossRescueSounds(scene as never);
    expect(loadWav).not.toHaveBeenCalled();
    expect(scene.load.start).not.toHaveBeenCalled();
  });
});
