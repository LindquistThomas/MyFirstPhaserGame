import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelHUDBindings } from './LevelHUDBindings';

const update = vi.fn();
const showToast = vi.fn();
const hudCtor = vi.fn();
const eventBusEmit = vi.hoisted(() => vi.fn());

vi.mock('../../../systems/EventBus', () => ({
  eventBus: {
    emit: eventBusEmit,
  },
}));

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
    eventBusEmit.mockReset();
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

  it('emits objective:updated only when objective text changes after init', () => {
    let objective = 'Collect 1 of 5 tokens';
    const manager = new LevelHUDBindings({
      scene: {} as never,
      progression: {} as never,
      playtime: {} as never,
      getObjectiveText: () => objective,
      isObjectiveHidden: () => false,
    });

    manager.init();
    manager.update();
    objective = 'Collect 2 of 5 tokens';
    manager.update();
    manager.update();
    objective = ' ';
    manager.update();

    expect(eventBusEmit).toHaveBeenCalledTimes(1);
    expect(eventBusEmit).toHaveBeenCalledWith('objective:updated', { text: 'Collect 2 of 5 tokens' });
  });
});
