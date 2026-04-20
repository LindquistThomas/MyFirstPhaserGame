import { describe, it, expect, vi } from 'vitest';
import { drawFloorPattern, _patternFns, type PatternTheme, type FloorPatternId } from './floorPatterns';

function makeStubGraphics() {
  return {
    lineStyle: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    fillEllipse: vi.fn(),
    fillCircle: vi.fn(),
    lineBetween: vi.fn(),
  };
}

const theme: PatternTheme = {
  backgroundColor: 0x112233,
  wallColor: 0x445566,
  platformColor: 0x778899,
};

describe('drawFloorPattern', () => {
  const allIds: FloorPatternId[] = ['grid', 'blueprint', 'wood', 'terrazzo', 'dots'];

  it.each(allIds)('draws without throwing for %s', (id) => {
    const g = makeStubGraphics();
     
    drawFloorPattern(id, g as any, 640, 360, theme, 42);
    // At least one drawing call must happen for every pattern.
    const total =
      g.fillRect.mock.calls.length +
      g.fillEllipse.mock.calls.length +
      g.fillCircle.mock.calls.length +
      g.lineBetween.mock.calls.length;
    expect(total).toBeGreaterThan(0);
  });

  it('is deterministic per seed for stochastic patterns', () => {
    for (const id of ['wood', 'terrazzo'] as FloorPatternId[]) {
      const a = makeStubGraphics();
      const b = makeStubGraphics();
       
      drawFloorPattern(id, a as any, 640, 360, theme, 7);
       
      drawFloorPattern(id, b as any, 640, 360, theme, 7);
      expect(a.fillRect.mock.calls).toEqual(b.fillRect.mock.calls);
      expect(a.fillEllipse.mock.calls).toEqual(b.fillEllipse.mock.calls);
    }
  });

  it('produces different output across different seeds', () => {
    const a = makeStubGraphics();
    const b = makeStubGraphics();
     
    drawFloorPattern('terrazzo', a as any, 640, 360, theme, 1);
     
    drawFloorPattern('terrazzo', b as any, 640, 360, theme, 2);
    expect(a.fillRect.mock.calls).not.toEqual(b.fillRect.mock.calls);
  });

  it('exposes every declared pattern id', () => {
    for (const id of allIds) {
      expect(_patternFns[id]).toBeTypeOf('function');
    }
  });
});
