import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelHeartbeatSfx } from './LevelHeartbeatSfx';

const { emit, isReducedMotion } = vi.hoisted(() => ({
  emit: vi.fn(),
  isReducedMotion: vi.fn(() => false),
}));
vi.mock('../../../systems/EventBus', () => ({ eventBus: { emit } }));
vi.mock('../../../systems/MotionPreference', () => ({ isReducedMotion }));

describe('LevelHeartbeatSfx', () => {
  beforeEach(() => {
    emit.mockReset();
    isReducedMotion.mockReturnValue(false);
  });

  it('shows vignette and emits heartbeat while in danger', () => {
    const graphics = makeGraphics();
    const scene = {
      scale: { width: 1280, height: 720 },
      add: { graphics: vi.fn(() => graphics) },
    };
    const floorHazard = { isDangerZone: vi.fn(() => true) };
    const progression = { getFloorAU: vi.fn(() => 1) };

    const manager = new LevelHeartbeatSfx({
      scene: scene as never,
      floorId: 3 as never,
      progression: progression as never,
      floorHazard: floorHazard as never,
    });

    manager.init();
    manager.update(300);
    manager.update(600);

    expect(graphics.setVisible).toHaveBeenCalledWith(true);
    expect(emit).toHaveBeenCalledWith('sfx:heartbeat');

    manager.reset();
    expect(graphics.setVisible).toHaveBeenLastCalledWith(false);

    manager.shutdown();
    expect(graphics.destroy).toHaveBeenCalled();
  });

  it('hides vignette and does not emit when not in danger', () => {
    const graphics = makeGraphics();
    const scene = {
      scale: { width: 320, height: 240 },
      add: { graphics: vi.fn(() => graphics) },
    };
    const floorHazard = { isDangerZone: vi.fn(() => false) };
    const progression = { getFloorAU: vi.fn(() => 5) };

    const manager = new LevelHeartbeatSfx({
      scene: scene as never,
      floorId: 3 as never,
      progression: progression as never,
      floorHazard: floorHazard as never,
    });

    manager.init();
    manager.update(900);

    expect(graphics.setVisible).toHaveBeenCalledWith(false);
    expect(emit).not.toHaveBeenCalled();
  });
});

function makeGraphics() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}
