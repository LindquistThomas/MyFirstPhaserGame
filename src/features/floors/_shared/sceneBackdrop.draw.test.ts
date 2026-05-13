import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';

const drawFloorPattern = vi.hoisted(() => vi.fn());
vi.mock('./floorPatterns', () => ({
  drawFloorPattern,
}));

import { drawSceneBackdrop } from './sceneBackdrop';

function makeGraphics() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
  };
}

describe('drawSceneBackdrop', () => {
  it('draws all backdrop layers and calls accents callback when provided', () => {
    const graphics = makeGraphics();
    const scene = {
      add: {
        graphics: vi.fn(() => graphics),
      },
    } as unknown as Phaser.Scene;
    const accents = vi.fn();

    const out = drawSceneBackdrop(scene, {
      width: 1280,
      height: 720,
      theme: { backgroundColor: 0x223344, wallColor: 0x334455, platformColor: 0x556677 },
      pattern: 'blueprint',
      patternSeed: 42,
      drawAccents: accents,
    });

    expect(out).toBe(graphics);
    expect(graphics.setDepth).toHaveBeenCalledWith(0);
    expect(drawFloorPattern).toHaveBeenCalledWith(
      'blueprint',
      graphics,
      1280,
      720,
      { backgroundColor: 0x223344, wallColor: 0x334455, platformColor: 0x556677 },
      42,
    );
    expect(graphics.fillRect).toHaveBeenCalled();
    expect(graphics.strokeRect).toHaveBeenCalledWith(0.5, 0.5, 1279, 719);
    expect(accents).toHaveBeenCalledWith(graphics);
  });

  it('uses default pattern and seed when not provided', () => {
    const graphics = makeGraphics();
    const scene = {
      add: {
        graphics: vi.fn(() => graphics),
      },
    } as unknown as Phaser.Scene;

    drawSceneBackdrop(scene, {
      width: 800,
      height: 600,
      theme: { backgroundColor: 0x111111, wallColor: 0x222222, platformColor: 0x333333 },
    });

    expect(drawFloorPattern).toHaveBeenLastCalledWith(
      'grid',
      graphics,
      800,
      600,
      { backgroundColor: 0x111111, wallColor: 0x222222, platformColor: 0x333333 },
      0,
    );
  });
});
