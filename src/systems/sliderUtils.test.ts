import { describe, it, expect } from 'vitest';
import { clampSlider } from './sliderUtils';

describe('clampSlider', () => {
  it('returns value unchanged when within [0, 100]', () => {
    expect(clampSlider(50)).toBe(50);
    expect(clampSlider(0)).toBe(0);
    expect(clampSlider(100)).toBe(100);
  });

  it('clamps negative values to 0 (underflow)', () => {
    expect(clampSlider(-1)).toBe(0);
    expect(clampSlider(-100)).toBe(0);
  });

  it('clamps values above 100 to 100 (overflow)', () => {
    expect(clampSlider(101)).toBe(100);
    expect(clampSlider(200)).toBe(100);
  });

  it('clamps step increments that cross the floor', () => {
    // Simulates adjust(-1) with step=5 when current value is 2
    expect(clampSlider(2 + -1 * 5)).toBe(0);
  });

  it('clamps step increments that cross the ceiling', () => {
    // Simulates adjust(+1) with step=5 when current value is 98
    expect(clampSlider(98 + 1 * 5)).toBe(100);
  });

  it('respects custom min/max bounds', () => {
    expect(clampSlider(-5, 0, 50)).toBe(0);
    expect(clampSlider(60, 0, 50)).toBe(50);
    expect(clampSlider(25, 0, 50)).toBe(25);
  });
});
