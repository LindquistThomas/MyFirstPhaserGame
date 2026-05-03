import { describe, it, expect, vi } from 'vitest';
import { startSceneWithContext } from './NavigationContext';

describe('startSceneWithContext', () => {
  it('calls scene.scene.start with the given key and context', () => {
    const mockStart = vi.fn();
    const scene = { scene: { start: mockStart } };

    startSceneWithContext(scene as unknown as Phaser.Scene, 'MenuScene', { loadSave: true });

    expect(mockStart).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledWith('MenuScene', { loadSave: true });
  });

  it('passes an empty object when no context is given', () => {
    const mockStart = vi.fn();
    const scene = { scene: { start: mockStart } };

    startSceneWithContext(scene as unknown as Phaser.Scene, 'ElevatorScene');

    expect(mockStart).toHaveBeenCalledWith('ElevatorScene', {});
  });

  it('forwards fromFloor in the context', () => {
    const mockStart = vi.fn();
    const scene = { scene: { start: mockStart } };

    startSceneWithContext(scene as unknown as Phaser.Scene, 'ElevatorScene', { fromFloor: 1 });

    expect(mockStart).toHaveBeenCalledWith('ElevatorScene', { fromFloor: 1 });
  });

  it('forwards spawnSide in the context', () => {
    const mockStart = vi.fn();
    const scene = { scene: { start: mockStart } };

    startSceneWithContext(scene as unknown as Phaser.Scene, 'ElevatorScene', { spawnSide: 'right' });

    expect(mockStart).toHaveBeenCalledWith('ElevatorScene', { spawnSide: 'right' });
  });

  it('forwards spawnDoorId in the context', () => {
    const mockStart = vi.fn();
    const scene = { scene: { start: mockStart } };

    startSceneWithContext(scene as unknown as Phaser.Scene, 'ProductRoomScene', {
      spawnDoorId: 'product-door-1',
    });

    expect(mockStart).toHaveBeenCalledWith('ProductRoomScene', { spawnDoorId: 'product-door-1' });
  });

  it('accepts a partial context with only some fields set', () => {
    const mockStart = vi.fn();
    const scene = { scene: { start: mockStart } };

    startSceneWithContext(scene as unknown as Phaser.Scene, 'ElevatorScene', {
      fromFloor: 1,
      spawnSide: 'left',
    });

    const calledWith = mockStart.mock.calls[0];
    expect(calledWith?.[0]).toBe('ElevatorScene');
    expect(calledWith?.[1]).toMatchObject({ fromFloor: 1, spawnSide: 'left' });
  });
});
