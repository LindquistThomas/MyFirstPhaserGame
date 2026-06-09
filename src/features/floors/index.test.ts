import { beforeAll, describe, expect, it, vi } from 'vitest';

const mockedExports = {
  PlatformTeamScene: class PlatformTeamScene {},
  ArchitectureTeamScene: class ArchitectureTeamScene {},
  FinanceTeamScene: class FinanceTeamScene {},
  ProductLeadershipScene: class ProductLeadershipScene {},
  CustomerSuccessScene: class CustomerSuccessScene {},
  ExecutiveSuiteScene: class ExecutiveSuiteScene {},
};

vi.mock('./platform/PlatformTeamScene', () => ({ PlatformTeamScene: mockedExports.PlatformTeamScene }));
vi.mock('./architecture/ArchitectureTeamScene', () => ({ ArchitectureTeamScene: mockedExports.ArchitectureTeamScene }));
vi.mock('./finance/FinanceTeamScene', () => ({ FinanceTeamScene: mockedExports.FinanceTeamScene }));
vi.mock('./product/ProductLeadershipScene', () => ({ ProductLeadershipScene: mockedExports.ProductLeadershipScene }));
vi.mock('./customer/CustomerSuccessScene', () => ({ CustomerSuccessScene: mockedExports.CustomerSuccessScene }));
vi.mock('./executive/ExecutiveSuiteScene', () => ({ ExecutiveSuiteScene: mockedExports.ExecutiveSuiteScene }));

let barrel: typeof import('./index');

beforeAll(async () => {
  barrel = await import('./index');
});

describe('features/floors barrel exports', () => {
  it('re-exports each floor scene constructor', () => {
    expect(barrel.PlatformTeamScene).toBe(mockedExports.PlatformTeamScene);
    expect(barrel.ArchitectureTeamScene).toBe(mockedExports.ArchitectureTeamScene);
    expect(barrel.FinanceTeamScene).toBe(mockedExports.FinanceTeamScene);
    expect(barrel.ProductLeadershipScene).toBe(mockedExports.ProductLeadershipScene);
    expect(barrel.CustomerSuccessScene).toBe(mockedExports.CustomerSuccessScene);
    expect(barrel.ExecutiveSuiteScene).toBe(mockedExports.ExecutiveSuiteScene);
  });
});
