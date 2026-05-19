import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../systems/EventBus';

vi.mock('phaser', () => {
  class Container {
    visible = true;
    constructor(_scene: unknown, _x: number, _y: number) {}
    add(): this { return this; }
    setDepth(): this { return this; }
    setScrollFactor(): this { return this; }
    setVisible(v: boolean): this { this.visible = v; return this; }
  }
  return { default: { GameObjects: { Container } }, GameObjects: { Container } };
});

vi.mock('../systems/SettingsStore', () => ({
  settingsStore: {
    read: vi.fn(() => ({ showObjectiveBanner: true })),
  },
}));

import { settingsStore } from '../systems/SettingsStore';
import { ObjectiveBanner } from './ObjectiveBanner';

function makeScene() {
  const handlers: Record<string, Array<() => void>> = {};
  const textObj = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
  };
  return {
    add: {
      graphics: vi.fn(() => ({
        fillStyle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
      })),
      text: vi.fn(() => textObj),
      existing: vi.fn(),
    },
    events: {
      once: vi.fn((event: string, cb: () => void) => {
        (handlers[event] ??= []).push(cb);
      }),
      emit: (event: string) => {
        for (const cb of handlers[event] ?? []) cb();
      },
    },
  };
}

describe('ObjectiveBanner', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
    vi.clearAllMocks();
    vi.mocked(settingsStore.read).mockReturnValue(
      { showObjectiveBanner: true } as ReturnType<typeof settingsStore.read>,
    );
  });

  it('updates text on progression:changed', () => {
    const scene = makeScene();
    let objective = 'Find elevator';
    const banner = new ObjectiveBanner(scene as never, { getText: () => objective });
    const textObj = scene.add.text.mock.results[0]!.value;

    objective = 'Reach Platform floor';
    eventBus.emit('progression:changed');
    banner.update();

    expect(textObj.setText).toHaveBeenCalledWith('Reach Platform floor');
  });

  it('updates text during update() and emits objective:updated for later changes only', () => {
    const scene = makeScene();
    let objective = 'Collect mugs and hit the CEO';
    const handler = vi.fn();
    eventBus.on('objective:updated', handler);
    try {
      const banner = new ObjectiveBanner(scene as never, { getText: () => objective });
      const textObj = scene.add.text.mock.results[0]!.value;

      objective = 'Answer the architecture challenge';
      banner.update();

      expect(textObj.setText).toHaveBeenCalledWith('Answer the architecture challenge');
      expect(handler).toHaveBeenCalledWith({ text: 'Answer the architecture challenge' });
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      eventBus.off('objective:updated', handler);
    }
  });

  it('does not emit objective:updated when text becomes empty', () => {
    const scene = makeScene();
    let objective = 'Stun the CEO, then finish the fight';
    const handler = vi.fn();
    eventBus.on('objective:updated', handler);
    try {
      const banner = new ObjectiveBanner(scene as never, { getText: () => objective });
      objective = '';
      banner.update();
      expect(handler).not.toHaveBeenCalled();
    } finally {
      eventBus.off('objective:updated', handler);
    }
  });

  it('hides and shows based on modal state', () => {
    const scene = makeScene();
    let modalOpen = false;
    const banner = new ObjectiveBanner(scene as never, {
      getText: () => 'Collect AU',
      isModalOpen: () => modalOpen,
    });

    expect((banner as unknown as { visible: boolean }).visible).toBe(true);
    modalOpen = true;
    banner.update();
    expect((banner as unknown as { visible: boolean }).visible).toBe(false);
    modalOpen = false;
    banner.update();
    expect((banner as unknown as { visible: boolean }).visible).toBe(true);
  });

  it('respects showObjectiveBanner setting', () => {
    const scene = makeScene();
    const banner = new ObjectiveBanner(scene as never, { getText: () => 'Collect AU' });

    vi.mocked(settingsStore.read).mockReturnValue(
      { showObjectiveBanner: false } as ReturnType<typeof settingsStore.read>,
    );
    eventBus.emit('settings:changed');
    expect((banner as unknown as { visible: boolean }).visible).toBe(false);

    vi.mocked(settingsStore.read).mockReturnValue(
      { showObjectiveBanner: true } as ReturnType<typeof settingsStore.read>,
    );
    eventBus.emit('settings:changed');
    expect((banner as unknown as { visible: boolean }).visible).toBe(true);
  });
});
