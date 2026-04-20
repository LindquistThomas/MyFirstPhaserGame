import { describe, it, expect } from 'vitest';
import { scaleChannels, _internals } from './sceneBackdrop';

const { lerpColor } = _internals;

describe('scaleChannels', () => {
  it('is identity when factor is 1', () => {
    expect(scaleChannels(0x123456, 1)).toBe(0x123456);
    expect(scaleChannels(0xffffff, 1)).toBe(0xffffff);
    expect(scaleChannels(0x000000, 1)).toBe(0x000000);
  });

  it('darkens every channel when factor < 1', () => {
    const out = scaleChannels(0x808080, 0.5);
    expect((out >> 16) & 0xff).toBe(64);
    expect((out >> 8) & 0xff).toBe(64);
    expect(out & 0xff).toBe(64);
  });

  it('clamps channels at 255 when lightening past white', () => {
    const out = scaleChannels(0xc0c0c0, 3);
    expect((out >> 16) & 0xff).toBe(255);
    expect((out >> 8) & 0xff).toBe(255);
    expect(out & 0xff).toBe(255);
  });

  it('clamps at 0 when scaling by 0', () => {
    expect(scaleChannels(0xffffff, 0)).toBe(0);
  });
});

describe('lerpColor', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerpColor(0x112233, 0xffeedd, 0)).toBe(0x112233);
    expect(lerpColor(0x112233, 0xffeedd, 1)).toBe(0xffeedd);
  });

  it('interpolates each channel independently at t=0.5', () => {
    const out = lerpColor(0x000000, 0xffffff, 0.5);
    // 127 or 128 both acceptable given rounding; assert within 1.
    const r = (out >> 16) & 0xff;
    expect(Math.abs(r - 128)).toBeLessThanOrEqual(1);
  });
});
