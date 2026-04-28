# EventBus Listener Audit

Audit of direct `eventBus.on/once`, `window.addEventListener`, and
`document.addEventListener` call sites inside scene files
(`src/scenes/**/*Scene.ts`, `src/features/**/*Scene.ts`).

Performed against commit history as of the branch
`copilot/audit-raw-eventbus-calls`.

---

## Raw `eventBus.on` / `eventBus.once` in scene files

**Result: none found.**

All scene-local EventBus subscriptions already go through one of:

- `this.scopedEvents.on(...)` — `ScopedEventBus` plugin, auto-cleaned on shutdown.
- One lifecycle token per scene, then reused for all subscriptions:
  ```ts
  const lc = createSceneLifecycle(this);
  lc.bindEventBus('zone:enter', handler);
  ```
  `sceneLifecycle` helper, auto-cleaned on shutdown.

An ESLint `no-restricted-syntax` rule has been added to `eslint.config.js` to
enforce this going forward (see **Prevention** section below).

---

## `window.addEventListener` / `document.addEventListener` in scene files

| File | Line | Event | Listener | Removal registered? | Verdict |
|------|------|-------|----------|----------------------|---------|
| `src/features/floors/_shared/LevelScene.ts` | 372 | `visibilitychange` | `onVisibilityChange` | `lc.add(() => document.removeEventListener(...))` on line 373 | ✅ clean |
| `src/features/floors/executive/ExecutiveSuiteScene.ts` | 146 | `keydown` | `onEnter` | Removed on first `Enter` keypress (line 142) **and** via `this.events.once(SHUTDOWN, ...)` on line 149 | ✅ clean |
| `src/scenes/core/BootScene.ts` | 116 | `keydown` | `onMuteHotkey` | Removed in `this.events.once('destroy', ...)` on line 117 — intentionally global: persists across scene transitions and is only removed on full game teardown | ✅ intentional |
| `src/scenes/core/ControlsScene.ts` | 372 | `keydown` | `this.captureListener` | `lifecycle.add(() => this.stopCapture())` in `setupNavigation()` (line 294) calls `stopCapture()` which removes the listener | ✅ clean |

### Notes on BootScene

`BootScene` registers the `M`-key mute hotkey on `window` as a **global**
listener intentionally scoped to the Phaser game lifetime, not the scene
lifetime.  `this.scene.start('MenuScene')` fires `shutdown` on BootScene
immediately, so the listener must **not** be removed on `shutdown`.  The
`_muteHotkeyInstalled` guard prevents double-registration if `create()` is
ever entered a second time.  This pattern is documented in the inline comment
at `BootScene.ts:103-105`.

---

## Prevention

`eslint.config.js` now contains a `no-restricted-syntax` block scoped to
`**/*Scene.ts` that produces an **error** for any call matching:

```
eventBus.on(...)
eventBus.once(...)
```

The error message directs developers to `this.scopedEvents.on/once()` or
`createSceneLifecycle(this).bindEventBus()`.

The rule does **not** cover non-scene helpers (e.g. `LevelDialogBindings`,
`sceneLifecycle`) because those are not Phaser scene classes and often receive
a lifecycle token from the owning scene already.

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Raw `eventBus.on/once` in `*Scene.ts` | 0 | ✅ none |
| `window/document.addEventListener` missing removal | 0 | ✅ all paired |
| ESLint regression guard added | 1 rule | ✅ |
