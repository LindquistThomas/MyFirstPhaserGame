import { FLOORS, FloorId } from './gameConfig';

export interface FloorData {
  id: FloorId;
  /**
   * Sequential floor number used for display (0 = ground/lobby, increasing
   * upward). Decoupled from `id` so IDs can be allocated freely without
   * creating gaps in the displayed label sequence (e.g. "F2", "F3", …).
   */
  floorNumber: number;
  name: string;
  description: string;
  sceneKey: string;
  /** Number of AU required to unlock this floor */
  auRequired: number;
  /** Display name for the AU earned on this floor */
  auLabel: string;
  totalAU: number;
  /**
   * Optional split when a single floor hosts two distinct rooms on the left
   * and right sides of the elevator shaft (e.g. Platform + Architecture).
   * When present, UI that labels the floor should render both names; when
   * absent, `name` applies to the whole floor.
   */
  rooms?: { left: string; right: string };
  theme: {
    platformColor: number;
    backgroundColor: number;
    wallColor: number;
    tokenColor: number;
  };
}

export const LEVEL_DATA: Record<FloorId, FloorData> = {
  [FLOORS.LOBBY]: {
    id: FLOORS.LOBBY,
    floorNumber: 0,
    name: 'Lobby',
    description: 'The ground floor. Your journey begins here.',
    sceneKey: 'ElevatorScene',
    auRequired: 0,
    auLabel: 'Welcome AU',
    totalAU: 0,
    theme: {
      platformColor: 0x444466,
      backgroundColor: 0x1a1a2e,
      wallColor: 0x333355,
      tokenColor: 0xffd700,
    },
  },
  [FLOORS.PLATFORM_TEAM]: {
    id: FLOORS.PLATFORM_TEAM,
    floorNumber: 1,
    name: 'Platform Team',
    description: 'Infrastructure & platform engineering. Collect AU!',
    sceneKey: 'PlatformTeamScene',
    auRequired: 0,
    auLabel: 'Infrastructure AU',
    totalAU: 15,
    rooms: { left: 'Platform Team', right: 'Architecture Team' },
    theme: {
      platformColor: 0x2d6a4f,
      backgroundColor: 0x1b4332,
      wallColor: 0x40916c,
      tokenColor: 0x95d5b2,
    },
  },
  [FLOORS.BUSINESS]: {
    id: FLOORS.BUSINESS,
    floorNumber: 3,
    name: 'Business',
    description: 'Product Leadership on the left, Customer Success on the right.',
    sceneKey: 'ProductLeadershipScene',
    auRequired: 10,
    auLabel: 'Business AU',
    totalAU: 10,
    rooms: { left: 'Product Leadership', right: 'Customer Success' },
    theme: {
      platformColor: 0x6b4a1e,
      backgroundColor: 0x1a1408,
      wallColor: 0x8b6a2e,
      tokenColor: 0xffd980,
    },
  },
  [FLOORS.EXECUTIVE]: {
    id: FLOORS.EXECUTIVE,
    floorNumber: 4,
    name: 'Executive Suite',
    description: 'The penthouse. Strategy, vision, and the C-suite.',
    sceneKey: 'ExecutiveSuiteScene',
    auRequired: 15,
    auLabel: 'Strategy AU',
    totalAU: 6,
    theme: {
      platformColor: 0x4a3a1a,
      backgroundColor: 0x1a1208,
      wallColor: 0x6b5320,
      tokenColor: 0xffd700,
    },
  },
  [FLOORS.PRODUCTS]: {
    id: FLOORS.PRODUCTS,
    floorNumber: 2,
    name: 'Products',
    description: 'The PRODUCTS floor of the elevator shaft — one door per ISY product.',
    // Rendered by ElevatorScene/ProductDoorManager directly, not a standalone
    // scene. Kept as a symbolic label so levelData stays complete and the
    // floor sceneKey uniqueness test still holds.
    sceneKey: 'ProductsFloor',
    auRequired: 8,
    auLabel: 'Product AU',
    totalAU: 0,
    theme: {
      platformColor: 0x3a3a55,
      backgroundColor: 0x101a2a,
      wallColor: 0x445577,
      tokenColor: 0xffd700,
    },
  },
  [FLOORS.BOSS]: {
    id: FLOORS.BOSS,
    floorNumber: 5,
    name: 'Boardroom',
    description: 'The CEO awaits. Prove your architectural worth.',
    sceneKey: 'BossArenaScene',
    auRequired: 25,
    auLabel: 'Boss AU',
    totalAU: 0,
    theme: {
      platformColor: 0x2a1a0a,
      backgroundColor: 0x0a0a0a,
      wallColor: 0x3a2a1a,
      tokenColor: 0xffd700,
    },
  },
};
