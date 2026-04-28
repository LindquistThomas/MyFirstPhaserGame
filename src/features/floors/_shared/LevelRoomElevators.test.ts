import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { createFakeBody, createFakeScene, createFakeSprite } from '../../../../tests/helpers/phaserMock';
import type { Player } from '../../../entities/Player';
import { LevelRoomElevators } from './LevelRoomElevators';

vi.mock('phaser', () => {
  const Phaser = {
    Scenes: {
      Events: {
        POST_UPDATE: 'postupdate',
        SHUTDOWN: 'shutdown',
      },
    },
  };
  return { ...Phaser, default: Phaser };
});

const buttonMocks = vi.hoisted(() => ({
  setVisible: vi.fn(),
  getState: vi.fn(() => ({ up: false, down: false })),
}));

vi.mock('../../../ui/ElevatorButtons', () => ({
  ElevatorButtons: class {
    setVisible = buttonMocks.setVisible;
    getState = buttonMocks.getState;
  },
}));

function makePlayer(x: number, y: number, onGround: boolean): Player {
  const body = createFakeBody() as ReturnType<typeof createFakeBody> & {
    halfHeight: number;
    height: number;
    offset: { y: number };
    setVelocityY: (y: number) => unknown;
    updateFromGameObject: () => void;
  };
  body.halfHeight = 24;
  body.height = 48;
  body.offset = { y: 0 };
  body.blocked.down = onGround;
  body.setVelocityY = vi.fn((vy: number) => {
    body.velocity.y = vy;
    return body;
  });
  body.updateFromGameObject = vi.fn();

  const sprite = createFakeSprite(x, y, body) as ReturnType<typeof createFakeSprite> & {
    displayOriginY: number;
    setY: (nextY: number) => unknown;
  };
  sprite.displayOriginY = 24;
  sprite.setY = vi.fn((nextY: number) => {
    sprite.y = nextY;
    return sprite;
  });

  return { sprite } as unknown as Player;
}

function makeHarness(options: { startY: number; playerX?: number; playerY?: number; onGround?: boolean }) {
  buttonMocks.setVisible.mockClear();
  buttonMocks.getState.mockClear();

  const lift = createFakeSprite(160, options.startY);
  const scene = createFakeScene({
    inputs: {
      horizontal: () => 0,
      justPressed: () => false,
      isDown: () => false,
    },
    physics: {
      add: {
        image: vi.fn(() => lift),
        sprite: vi.fn((x: number, y: number) => createFakeSprite(x, y)),
        existing: vi.fn(),
      },
    },
  } as Partial<ReturnType<typeof createFakeScene>>) as ReturnType<typeof createFakeScene> & {
    events: {
      on: (event: string, handler: () => void) => void;
      once: (event: string, handler: () => void) => void;
      off: (event: string, handler: () => void) => void;
    };
    inputs: ReturnType<typeof createFakeScene>['inputs'] & { isDown: (action: string) => boolean };
  };
  scene.events = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  };

  const player = makePlayer(
    options.playerX ?? 20,
    options.playerY ?? 420,
    options.onGround ?? false,
  );
  const manager = new LevelRoomElevators({
    scene: scene as unknown as Phaser.Scene,
    player,
    dialogs: { isOpen: false },
  } as ConstructorParameters<typeof LevelRoomElevators>[0]);

  manager.build({
    roomElevators: [{ x: 160, minY: 200, maxY: 500, startY: options.startY }],
  } as Parameters<typeof manager.build>[0]);

  return { lift, manager, player };
}

describe('LevelRoomElevators', () => {
  it('returns an idle lift downward when the player is not riding it', () => {
    const { lift, manager } = makeHarness({ startY: 300 });

    manager.update();

    expect(lift.body.velocity.y).toBe(400);
    expect(buttonMocks.setVisible).toHaveBeenLastCalledWith(false);
  });

  it('parks an idle lift at its base when the return reaches the bottom', () => {
    const { lift, manager } = makeHarness({ startY: 501 });

    manager.update();

    expect(lift.y).toBe(500);
    expect(lift.body.velocity.y).toBe(0);
  });

  it('does not auto-return while the player is standing on the lift', () => {
    const { lift, manager, player } = makeHarness({
      startY: 300,
      playerX: 160,
      playerY: 276,
      onGround: true,
    });

    manager.update();

    expect(lift.body.velocity.y).toBe(0);
    expect((player.sprite.body as { velocity: { y: number } }).velocity.y).toBe(0);
    expect(buttonMocks.setVisible).toHaveBeenLastCalledWith(true);
  });
});
