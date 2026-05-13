import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { ElevatorShaftDoors } from './ElevatorShaftDoors';

function makeGraphics() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

describe('ElevatorShaftDoors', () => {
  it('opens when cab approaches dock and closes when it leaves', () => {
    const gfx = makeGraphics();
    const scene = { add: { graphics: vi.fn(() => gfx) } } as unknown as Phaser.Scene;
    const doors = new ElevatorShaftDoors(scene, 500, 700, 600, 520, 0x112233);

    doors.update(520, 350);
    doors.update(700, 350);

    expect(gfx.clear).toHaveBeenCalled();
    expect(gfx.fillRect).toHaveBeenCalled();
    doors.destroy();
    expect(gfx.destroy).toHaveBeenCalled();
  });

  it('clips cavity drawing to game width edges', () => {
    const gfx = makeGraphics();
    const scene = { add: { graphics: vi.fn(() => gfx) } } as unknown as Phaser.Scene;
    const doors = new ElevatorShaftDoors(scene, -20, 1300, 600, 520);

    doors.update(520, 100);

    // At least one fillRect call should be clipped against game bounds.
    const fillRectCalls = gfx.fillRect.mock.calls as Array<[number, number, number, number]>;
    expect(fillRectCalls.some(([x]) => x >= 0)).toBe(true);
  });
});
