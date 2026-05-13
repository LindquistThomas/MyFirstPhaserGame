import { describe, it, expect, vi } from 'vitest';
import { LevelShadowController } from './LevelShadowController';

vi.mock('phaser', () => {
  const Phaser = {
    Math: {
      Clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
    },
  };
  return { ...Phaser, default: Phaser };
});

describe('LevelShadowController', () => {
  it('creates and updates player/enemy shadows, then cleans up on shutdown', () => {
    const created: Array<{ image: ReturnType<typeof makeShadow>; key: string }> = [];
    const scene = {
      textures: { exists: vi.fn(() => true) },
      add: {
        image: vi.fn((_x: number, _y: number, key: string) => {
          const image = makeShadow();
          created.push({ image, key });
          return image;
        }),
      },
    };

    const player = {
      sprite: {
        x: 10,
        y: 20,
        body: {
          blocked: { down: true },
          touching: { down: false },
          velocity: { y: 0 },
        },
      },
    };

    const enemyAlive = {
      x: 100,
      y: 110,
      defeated: false,
      active: true,
      body: { bottom: 144 },
    };
    const enemyDead = {
      x: 200,
      y: 210,
      defeated: true,
      active: false,
      body: { bottom: 244 },
    };

    const controller = new LevelShadowController({
      scene: scene as never,
      player: player as never,
      getEnemies: () => [enemyAlive, enemyDead] as never,
    });

    controller.init();
    controller.update();

    expect(scene.add.image).toHaveBeenCalledTimes(3);
    expect(created[0]!.image.setPosition).toHaveBeenCalledWith(10, 90);
    expect(created[0]!.image.setAlpha).toHaveBeenCalledWith(1);
    expect(created[0]!.image.setScale).toHaveBeenCalledWith(1);
    expect(created[2]!.image.destroy).toHaveBeenCalled();

    controller.shutdown();
    expect(created[0]!.image.destroy).toHaveBeenCalled();
    expect(created[1]!.image.destroy).toHaveBeenCalled();
  });

  it('skips init when shadow texture is missing', () => {
    const scene = {
      textures: { exists: vi.fn(() => false) },
      add: { image: vi.fn() },
    };

    const controller = new LevelShadowController({
      scene: scene as never,
      player: { sprite: { x: 0, y: 0, body: { blocked: { down: true }, touching: { down: false }, velocity: { y: 0 } } } } as never,
      getEnemies: () => [] as never,
    });

    controller.init();
    controller.update();
    controller.shutdown();

    expect(scene.add.image).not.toHaveBeenCalled();
  });
});

function makeShadow() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}
