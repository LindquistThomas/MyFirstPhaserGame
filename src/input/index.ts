/**
 * Single import surface for the input module. Scene/UI code should
 * only ever import from here — never from individual files inside
 * `src/input/`.
 */
export type { GameAction, InputContext } from './actions';
export { ACTION_CONTEXTS, ALL_ACTIONS } from './actions';
export { DEFAULT_BINDINGS, buildEffectiveBindings, buildKeyToActions } from './bindings';
export {
  InputService,
  activeContext, pushContext, popContext,
  setVirtualButton,
  type ContextToken,
} from './InputService';
export { keyLabel, primaryKeyLabel, allKeyLabels } from './keyLabels';
export {
  detectInputMode,
  initInputModeTracking,
  promptLabel,
  type InputMode,
} from './promptLabel';
export { bindPointerAction } from './pointerBindings';
