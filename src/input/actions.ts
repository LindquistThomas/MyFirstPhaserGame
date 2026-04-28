/**
 * Named actions the game responds to. No code outside `src/input/`
 * should ever reference a physical key code — always use an action.
 *
 * Actions are grouped by the context(s) in which they are meaningful.
 * The context system (see InputService) ensures that e.g. `Interact`
 * does not fire while a modal is open.
 */
export type GameAction =
  // Movement axes
  | 'MoveLeft'
  | 'MoveRight'
  | 'MoveUp'
  | 'MoveDown'
  // Gameplay verbs
  | 'Jump'
  | 'Interact'
  | 'ToggleInfo'
  // Menu / dialog navigation
  | 'NavigateUp'
  | 'NavigateDown'
  | 'NavigateLeft'
  | 'NavigateRight'
  | 'PageUp'
  | 'PageDown'
  // Generic UI verbs (shared between menu and modal contexts)
  | 'Confirm'
  | 'Cancel'
  // Quiz shortcuts (answer directly by number or letter)
  | 'QuickAnswer1'
  | 'QuickAnswer2'
  | 'QuickAnswer3'
  | 'QuickAnswer4'
  // Elevator floor call buttons (digit keys map to visual floor order F0..F5)
  | 'ElevatorCallFloor0'
  | 'ElevatorCallFloor1'
  | 'ElevatorCallFloor2'
  | 'ElevatorCallFloor3'
  | 'ElevatorCallFloor4'
  | 'ElevatorCallFloor5'
  // Gameplay attack — throw/fire what the player is holding
  | 'Attack'
  // Pause / resume
  | 'Pause'
  // Debug
  | 'ToggleDebug';

/** The input context a consumer is operating in. */
export type InputContext = 'gameplay' | 'menu' | 'modal';

/** Special marker: an action that fires regardless of active context. */
export const ALWAYS = 'always' as const;
export type ActionContextTag = InputContext | typeof ALWAYS;

/**
 * Which contexts each action is valid in. An action dispatches only
 * when the active (topmost) context is in this list — or when the
 * action is tagged `ALWAYS`.
 */
export const ACTION_CONTEXTS: Record<GameAction, readonly ActionContextTag[]> = {
  MoveLeft: ['gameplay'],
  MoveRight: ['gameplay'],
  MoveUp: ['gameplay'],
  MoveDown: ['gameplay'],
  Jump: ['gameplay'],
  Interact: ['gameplay'],
  ToggleInfo: ['gameplay'],

  NavigateUp: ['menu', 'modal'],
  NavigateDown: ['menu', 'modal'],
  NavigateLeft: ['modal'],
  NavigateRight: ['modal'],
  PageUp: ['modal'],
  PageDown: ['modal'],

  Confirm: ['menu', 'modal'],
  Cancel: ['menu', 'modal'],

  QuickAnswer1: ['modal'],
  QuickAnswer2: ['modal'],
  QuickAnswer3: ['modal'],
  QuickAnswer4: ['modal'],

  ElevatorCallFloor0: ['gameplay'],
  ElevatorCallFloor1: ['gameplay'],
  ElevatorCallFloor2: ['gameplay'],
  ElevatorCallFloor3: ['gameplay'],
  ElevatorCallFloor4: ['gameplay'],
  ElevatorCallFloor5: ['gameplay'],

  Attack: ['gameplay'],

  Pause: ['gameplay'],

  ToggleDebug: [ALWAYS],
};

/** All defined actions, in declaration order. Handy for loops. */
export const ALL_ACTIONS: readonly GameAction[] = Object.keys(ACTION_CONTEXTS) as GameAction[];
