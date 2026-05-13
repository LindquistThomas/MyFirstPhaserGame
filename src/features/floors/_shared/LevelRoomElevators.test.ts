import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { createFakeBody, createFakeScene, createFakeSprite } from '../../../../tests/helpers/phaserMock';
import type { Player } from '../../../entities/Player';
import { FLOORS } from '../../../config/gameConfig';
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

function makeHarness(options: { startY: number; playerX?: number; playerY?: number; onGround?: boolean; dialogOpen?: boolean }) {
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
    dialogs: { isOpen: options.dialogOpen ?? false },
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

  it('clamps at top and bottom bounds only while moving outward', () => {
    const { lift, manager, player } = makeHarness({
      startY: 200,
      playerX: 160,
      playerY: 176,
      onGround: true,
    });
    const body = player.sprite.body as ReturnType<typeof createFakeBody> & {
      velocity: { y: number };
    };

    // Try to move above minY.
    buttonMocks.getState.mockReturnValueOnce({ up: true, down: false });
    manager.update();
    expect(lift.y).toBe(200);
    expect(lift.body.velocity.y).toBe(0);

    // Try to move below maxY.
    lift.y = 500;
    buttonMocks.getState.mockReturnValueOnce({ up: false, down: true });
    manager.update();
    expect(lift.y).toBe(500);
    expect(lift.body.velocity.y).toBe(0);
    expect(body.velocity.y).toBe(0);
  });

  it('releases active lift when player jump impulse is stronger than lift speed', () => {
    const { manager, player } = makeHarness({
      startY: 300,
      playerX: 160,
      playerY: 276,
      onGround: true,
    });
    const body = player.sprite.body as ReturnType<typeof createFakeBody> & {
      velocity: { y: number };
    };

    manager.update(); // mount first
    body.velocity.y = -500; // jump impulse (< -(400 + 20))
    manager.update();

    expect(buttonMocks.setVisible).toHaveBeenLastCalledWith(false);
  });

  it('post-update pin aligns rider to platform when dialog is closed', () => {
    const { manager, player } = makeHarness({
      startY: 300,
      playerX: 160,
      playerY: 276,
      onGround: true,
    });
    manager.update(); // mount first

    const scene = (manager as unknown as { deps: { scene: { events: { on: ReturnType<typeof vi.fn> } } } }).deps.scene;
    const postHandler = scene.events.on.mock.calls.find((call: unknown[]) => call[0] === 'postupdate')?.[1] as
      | (() => void)
      | undefined;

    expect(postHandler).toBeTypeOf('function');
    postHandler?.();
    expect((player.sprite.setY as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect((player.sprite.body as unknown as { updateFromGameObject: ReturnType<typeof vi.fn> }).updateFromGameObject)
      .toHaveBeenCalled();
  });

  it('skips post-update pin while dialog is open', () => {
    const { manager, player } = makeHarness({
      startY: 300,
      playerX: 160,
      playerY: 276,
      onGround: true,
      dialogOpen: true,
    });
    manager.update(); // mount first
    const scene = (manager as unknown as { deps: { scene: { events: { on: ReturnType<typeof vi.fn> } } } }).deps.scene;
    const postHandler = scene.events.on.mock.calls.find((call: unknown[]) => call[0] === 'postupdate')?.[1] as
      | (() => void)
      | undefined;
    postHandler?.();
    expect(player.sprite.setY).not.toHaveBeenCalled();
  });

  it('handles empty roomElevators config without wiring postupdate listeners', () => {
    const scene = createFakeScene({
      inputs: { horizontal: () => 0, justPressed: () => false, isDown: () => false },
      physics: { add: { image: vi.fn(), sprite: vi.fn(), existing: vi.fn() } },
    } as Partial<ReturnType<typeof createFakeScene>>) as ReturnType<typeof createFakeScene>;
    (scene as unknown as { events: { on: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> } })
      .events = { on: vi.fn(), once: vi.fn(), off: vi.fn() };
    const manager = new LevelRoomElevators({
      scene: scene as unknown as Phaser.Scene,
      player: makePlayer(0, 0, false),
      dialogs: { isOpen: false },
    } as ConstructorParameters<typeof LevelRoomElevators>[0]);

    manager.build({
      floorId: FLOORS.PLATFORM_TEAM,
      roomElevators: [],
      platforms: [],
      tokens: [],
      playerStart: { x: 0, y: 0 },
      exitPosition: { x: 0, y: 0 },
    });
    manager.update();
    const events = (scene as unknown as { events: { on: ReturnType<typeof vi.fn> } }).events;
    expect(events.on).not.toHaveBeenCalledWith('postupdate', expect.any(Function));
  });
});
