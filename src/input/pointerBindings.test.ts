import { describe, it, expect, vi } from 'vitest';
import { GameAction } from './actions';
import type { InputService } from './InputService';
import { bindPointerAction } from './pointerBindings';

describe('bindPointerAction', () => {
  it('marks object interactive with a hand cursor, emits action on pointerdown, and returns the object', () => {
    const handlers = new Map<string, () => void>();
    const obj = {
      setInteractive: vi.fn(() => obj),
      on: vi.fn((event: string, handler: () => void) => {
        handlers.set(event, handler);
        return obj;
      }),
    };
    const inputs = { emit: vi.fn() } as unknown as InputService;

    const result = bindPointerAction(obj, GameAction.Confirm, inputs);
    handlers.get('pointerdown')?.();

    expect(result).toBe(obj);
    expect(obj.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
    expect(obj.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(inputs.emit).toHaveBeenCalledWith(GameAction.Confirm);
  });
});
