import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductDoorManager, ProductDoor } from './ProductDoorManager';

/**
 * ProductDoorManager is a Phaser-coupled class; these tests exercise the
 * pure list behaviour (coverage of the 4 product contentIds) and the
 * proximity-driven open/close + prompt toggle through light-weight stubs.
 */

describe('ProductDoorManager static door list', () => {
  it('exposes all four product rooms', () => {
    const ids = ProductDoorManager.doors.map((d) => d.contentId).sort();
    expect(ids).toEqual([
      'product-admin-lisens',
      'product-isy-beskrivelse',
      'product-isy-project-controls',
      'product-isy-road',
    ]);
  });

  it('maps each door to a registered scene key', () => {
    const expected = new Set([
      'ProductIsyProjectControlsScene',
      'ProductIsyBeskrivelseScene',
      'ProductIsyRoadScene',
      'ProductAdminLisensScene',
    ]);
    for (const d of ProductDoorManager.doors) {
      expect(expected.has(d.sceneKey)).toBe(true);
    }
  });

  it('places doors within the visible world (0..GAME_WIDTH=1280)', () => {
    for (const d of ProductDoorManager.doors) {
      expect(d.x).toBeGreaterThan(40);
      expect(d.x).toBeLessThan(1240);
    }
  });
});

describe('ProductDoorManager proximity + open-on-approach', () => {
  type StubbedDoor = { cfg: ProductDoor; setOpen: ReturnType<typeof vi.fn> };
  let stubs: StubbedDoor[];
  let manager: ProductDoorManager;
  let prompt: {
    setText: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setOrigin?: ReturnType<typeof vi.fn>;
    visible: boolean;
  };
  let onEnter: ReturnType<typeof vi.fn>;
  let playerX: number;
  let playerBottom: number;
  let onElevator: boolean;

  const WALK_Y = 1000;

  beforeEach(() => {
    stubs = [];
    onEnter = vi.fn();
    playerX = 0;
    playerBottom = WALK_Y;
    onElevator = false;

    // Stub scene.add.image / text so render() populates internal door list.
    const textStub = () => {
      const t = {
        setOrigin: vi.fn(function () { return t; }),
        setDepth: vi.fn(function () { return t; }),
        setText: vi.fn(function () { return t; }),
        setPosition: vi.fn(function () { return t; }),
        setVisible: vi.fn(function (v: boolean) { t.visible = v; return t; }),
        visible: false,
      };
      return t;
    };
    // Expose the *last* text() call (which is the prompt, created after the
    // door labels in render()) so assertions can inspect prompt visibility.
    let lastText: ReturnType<typeof textStub> | undefined;
    const scene = {
      add: {
        image: vi.fn(() => {
          const image = {
            setDepth: vi.fn(function () { return image; }),
            setInteractive: vi.fn(function () { return image; }),
            on: vi.fn(function () { return image; }),
            setTexture: vi.fn(),
            texture: { key: 'door_unlocked' },
          };
          return image;
        }),
        text: vi.fn(() => {
          lastText = textStub();
          return lastText;
        }),
      },
    } as unknown as import('phaser').Scene;

    manager = new ProductDoorManager({
      scene,
      player: { sprite: { body: { bottom: 0 } } } as never,
      productsWalkY: WALK_Y,
      isPlayerOnElevator: () => onElevator,
      onEnter,
    });
    manager.render();
    prompt = lastText as typeof prompt;

    // Intercept setOpen on each InteractiveDoor — easiest path is to spy
    // on the created image's setTexture via the internal list. We instead
    // replace the private `doors` field through a structural cast.
    type Internal = {
      doors: Array<{ cfg: ProductDoor; sprite: { setOpen: (open: boolean) => void } }>;
      deps: {
        player: { sprite: { body: { bottom: number; }; x: number; }; };
      };
    };
    const internal = manager as unknown as Internal;
    internal.doors = internal.doors.map((d) => {
      const stub = { cfg: d.cfg, setOpen: vi.fn() };
      stubs.push(stub);
      return { cfg: d.cfg, sprite: { setOpen: stub.setOpen } };
    });
    // Give the mutable player stub a live x/body.bottom so update()
    // reads the current values.
    Object.defineProperty(internal.deps.player.sprite, 'x', {
      get: () => playerX,
    });
    Object.defineProperty(internal.deps.player.sprite.body, 'bottom', {
      get: () => playerBottom,
    });
  });

  it('opens only the door the player is standing next to', () => {
    const target = ProductDoorManager.doors[2]!; // ISY Road
    playerX = target.x + 5;
    manager.update(false);

    for (const s of stubs) {
      expect(s.setOpen).toHaveBeenLastCalledWith(s.cfg.contentId === target.contentId);
    }
    expect(prompt.visible).toBe(true);
  });

  it('closes all doors and hides the prompt when away from every door', () => {
    playerX = 40; // well outside any door's proximity
    manager.update(false);
    for (const s of stubs) expect(s.setOpen).toHaveBeenLastCalledWith(false);
    expect(prompt.visible).toBe(false);
  });

  it('closes all doors when the player is riding the elevator', () => {
    const target = ProductDoorManager.doors[0]!;
    playerX = target.x;
    onElevator = true;
    manager.update(false);
    for (const s of stubs) expect(s.setOpen).toHaveBeenLastCalledWith(false);
    expect(prompt.visible).toBe(false);
  });

  it('closes all doors when the player is off the PRODUCTS walk surface', () => {
    const target = ProductDoorManager.doors[3]!;
    playerX = target.x;
    playerBottom = WALK_Y - 200; // in the air, nowhere near the floor
    manager.update(false);
    for (const s of stubs) expect(s.setOpen).toHaveBeenLastCalledWith(false);
  });

  it('fires onEnter when Interact is pressed near a door', () => {
    const target = ProductDoorManager.doors[1]!; // ISY Beskrivelse
    playerX = target.x - 10;
    manager.update(true);
    expect(onEnter).toHaveBeenCalledWith(target);
  });

  it('does not fire onEnter when Interact is pressed away from every door', () => {
    playerX = 40;
    manager.update(true);
    expect(onEnter).not.toHaveBeenCalled();
  });
});
