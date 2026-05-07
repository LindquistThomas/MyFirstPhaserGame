# Tween lifecycle guidance

- If a tween created with `scene.tweens.add(...)` is stored on a class field, it must be cleaned up on shutdown/destroy.
- Required pattern: call `tween?.stop()` and clear the field reference (`tween = undefined` / `null`).
- Prefer wiring cleanup through `createSceneLifecycle(scene).add(...)` or `scene.events.once('shutdown', ...)`.
