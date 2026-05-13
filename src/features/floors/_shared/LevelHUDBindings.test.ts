import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelHUDBindings } from './LevelHUDBindings';

const update = vi.fn();
const showToast = vi.fn();
const hudCtor = vi.fn();

vi.mock('../../../ui/HUD', () => ({
  HUD: class HUD {
    update = update;
    showToast = showToast;
    constructor(...args: unknown[]) {
      hudCtor(...args);
    }
  },
}));

describe('LevelHUDBindings', () => {
  beforeEach(() => {
    update.mockReset();
    showToast.mockReset();
    hudCtor.mockReset();
  });

  it('initializes HUD and forwards update + toast lifecycle', () => {
    const manager = new LevelHUDBindings({
      scene: {} as never,
      progression: {} as never,
      playtime: {} as never,
      getObjectiveText: () => 'Ship thing',
      isObjectiveHidden: () => false,
    });

    manager.init();
    manager.update();
    manager.showToast('hello', 1234);
    manager.shutdown();
    manager.update();

    expect(hudCtor).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('hello', 1234);
  });
});
