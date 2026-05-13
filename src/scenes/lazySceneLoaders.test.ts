import { describe, expect, it, vi } from 'vitest';

function sceneClass(name: string) {
  return class {
    static sceneName = name;
  };
}

vi.mock('../features/floors/platform/PlatformTeamScene', () => ({ PlatformTeamScene: sceneClass('PlatformTeamScene') }));
vi.mock('../features/floors/architecture/ArchitectureTeamScene', () => ({ ArchitectureTeamScene: sceneClass('ArchitectureTeamScene') }));
vi.mock('../features/floors/finance/FinanceTeamScene', () => ({ FinanceTeamScene: sceneClass('FinanceTeamScene') }));
vi.mock('../features/floors/product/ProductLeadershipScene', () => ({ ProductLeadershipScene: sceneClass('ProductLeadershipScene') }));
vi.mock('../features/floors/customer/CustomerSuccessScene', () => ({ CustomerSuccessScene: sceneClass('CustomerSuccessScene') }));
vi.mock('../features/floors/executive/ExecutiveSuiteScene', () => ({ ExecutiveSuiteScene: sceneClass('ExecutiveSuiteScene') }));
vi.mock('../features/products/rooms/ProductIsyProjectControlsScene', () => ({ ProductIsyProjectControlsScene: sceneClass('ProductIsyProjectControlsScene') }));
vi.mock('../features/products/rooms/ProductIsyBeskrivelseScene', () => ({ ProductIsyBeskrivelseScene: sceneClass('ProductIsyBeskrivelseScene') }));
vi.mock('../features/products/rooms/ProductIsyRoadScene', () => ({ ProductIsyRoadScene: sceneClass('ProductIsyRoadScene') }));
vi.mock('../features/products/rooms/ProductAdminLisensScene', () => ({ ProductAdminLisensScene: sceneClass('ProductAdminLisensScene') }));
vi.mock('../features/floors/boss/BossArenaScene', () => ({ BossArenaScene: sceneClass('BossArenaScene') }));

import { LAZY_SCENE_LOADERS } from './lazySceneLoaders';

describe('LAZY_SCENE_LOADERS', () => {
  it('contains expected lazy keys', () => {
    expect(LAZY_SCENE_LOADERS.has('PlatformTeamScene')).toBe(true);
    expect(LAZY_SCENE_LOADERS.has('BossArenaScene')).toBe(true);
  });

  it('resolves every loader to a scene constructor', async () => {
    for (const [key, loader] of LAZY_SCENE_LOADERS.entries()) {
      const SceneClass = await loader();
      expect(typeof SceneClass).toBe('function');
      expect((SceneClass as { sceneName?: string }).sceneName).toBe(key);
    }
  });
});
