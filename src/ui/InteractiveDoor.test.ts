import { describe, it, expect, vi } from 'vitest';
import { InteractiveDoor } from './InteractiveDoor';

function fakeScene() {
  const image = {
    setTexture: vi.fn(),
    setDepth: vi.fn(function (this: unknown) { return image; }),
    setInteractive: vi.fn(function (this: unknown) { return image; }),
    on: vi.fn(function (this: unknown) { return image; }),
    x: 0,
    y: 0,
    texture: { key: 'door_unlocked' },
  };
  return {
    scene: { add: { image: vi.fn(() => image) } } as unknown as import('phaser').Scene,
    image,
  };
}

describe('InteractiveDoor', () => {
  it('creates an image with the closed texture', () => {
    const { scene, image } = fakeScene();
    new InteractiveDoor(scene, 100, 200, 'door_unlocked', 'door_open');
    expect((scene.add.image as any)).toHaveBeenCalledWith(100, 200, 'door_unlocked');
    expect(image.setDepth).toHaveBeenCalledWith(3);
  });

  it('swaps to open texture on setOpen(true) and back on setOpen(false)', () => {
    const { scene, image } = fakeScene();
    const door = new InteractiveDoor(scene, 0, 0, 'door_unlocked', 'door_open');

    door.setOpen(true);
    expect(image.setTexture).toHaveBeenLastCalledWith('door_open');
    expect(door.isOpen()).toBe(true);

    door.setOpen(false);
    expect(image.setTexture).toHaveBeenLastCalledWith('door_unlocked');
    expect(door.isOpen()).toBe(false);
  });

  it('is a no-op when already in the requested state', () => {
    const { scene, image } = fakeScene();
    const door = new InteractiveDoor(scene, 0, 0, 'door_unlocked', 'door_open');

    door.setOpen(false);
    expect(image.setTexture).not.toHaveBeenCalled();

    door.setOpen(true);
    door.setOpen(true);
    expect(image.setTexture).toHaveBeenCalledTimes(1);
  });

  it('wires pointerdown handler through onPointerDown', () => {
    const { scene, image } = fakeScene();
    const door = new InteractiveDoor(scene, 0, 0, 'door_unlocked', 'door_open');
    const handler = vi.fn();
    door.onPointerDown(handler);
    expect(image.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
    const onCall = (image.on as any).mock.calls[0];
    expect(onCall[0]).toBe('pointerdown');
    onCall[1]();
    expect(handler).toHaveBeenCalled();
  });
});
