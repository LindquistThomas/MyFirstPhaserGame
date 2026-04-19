import { describe, expect, it } from 'vitest';

declare function require(name: string): { readFileSync: (path: string, encoding: string) => string };
const { readFileSync } = require('fs');

describe('ProductLeadershipScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in create()', () => {
    const source = readFileSync('src/features/floors/product/ProductLeadershipScene.ts', 'utf8');
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
