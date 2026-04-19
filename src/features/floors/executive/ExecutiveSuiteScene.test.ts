import { describe, expect, it } from 'vitest';

import source from './ExecutiveSuiteScene.ts?raw';

describe('ExecutiveSuiteScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in create()', () => {
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
