import { describe, expect, it } from 'vitest';
import {
  applyBombDisarmEvent,
  BOMB_DISARM_EVENTS,
  BOMB_DISARM_STATES,
  createBombDisarmProgress,
  isBombDisarmLoss,
  isBombDisarmWin,
  transitionBombDisarmState,
} from './bombDisarmStateMachine';

describe('bombDisarmStateMachine', () => {
  it('supports the happy path idle -> arming -> disarming -> disarmed -> idle', () => {
    let progress = createBombDisarmProgress(1);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.ARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.START_DISARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.SUCCEED);
    expect(progress.state).toBe(BOMB_DISARM_STATES.DISARMED);
    expect(isBombDisarmWin(progress)).toBe(true);

    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.RESET);
    expect(progress.state).toBe(BOMB_DISARM_STATES.IDLE);
  });

  it('supports failure path idle -> arming -> disarming -> exploded -> idle', () => {
    let progress = createBombDisarmProgress(1);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.ARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.START_DISARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.FAIL);
    expect(progress.state).toBe(BOMB_DISARM_STATES.EXPLODED);
    expect(isBombDisarmLoss(progress)).toBe(true);

    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.RESET);
    expect(progress.state).toBe(BOMB_DISARM_STATES.IDLE);
  });

  it('throws on invalid transitions', () => {
    expect(() => transitionBombDisarmState(BOMB_DISARM_STATES.IDLE, BOMB_DISARM_EVENTS.SUCCEED))
      .toThrow('Invalid bomb-disarm transition');
    expect(() => transitionBombDisarmState(BOMB_DISARM_STATES.DISARMED, BOMB_DISARM_EVENTS.SUCCEED))
      .toThrow('Invalid bomb-disarm transition');
  });

  it('win predicate only fires after required disarm count', () => {
    let progress = createBombDisarmProgress(2);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.ARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.START_DISARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.SUCCEED);
    expect(isBombDisarmWin(progress)).toBe(false);

    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.RESET);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.ARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.START_DISARM);
    progress = applyBombDisarmEvent(progress, BOMB_DISARM_EVENTS.SUCCEED);
    expect(isBombDisarmWin(progress)).toBe(true);
  });
});
