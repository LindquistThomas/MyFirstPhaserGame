import { describe, expect, it } from 'vitest';

declare function require(name: string): { readFileSync: (path: string, encoding: string) => string };
const { readFileSync } = require('fs');

describe('ElevatorScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in init()', () => {
    const source = readFileSync('src/scenes/elevator/ElevatorScene.ts', 'utf8');
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
