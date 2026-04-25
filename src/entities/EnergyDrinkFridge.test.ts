import { describe, it, expect, vi } from 'vitest';
import { createFakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  class Image {
    scene: unknown;
    x: number;
    y: number;
    texture = 'fridge_closed';
    depth = 0;
    origin = { x: 0, y: 0 };

    constructor(scene: unknown, x: number, y: number, texture: string) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.texture = texture;
    }

    setDepth(depth: number) { this.depth = depth; return this; }
    setOrigin(x: number, y: number) { this.origin = { x, y }; return this; }
    setTexture(texture: string) { this.texture = texture; return this; }
  }

  const Phaser = { GameObjects: { Image } };
  return { ...Phaser, default: Phaser };
});

import { EnergyDrinkFridge, ENERGY_DRINK_DURATION_MS } from './EnergyDrinkFridge';

describe('EnergyDrinkFridge', () => {
  it('uses the closed texture and ground-aligned origin on construction', () => {
    const scene = createFakeScene();
    const fridge = new EnergyDrinkFridge(scene as unknown as Phaser.Scene, 120, 832);

    expect(scene.add.existing).toHaveBeenCalledWith(fridge);
    expect((fridge as unknown as { texture: string }).texture).toBe('fridge_closed');
    expect((fridge as unknown as { depth: number }).depth).toBe(5);
    expect((fridge as unknown as { origin: { x: number; y: number } }).origin).toEqual({ x: 0.5, y: 1 });
    expect(fridge.opened).toBe(false);
  });

  it('open() switches texture once and is idempotent', () => {
    const scene = createFakeScene();
    const fridge = new EnergyDrinkFridge(scene as unknown as Phaser.Scene, 120, 832);
    const setTexture = vi.spyOn(fridge as unknown as { setTexture: (key: string) => unknown }, 'setTexture');

    fridge.open();
    fridge.open();

    expect(fridge.opened).toBe(true);
    expect(setTexture).toHaveBeenCalledTimes(1);
    expect(setTexture).toHaveBeenCalledWith('fridge_open');
  });

  it('grants a twelve second caffeine duration', () => {
    expect(ENERGY_DRINK_DURATION_MS).toBe(12_000);
  });
});
