import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeScene, type FakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

// Elevator only uses Phaser for type references, but the `import * as Phaser`
// in Elevator.ts still evaluates the module at runtime. Stub out the surface
// that other files in the test suite (Token, Player) actually touch so this
// file can stand on its own if run in isolation.
vi.mock('phaser', () => {
  class Sprite {}
  const Phaser = {
    Physics: { Arcade: { Sprite } },
    Animations: { Events: { ANIMATION_UPDATE: 'animationupdate' } },
  };
  return { ...Phaser, default: Phaser };
});

import { Elevator } from './Elevator';

function makeElevator(floors: Array<[number, number]> = [[0, 100], [1, 500]]): {
  scene: FakeScene;
  elevator: Elevator;
} {
  const scene = createFakeScene();
  const startY = floors.length > 0 ? floors[0][1] : 100;
  const elevator = new Elevator(scene as unknown as Phaser.Scene, 100, startY);
  for (const [id, y] of floors) elevator.addFloor(id, y);
  return { scene, elevator };
}

describe('Elevator', () => {
  beforeEach(() => {
    // No global state — just keeping beforeEach for symmetry.
  });

  describe('boundary clamp regression', () => {
    it('does NOT zero velocity when at maxY but moving inward (up)', () => {
      const { elevator } = makeElevator([[0, 100], [1, 500]]);
      // Park the cab exactly on the lower bound, then press up (inward).
      elevator.platform.y = 500;

      elevator.ride(true, false, 16.67);

      // Velocity should have started ramping negative (upwards), NOT be zeroed.
      // We can only observe it via setVelocityY being called with a negative.
      const setVY = elevator.platform.setVelocityY as unknown as ReturnType<typeof vi.fn>;
      const lastCall = setVY.mock.calls[setVY.mock.calls.length - 1];
      expect(lastCall[0]).toBeLessThan(0);
      // Cab still moving, so getIsMoving is true (|velocity| > 1).
      expect(elevator.getIsMoving()).toBe(true);
    });

    it('does NOT zero velocity when at minY but moving inward (down)', () => {
      const { elevator } = makeElevator([[0, 100], [1, 500]]);
      elevator.platform.y = 100;

      elevator.ride(false, true, 16.67);

      const setVY = elevator.platform.setVelocityY as unknown as ReturnType<typeof vi.fn>;
      const lastCall = setVY.mock.calls[setVY.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThan(0);
      expect(elevator.getIsMoving()).toBe(true);
    });

    it('zeros velocity at maxY when pressing down (moving outward)', () => {
      const { elevator } = makeElevator([[0, 100], [1, 500]]);
      elevator.platform.y = 500;

      // Ramp up some downward velocity first by forcing y just shy of maxY.
      elevator.platform.y = 499;
      elevator.ride(false, true, 16.67);
      // Now at 499 with positive velocity; set to maxY and drive down again.
      elevator.platform.y = 500;
      elevator.ride(false, true, 16.67);

      const setVY = elevator.platform.setVelocityY as unknown as ReturnType<typeof vi.fn>;
      const lastCall = setVY.mock.calls[setVY.mock.calls.length - 1];
      expect(lastCall[0]).toBe(0);
    });
  });

  describe('addFloor / bounds', () => {
    it('recomputes bounds when floors are added', () => {
      const { elevator } = makeElevator([]);
      elevator.addFloor(0, 100);
      elevator.addFloor(1, 500);

      // At minY pressing up (outward) must clamp to 0.
      elevator.platform.y = 100;
      elevator.ride(true, false, 16.67);
      const setVY = elevator.platform.setVelocityY as unknown as ReturnType<typeof vi.fn>;
      expect(setVY.mock.calls[setVY.mock.calls.length - 1][0]).toBe(0);
      expect(elevator.getIsMoving()).toBe(false);

      // At maxY pressing down (outward) must also clamp to 0.
      elevator.platform.y = 500;
      elevator.ride(false, true, 16.67);
      expect(setVY.mock.calls[setVY.mock.calls.length - 1][0]).toBe(0);
    });
  });

  describe('currentFloor roundtrip', () => {
    it('setCurrentFloor / getCurrentFloor round-trip', () => {
      const { elevator } = makeElevator();
      expect(elevator.getCurrentFloor()).toBe(0);
      elevator.setCurrentFloor(3);
      expect(elevator.getCurrentFloor()).toBe(3);
    });
  });

  describe('getFloorAtCurrentPosition', () => {
    it('returns the floor id when platform is near a stop', () => {
      const { elevator } = makeElevator([[0, 100], [1, 500]]);
      elevator.platform.y = 105; // within the 12px tolerance of floor 0
      expect(elevator.getFloorAtCurrentPosition()).toBe(0);
      elevator.platform.y = 500;
      expect(elevator.getFloorAtCurrentPosition()).toBe(1);
    });

    it('returns null between stops', () => {
      const { elevator } = makeElevator([[0, 100], [1, 500]]);
      elevator.platform.y = 300;
      expect(elevator.getFloorAtCurrentPosition()).toBeNull();
    });
  });

  describe('moveToFloor', () => {
    it('creates a tween when moving to a valid floor', () => {
      const { scene, elevator } = makeElevator([[0, 100], [1, 500]]);
      const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
      add.mockClear();

      elevator.moveToFloor(1);
      expect(add).toHaveBeenCalledTimes(1);
      expect(elevator.getIsMoving()).toBe(true);
    });

    it('is a no-op when already snapping', () => {
      const { scene, elevator } = makeElevator([[0, 100], [1, 500]]);
      const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;

      elevator.moveToFloor(1);
      const callsAfterFirst = add.mock.calls.length;
      elevator.moveToFloor(1);
      expect(add.mock.calls.length).toBe(callsAfterFirst);
    });

    it('is a no-op for an unknown floor', () => {
      const { scene, elevator } = makeElevator([[0, 100], [1, 500]]);
      const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
      add.mockClear();

      elevator.moveToFloor(99);
      expect(add).not.toHaveBeenCalled();
    });
  });

  describe('coast-to-snap', () => {
    it('triggers snapToNearest when idle between stops with near-zero velocity', () => {
      const { scene, elevator } = makeElevator([[0, 100], [1, 500]]);
      const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
      add.mockClear();

      elevator.platform.y = 300; // between stops
      // No input, no velocity → wantDir=0, |velocity|<1 branch runs.
      elevator.ride(false, false, 16.67);

      expect(add).toHaveBeenCalledTimes(1);
      // Snapping latches — subsequent ride() calls are skipped.
      expect(elevator.getIsMoving()).toBe(true);
    });
  });
});
