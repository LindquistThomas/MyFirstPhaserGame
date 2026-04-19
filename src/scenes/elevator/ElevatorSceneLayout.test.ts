import { describe, expect, it } from 'vitest';

declare function require(name: string): { readFileSync: (path: string, encoding: string) => string };
const { readFileSync } = require('fs');

describe('ElevatorSceneLayout sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in constructor()', () => {
    const source = readFileSync('src/scenes/elevator/ElevatorSceneLayout.ts', 'utf8');
    expect(source).toContain('createSceneLifecycle(deps.scene)');
  });
});
