# Copilot Instructions for MyFirstPhaserGame

## Project Overview

This is a Phaser-based browser game built entirely through vibe coding (AI-assisted development). The project uses the Node.js ecosystem with Vite as the bundler.

## Repository Structure

```
MyFirstPhaserGame/
├── .github/
│   ├── copilot-instructions.md   # This file — AI coding guidance
│   └── skills/                   # Prompt-based skills for common tasks
├── .gitignore                    # Node.js / Vite ignores
├── LICENSE                       # MIT
├── README.md                     # Project description
└── CONTRIBUTING.md               # Contributor guide
```

As the game grows, the expected source layout (following standard Phaser + Vite conventions) is:

```
src/
├── main.js          # Phaser game config and entry point
├── scenes/          # One file per Phaser scene
│   ├── Boot.js
│   ├── Preloader.js
│   ├── MainMenu.js
│   └── Game.js
└── objects/         # Reusable game objects and sprites
public/
└── assets/          # Images, audio, tilemaps, spritesheets
index.html           # HTML shell that loads the Vite bundle
package.json         # Dependencies and scripts
vite.config.js       # Vite configuration
```

## Key Conventions

### Language & Style
- Use **JavaScript** (ES modules, `import`/`export`).
- Follow the naming conventions implied by the Node.js `.gitignore` already in the repo.
- File names use **PascalCase** for scenes and game objects (e.g., `MainMenu.js`, `Player.js`).
- Config and tooling files use **lowercase** (e.g., `vite.config.js`, `package.json`).

### Phaser Patterns
- Each scene is a class extending `Phaser.Scene`.
- Scenes implement `preload()`, `create()`, and `update()` lifecycle methods as needed.
- Scene keys are registered as strings in the Phaser game config and must match the key passed to `super()` in the scene constructor.
- Assets are loaded in a dedicated `Preloader` scene, not scattered across scenes.

### Bundling & Dev Server
- **Vite** is the bundler (indicated by Vite-specific entries in `.gitignore`).
- Use `npm run dev` for local development and `npm run build` for production builds.
- Static assets live in `public/assets/` so Vite serves them as-is.

## How to Extend This Project

1. **Add a new scene** — Use the `new-scene` skill in `.github/skills/`.
2. **Add a game object** — Use the `add-game-object` skill in `.github/skills/`.
3. **Add an asset** — Place it in `public/assets/` and load it in the `Preloader` scene.
4. **Add a dependency** — Run `npm install <package>` and import it where needed.

### Persistence / Save System

Player progress is saved to localStorage via `src/systems/SaveManager.ts`. When adding new features that introduce persistent state (new collectibles, unlockables, stats, etc.):

1. Add the new data to `SaveData` in `SaveManager.ts` and to `ProgressionState` in `ProgressionSystem.ts`.
2. Update `defaultState()`, `persist()`, and `loadFromSave()` in `ProgressionSystem` to handle the new fields.
3. Call `this.persist()` in ProgressionSystem after any state mutation that should survive a reload.
4. **Do not** import `SaveManager` from scene code — interact with persistence only through `ProgressionSystem`'s public API. The one exception is `hasSave()` for UI checks (e.g. showing a "Continue" button).

### EventBus Pattern

The project uses a standalone `EventBus` (`src/systems/EventBus.ts`) for loose coupling between game systems. It has no Phaser dependency and is imported as a singleton.

**When to use the EventBus:**
- Triggering side effects (audio, particles, UI feedback) from gameplay actions
- Any case where the emitter shouldn't know about the consumer
- Cross-system communication where direct imports create circular or tight coupling

