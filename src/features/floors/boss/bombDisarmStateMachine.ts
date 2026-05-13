export const BOMB_DISARM_STATES = {
  IDLE: 'idle',
  ARMING: 'arming',
  DISARMING: 'disarming',
  DISARMED: 'disarmed',
  EXPLODED: 'exploded',
} as const;

export type BombDisarmState = (typeof BOMB_DISARM_STATES)[keyof typeof BOMB_DISARM_STATES];

export const BOMB_DISARM_EVENTS = {
  ARM: 'arm',
  START_DISARM: 'start_disarm',
  SUCCEED: 'succeed',
  FAIL: 'fail',
  RESET: 'reset',
} as const;

export type BombDisarmEvent = (typeof BOMB_DISARM_EVENTS)[keyof typeof BOMB_DISARM_EVENTS];

export interface BombDisarmProgress {
  state: BombDisarmState;
  successfulDisarms: number;
  requiredDisarms: number;
}

const TRANSITIONS: Readonly<Record<BombDisarmState, Readonly<Partial<Record<BombDisarmEvent, BombDisarmState>>>>> = {
  [BOMB_DISARM_STATES.IDLE]: {
    [BOMB_DISARM_EVENTS.ARM]: BOMB_DISARM_STATES.ARMING,
  },
  [BOMB_DISARM_STATES.ARMING]: {
    [BOMB_DISARM_EVENTS.START_DISARM]: BOMB_DISARM_STATES.DISARMING,
    [BOMB_DISARM_EVENTS.FAIL]: BOMB_DISARM_STATES.EXPLODED,
  },
  [BOMB_DISARM_STATES.DISARMING]: {
    [BOMB_DISARM_EVENTS.SUCCEED]: BOMB_DISARM_STATES.DISARMED,
    [BOMB_DISARM_EVENTS.FAIL]: BOMB_DISARM_STATES.EXPLODED,
  },
  [BOMB_DISARM_STATES.DISARMED]: {
    [BOMB_DISARM_EVENTS.RESET]: BOMB_DISARM_STATES.IDLE,
  },
  [BOMB_DISARM_STATES.EXPLODED]: {
    [BOMB_DISARM_EVENTS.RESET]: BOMB_DISARM_STATES.IDLE,
  },
};

export function transitionBombDisarmState(state: BombDisarmState, event: BombDisarmEvent): BombDisarmState {
  const next = TRANSITIONS[state][event];
  if (!next) {
    throw new Error(`Invalid bomb-disarm transition: ${state} -> ${event}`);
  }
  return next;
}

export function createBombDisarmProgress(requiredDisarms: number): BombDisarmProgress {
  if (!Number.isFinite(requiredDisarms) || requiredDisarms < 1) {
    throw new Error('requiredDisarms must be >= 1');
  }
  return {
    state: BOMB_DISARM_STATES.IDLE,
    successfulDisarms: 0,
    requiredDisarms: Math.floor(requiredDisarms),
  };
}

export function applyBombDisarmEvent(progress: BombDisarmProgress, event: BombDisarmEvent): BombDisarmProgress {
  const nextState = transitionBombDisarmState(progress.state, event);
  const successfulDisarms = nextState === BOMB_DISARM_STATES.DISARMED
    ? progress.successfulDisarms + 1
    : progress.successfulDisarms;
  return {
    ...progress,
    state: nextState,
    successfulDisarms,
  };
}

export function isBombDisarmWin(progress: BombDisarmProgress): boolean {
  return progress.state === BOMB_DISARM_STATES.DISARMED
    && progress.successfulDisarms >= progress.requiredDisarms;
}

export function isBombDisarmLoss(progress: BombDisarmProgress): boolean {
  return progress.state === BOMB_DISARM_STATES.EXPLODED;
}
