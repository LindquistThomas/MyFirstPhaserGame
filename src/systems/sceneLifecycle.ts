import * as Phaser from 'phaser';
import { eventBus, type GameEventHandler, type GameEventName } from './EventBus';
import type { GameAction } from '../input';

/**
 * Track teardown callbacks tied to a Phaser scene's lifecycle.
 *
 * Every scene that subscribes to the shared {@link eventBus}, binds input
 * actions, or pushes an input context used to repeat the same pattern:
 *
 *   eventBus.on('zone:enter', onEnter);
 *   scene.events.once('shutdown', () => eventBus.off('zone:enter', onEnter));
 *
 * Multiply that by a handful of listeners per scene and it becomes easy to
 * forget one. {@link createSceneLifecycle} returns a small registry that
 * flushes all registered disposers on the scene's `shutdown` (and `destroy`)
 * events, plus convenience binders that register + arrange cleanup in a
 * single call.
 *
 * Disposers run in LIFO order and each is invoked at most once, so calling
 * {@link SceneLifecycle.dispose} manually (e.g. when a collaborator tears
 * itself down early) is safe.
 */
export interface SceneLifecycle {
  /** Register a teardown callback. Runs LIFO on scene shutdown. */
  add(dispose: () => void): void;

  /** Subscribe to an eventBus event; the listener is removed on shutdown. */
  bindEventBus<K extends GameEventName>(event: K, handler: GameEventHandler<K>): void;

  /** Subscribe to a scene input action; the listener is removed on shutdown. */
  bindInput(action: GameAction, handler: () => void): void;

  /** Run all disposers now. Safe to call multiple times. */
  dispose(): void;
}

export function createSceneLifecycle(scene: Phaser.Scene): SceneLifecycle {
  const disposers: Array<() => void> = [];
  let flushed = false;

  const dispose = (): void => {
    if (flushed) return;
    flushed = true;
    while (disposers.length > 0) {
      const d = disposers.pop();
      try { d?.(); } catch { /* swallow — shutdown must not throw */ }
    }
  };

  scene.events.once('shutdown', dispose);
  scene.events.once('destroy', dispose);

  return {
    add(disposeFn) {
      if (flushed) {
        disposeFn();
        return;
      }
      disposers.push(disposeFn);
    },
    bindEventBus(event, handler) {
      eventBus.on(event, handler);
      this.add(() => eventBus.off(event, handler));
    },
    bindInput(action, handler) {
      scene.inputs.on(action, handler);
      this.add(() => scene.inputs.off(action, handler));
    },
    dispose,
  };
}