**When NOT to use the EventBus:**
- Direct parent-child communication (pass callbacks or use Phaser's built-in scene events)
- Single-use wiring where a direct function call is clearer
- Performance-critical per-frame logic (event dispatch has overhead vs direct calls)

**Event naming conventions:**
- `sfx:<action>` — sound effects (e.g., `sfx:jump`, `sfx:collect`)
- `music:play` — play a music track by key
- `music:stop` — stop current music
- `zone:enter` — player entered a named content zone (payload: `zoneId: string`)
- `zone:exit` — player left a named content zone (payload: `zoneId: string`)

**To add a new sound effect:**
1. Generate the sound in `SoundGenerator.ts` and register it in `generateSounds()`
2. Add the event→key mapping in `src/config/audioConfig.ts` under `SFX_EVENTS`
3. Emit the event from the relevant entity/system: `eventBus.emit('sfx:myevent')`

**To add music for a new scene:**
1. Generate the track in `MusicGenerator.ts` and register it in `generateMusic()`
2. Add the scene→music mapping in `src/config/audioConfig.ts` under `SCENE_MUSIC`
3. The `MusicPlugin` handles playback automatically — no scene code changes needed

### Zone System

Content zones gate which info cards, quizzes, and zone-specific UI (e.g. ElevatorButtons) are accessible. **This is the default pattern for any feature that should only appear in a specific area of a scene.**

**How it works:**

1. `ZoneManager` (`src/systems/ZoneManager.ts`) tracks named zones. Each zone has an ID and a `check: () => boolean` lambda — the check can be anything (physics body contact, proximity distance, rectangle overlap, custom state).
2. `zoneManager.update()` is called once per frame. It emits `zone:enter` or `zone:exit` on the EventBus **only when the state changes** — not every frame.
3. UI components subscribe to those events and show/hide themselves. The scene's update loop has no `setVisible()` calls for zone-gated elements.
4. `zoneManager.getActiveZone()` provides a synchronous query for keyboard input handlers that need the current zone immediately (no event latency needed).

**Adding a new zone (e.g. a lobby kiosk):**

```typescript
// In create() — register the zone:
zoneManager.register('lobby-kiosk', () => Phaser.Math.Distance.Between(...) < 200);

// In create() — subscribe once, unsubscribe on shutdown:
const onEnter = (...args: unknown[]) => {
  if ((args[0] as string) === 'lobby-kiosk') myIcon.setVisible(true);
};
const onExit = (...args: unknown[]) => {
  if ((args[0] as string) === 'lobby-kiosk') myIcon.setVisible(false);
};
eventBus.on('zone:enter', onEnter);
eventBus.on('zone:exit', onExit);
this.events.once('shutdown', () => {
  eventBus.off('zone:enter', onEnter);
  eventBus.off('zone:exit', onExit);
});

// In update() — one call drives all zones:
zoneManager.update();
```

**Rules:**
- Always unsubscribe from the EventBus in the scene's `shutdown` event. EventBus is a singleton; Phaser scenes are not destroyed between start/stop, so handlers accumulate if not cleaned up.
- Info icons (`InfoIcon`) start hidden; zone events reveal them. Never initialise a zone-gated icon as visible.
- Badge refresh (quiz result on an icon) is a direct parent-to-child call — use `icon.setQuizBadge()` directly in the dialog close callback. No event needed.
- Gameplay mechanics that happen to use the same button (e.g. in-room lift buttons in `LevelScene`) are **not** content zones. Drive them with direct `setVisible()` calls from physics state — not via ZoneManager.
- `LevelConfig.infoPoints` accepts an optional `zoneRadius` per point (default 250 px). Override `createInfoZones()` in a subclass for non-circular zones.

**Zone IDs match content IDs** (`infoContent.ts` keys) so the same string identifies both the zone and the dialog to open.

### Audio Architecture

Audio is fully decoupled via the EventBus. `AudioManager` is a purely reactive subscriber — no module calls it directly. Music is triggered automatically by `MusicPlugin` (a Phaser ScenePlugin) on scene transitions. SFX are triggered by entities emitting events on the EventBus.

All audio (SFX and music) is procedurally generated at runtime in `SoundGenerator.ts` and `MusicGenerator.ts` — the project has zero external audio files.

### AI Collaboration Guidelines

When responding to ideas or feature requests:
- **Always challenge ideas critically** — identify trade-offs, edge cases, and simpler alternatives before implementing
- **Provide options with pros and cons** — don't just implement the first approach; present at least 2 options for non-trivial decisions
- **Push back on over-engineering** — if a simpler solution exists, present it alongside the complex one
- **Question assumptions** — ask "do we actually need this?" before building abstractions

## Debugging & Visual Verification with Playwright

When you need to see how a feature actually looks in the browser, or when a bug is hard to reproduce without visual context, use the Playwright screenshot tests:

```bash
# Run all screenshot tests and save PNGs to tests/screenshots/
npm test

# Run with a visible browser window (useful for watching scene transitions)
npm run test:headed

# Open the interactive Playwright UI (step-by-step trace, timeline scrubber)
npm run test:ui
```

Screenshots land in `tests/screenshots/` and are committed to the repo so reviewers can see the current visual state without running the game.

### Adding a one-off debug screenshot

Inside any test in `tests/gameplay.spec.ts`, call:

```ts
await page.screenshot({ path: 'tests/screenshots/debug-my-feature.png' });
// or clip to a specific area:
await page.screenshot({ path: 'tests/screenshots/debug-hud.png', clip: { x: 0, y: 0, width: 640, height: 120 } });
```

### Jumping to a specific scene for inspection

The dev server exposes `window.__game` (a `Phaser.Game` reference). Tests use it to navigate without going through the full game flow:

```ts
// Wait for an active scene then call its ScenePlugin to switch
await page.evaluate(() => {
  const scene = window.__game!.scene.getScenes(true)
    .find(s => s.sys.settings.key === 'ElevatorScene');
  scene!.scene.start('PlatformTeamScene');
});
await waitForScene(page, 'PlatformTeamScene');
await page.screenshot({ path: 'tests/screenshots/debug-floor1.png' });
```

For private methods (like `ElevatorScene.enterFloor`), use bracket notation — TypeScript visibility is stripped at runtime:

```ts
(scene as Record<string, unknown>)['enterFloor'](1);
```

### Pre-seeding progression state

To skip grinding AU tokens and test locked content, inject a save into `localStorage` before the page loads:

```ts
await page.addInitScript(() => {
  localStorage.setItem('architect_default_v1', JSON.stringify({
    totalAU: 50,
    floorAU: { 0: 0, 1: 25, 2: 25 },
    unlockedFloors: [0, 1, 2],
    currentFloor: 0,
    collectedTokens: { 0: [], 1: [], 2: [] },
  }));
  // Mark info dialogs as seen so they don't block keyboard input:
  localStorage.setItem('architect_info_seen_v1', JSON.stringify(['architecture-elevator']));
});
```

## Vibe Coding Workflow

This project is developed through conversational AI assistance. When prompting:

- Describe the desired game behavior or mechanic in plain language.
- Reference existing scenes or objects by name so the AI can locate them.
- Ask for one change at a time to keep diffs small and reviewable.
- Test in the browser after each change (`npm run dev`).

Example prompts:
- "Add a Player object in `src/objects/Player.js` that moves with arrow keys."
- "Create a GameOver scene that shows the final score and a restart button."
- "Make the enemies in `Game.js` spawn every 2 seconds from the right side."
