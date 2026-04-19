import { FLOORS, FloorId } from './gameConfig';

export interface FloorData {
  id: FloorId;
  name: string;
  description: string;
  sceneKey: string;
  /** Number of AU required to unlock this floor */
  auRequired: number;
  /** Display name for the AU earned on this floor */
  auLabel: string;
  totalAU: number;
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
    name: 'Platform Team',
    description: 'Infrastructure & platform engineering. Collect AU!',
    sceneKey: 'PlatformTeamScene',
    auRequired: 0,
    auLabel: 'Infrastructure AU',
    totalAU: 8,
    theme: {
      platformColor: 0x2d6a4f,
      backgroundColor: 0x1b4332,
      wallColor: 0x40916c,
      tokenColor: 0x95d5b2,
    },
  },
  [FLOORS.BUSINESS]: {
    id: FLOORS.BUSINESS,
    name: 'Business',
    description: 'Product Leadership on the left, Customer Success on the right.',
    sceneKey: 'ProductLeadershipScene',
    auRequired: 10,
    auLabel: 'Business AU',
    totalAU: 10,
    theme: {
      platformColor: 0x6b4a1e,
      backgroundColor: 0x1a1408,
      wallColor: 0x8b6a2e,
      tokenColor: 0xffd980,
    },
  },
  [FLOORS.EXECUTIVE]: {
    id: FLOORS.EXECUTIVE,
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
    name: 'Products',
    description: 'A long hall with a door for every ISY product.',
    sceneKey: 'ProductsHallScene',
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
};
