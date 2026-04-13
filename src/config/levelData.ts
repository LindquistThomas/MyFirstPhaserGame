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
    sceneKey: 'HubScene',
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
    sceneKey: 'Floor1Scene',
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
  [FLOORS.CLOUD_TEAM]: {
    id: FLOORS.CLOUD_TEAM,
    name: 'Cloud Team',
    description: 'Cloud architecture & services. Gather Cloud AU!',
    sceneKey: 'Floor2Scene',
    auRequired: 5,
    auLabel: 'Cloud AU',
    totalAU: 10,
    theme: {
      platformColor: 0x023e8a,
      backgroundColor: 0x03045e,
      wallColor: 0x0077b6,
      tokenColor: 0x90e0ef,
    },
  },
};
