import { describe, expect, it } from 'vitest';

import source from './ProductLeadershipScene.ts?raw';

describe('ProductLeadershipScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in create()', () => {
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
