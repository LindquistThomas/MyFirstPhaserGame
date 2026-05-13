import type { GameAction } from './actions';

/**
 * Human-readable labels for each GameAction.
 *
 * Extracted from ControlsScene so both the rebind UI and the
 * read-only ControlsReferenceModal can share the same strings.
 */
export const ACTION_LABELS: Record<GameAction, string> = {
  MoveLeft: 'Move Left',
  MoveRight: 'Move Right',
  MoveUp: 'Move Up',
  MoveDown: 'Move Down',
  Jump: 'Jump',
  Interact: 'Interact',
  ToggleInfo: 'Toggle Info',
  NavigateUp: 'Navigate Up',
  NavigateDown: 'Navigate Down',
  NavigateLeft: 'Navigate Left',
  NavigateRight: 'Navigate Right',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Confirm: 'Confirm',
  Cancel: 'Cancel',
  QuickAnswer1: 'Quick Answer 1',
  QuickAnswer2: 'Quick Answer 2',
  QuickAnswer3: 'Quick Answer 3',
  QuickAnswer4: 'Quick Answer 4',
  ElevatorCallFloor0: 'Elevator: Floor 0',
  ElevatorCallFloor1: 'Elevator: Floor 1',
  ElevatorCallFloor2: 'Elevator: Floor 2',
  ElevatorCallFloor3: 'Elevator: Floor 3',
  ElevatorCallFloor4: 'Elevator: Floor 4',
  ElevatorCallFloor5: 'Elevator: Boardroom',
  Attack: 'Attack (Throw/Fire)',
  Pause: 'Pause',
  ShowControls: 'Show Controls',
  ToggleDebug: 'Toggle Debug',
};
