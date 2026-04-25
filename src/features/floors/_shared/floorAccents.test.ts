import { describe, it, expect, vi } from 'vitest';
import { drawFloorAccents, _accents, type AccentTheme } from './floorAccents';
import { FLOORS, type FloorId } from '../../../config/gameConfig';

function makeStubScene() {
  const tweens: unknown[] = [];
  const gameObjects: unknown[] = [];
  const chain = <T extends object>(obj: T): T => {
    // Add common chainable stubs.
    const stub = {
      setOrigin: () => stub,
      setDepth: () => stub,
      setStrokeStyle: () => stub,
      setFillStyle: () => stub,
      setRadius: () => stub,
    };
    return Object.assign(obj, stub) as T;
  };
  const add = {
    rectangle: vi.fn((..._args) => {
      const obj = chain({ type: 'rectangle' });
      gameObjects.push(obj);
      return obj;
    }),
    circle: vi.fn((..._args) => {
      const obj = chain({ type: 'circle', radius: 0 });
      gameObjects.push(obj);
      return obj;
    }),
  };
  return {
    add,
    tweens: {
      add: vi.fn((cfg) => {
        tweens.push(cfg);
        return cfg;
      }),
    },
    _tweens: tweens,
    _gameObjects: gameObjects,
  };
}

function makeStubGraphics() {
  return {
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    fillCircle: vi.fn(),
    fillEllipse: vi.fn(),
    lineStyle: vi.fn(),
    lineBetween: vi.fn(),
    strokeRect: vi.fn(),
  };
}

const theme: AccentTheme = {
  backgroundColor: 0x101020,
  wallColor: 0x445566,
  platformColor: 0x778899,
  tokenColor: 0xffcc55,
};

describe('drawFloorAccents', () => {
  const withAccents: FloorId[] = [
    FLOORS.LOBBY,
    FLOORS.PLATFORM_TEAM,
    FLOORS.BUSINESS,
    FLOORS.EXECUTIVE,
    FLOORS.PRODUCTS,
  ];

  it.each(withAccents)('renders silhouette + one ambient tween for floor %s', (floorId) => {
    const scene = makeStubScene();
    const g = makeStubGraphics();
    drawFloorAccents(floorId, {
       
      scene: scene as any,
       
      g: g as any,
      width: 1280,
      height: 720,
      theme,
    });
    // Some drawing happened.
    const drew =
      g.fillRect.mock.calls.length +
      g.fillCircle.mock.calls.length +
      g.fillEllipse.mock.calls.length +
      g.strokeRect.mock.calls.length +
      g.lineBetween.mock.calls.length;
    expect(drew).toBeGreaterThan(0);
    // Exactly one ambient tween per accent.
    expect(scene.tweens.add.mock.calls.length).toBe(1);
    // That tween repeats forever (no scene shutdown -> no cleanup needed
    // because Phaser kills tweens with the scene).
    const cfg = scene.tweens.add.mock.calls[0]![0] as { repeat: number; yoyo: boolean };
    expect(cfg.repeat).toBe(-1);
    expect(cfg.yoyo).toBe(true);
  });

  it('is a no-op for floors without a registered accent', () => {
    const scene = makeStubScene();
    const g = makeStubGraphics();
    const unknownFloor = 99 as FloorId;
    drawFloorAccents(unknownFloor, {
       
      scene: scene as any,
       
      g: g as any,
      width: 1280,
      height: 720,
      theme,
    });
    expect(scene.tweens.add).not.toHaveBeenCalled();
    expect(g.fillRect).not.toHaveBeenCalled();
  });

  it('registers an accent for every floor in the FLOORS enum', () => {
    for (const floorId of withAccents) {
      expect(_accents[floorId]).toBeTypeOf('function');
    }
  });
});
