import { describe, expect, it } from 'vitest';
import { makeGraphicsMock, makeSceneMock, makeTextMock } from './testUtils';

describe('hud testUtils', () => {
  it('makeTextMock updates tracked text and y via setters', () => {
    const text = makeTextMock('hello') as unknown as {
      setText: (value: string) => unknown;
      setY: (value: number) => unknown;
      text: string;
      y: number;
    };
    text.setText('world');
    text.setY(42);
    expect(text.text).toBe('world');
    expect(text.y).toBe(42);
  });

  it('makeGraphicsMock exposes chainable drawing methods', () => {
    const graphics = makeGraphicsMock() as unknown as {
      fillRect: (x: number, y: number, w: number, h: number) => unknown;
      setAlpha: (value: number) => unknown;
    };
    expect(graphics.fillRect(0, 0, 10, 10)).toBe(graphics);
    expect(graphics.setAlpha(0.5)).toBe(graphics);
  });

  it('makeSceneMock returns muted audio only for audio registry key', () => {
    const scene = makeSceneMock(true);
    expect(scene.registry.get('other')).toBeUndefined();
    expect(scene.registry.get('audio')?.isMuted()).toBe(true);
  });
});
