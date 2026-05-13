import { describe, expect, it, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => ({
  default: { Scenes: { Events: { POST_UPDATE: 'postupdate', SHUTDOWN: 'shutdown' } } },
  Scenes: { Events: { POST_UPDATE: 'postupdate', SHUTDOWN: 'shutdown' } },
}));

const emitSpy = vi.hoisted(() => vi.fn());
vi.mock('../../systems/EventBus', () => ({
  eventBus: { emit: emitSpy },
}));

const reducedMotionSpy = vi.hoisted(() => vi.fn(() => false));
vi.mock('../../systems/MotionPreference', () => ({
  isReducedMotion: reducedMotionSpy,
}));

const clampSpy = vi.hoisted(() => vi.fn((x: number, cabX: number) => ({ x: Math.min(cabX + 10, x), moved: x > cabX + 10 })));
vi.mock('./elevatorCabGeometry', () => ({
  clampRiderToCab: clampSpy,
}));

import { ElevatorController } from './ElevatorController';

function makeHarness() {
  const colliderHandlers: Array<() => void> = [];
  const postHandlers: Array<() => void> = [];
  const scene = {
    physics: {
      add: {
        collider: vi.fn((_a: unknown, _b: unknown, cb: () => void) => {
          colliderHandlers.push(cb);
        }),
      },
    },
    events: {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'postupdate') postHandlers.push(cb);
      }),
      once: vi.fn(),
      off: vi.fn(),
    },
    cameras: { main: { shake: vi.fn() } },
  } as unknown as Phaser.Scene;

  const playerBody = {
    blocked: { down: true },
    touching: { down: false },
    bottom: 102,
    offset: { y: 0 },
    height: 48,
    velocity: { y: 0 },
    setVelocityX: vi.fn(),
    setVelocityY: vi.fn((vy: number) => {
      playerBody.velocity.y = vy;
    }),
    updateFromGameObject: vi.fn(),
  };

  const playerSprite = {
    x: 100,
    y: 80,
    displayOriginY: 24,
    body: playerBody,
    setX: vi.fn((x: number) => {
      playerSprite.x = x;
    }),
    setY: vi.fn((y: number) => {
      playerSprite.y = y;
    }),
  };
  const player = {
    sprite: playerSprite,
    setFlipEnabled: vi.fn(),
  };

  const platformBody = { y: 100, velocity: { y: -200 } };
  const elevator = {
    platform: { x: 100, y: 100, body: platformBody },
    ride: vi.fn(),
    getIsMoving: vi.fn(() => false),
    getFloorAtCurrentPosition: vi.fn(() => null),
    updateVisuals: vi.fn(),
  };

  const controller = new ElevatorController(scene, player as never, elevator as never);
  return { controller, scene, player, playerBody, elevator, postHandlers, colliderHandlers };
}

describe('ElevatorController', () => {
  beforeEach(() => {
    emitSpy.mockClear();
    reducedMotionSpy.mockReturnValue(false);
    clampSpy.mockClear();
  });

  it('disables flips while mounted and requests ride music on movement start', () => {
    const { controller, player, elevator, playerBody } = makeHarness();
    elevator.getIsMoving.mockReturnValue(true);

    controller.update({ up: true, down: false }, undefined, 16.67);

    expect(player.setFlipEnabled).toHaveBeenCalledWith(false);
    expect(playerBody.setVelocityX).toHaveBeenCalledWith(0);
    expect(elevator.ride).toHaveBeenCalledWith(true, false, 16.67);
    expect(emitSpy).toHaveBeenCalledWith('music:request', 'music_elevator_ride');
  });

  it('requests jazz and camera shake when movement stops while mounted', () => {
    const { controller, scene, elevator } = makeHarness();
    elevator.getIsMoving.mockReturnValueOnce(true).mockReturnValueOnce(false);

    controller.update({ up: true, down: false }, undefined);
    controller.update({ up: false, down: false }, undefined);

    expect(emitSpy).toHaveBeenCalledWith('music:request', 'music_elevator_jazz');
    expect(scene.cameras.main.shake).toHaveBeenCalledWith(90, 0.003);
  });

  it('pins rider on postupdate callback while mounted', () => {
    const { player, postHandlers, colliderHandlers } = makeHarness();
    const postUpdateHandler = postHandlers[0];
    expect(postUpdateHandler).toBeTypeOf('function');

    // Trigger mount via collider callback, then post-update pin.
    colliderHandlers[0]?.();
    postUpdateHandler?.();

    expect(player.sprite.setY).toHaveBeenCalled();
    expect((player.sprite.body as { updateFromGameObject: ReturnType<typeof vi.fn> }).updateFromGameObject)
      .toHaveBeenCalled();
  });

  it('falls back to idle ride when rider not mounted', () => {
    const { controller, player } = makeHarness();
    (player.sprite.body as { blocked: { down: boolean }; touching: { down: boolean } }).blocked.down = false;
    (player.sprite.body as { touching: { down: boolean } }).touching.down = false;

    controller.update({ up: false, down: false }, undefined);

    expect(controller.isOnElevator).toBe(false);
  });
});
