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

**Audio events follow this convention:**
- `sfx:<action>` — sound effects (e.g., `sfx:jump`, `sfx:collect`)
- `music:play` — play a music track by key
- `music:stop` — stop current music

**To add a new sound effect:**
1. Generate the sound in `SoundGenerator.ts` and register it in `generateSounds()`
2. Add the event→key mapping in `src/config/audioConfig.ts` under `SFX_EVENTS`
3. Emit the event from the relevant entity/system: `eventBus.emit('sfx:myevent')`

**To add music for a new scene:**
1. Generate the track in `MusicGenerator.ts` and register it in `generateMusic()`
2. Add the scene→music mapping in `src/config/audioConfig.ts` under `SCENE_MUSIC`
3. The `MusicPlugin` handles playback automatically — no scene code changes needed

### Audio Architecture

Audio is fully decoupled via the EventBus. `AudioManager` is a purely reactive subscriber — no module calls it directly. Music is triggered automatically by `MusicPlugin` (a Phaser ScenePlugin) on scene transitions. SFX are triggered by entities emitting events on the EventBus.

All audio (SFX and music) is procedurally generated at runtime in `SoundGenerator.ts` and `MusicGenerator.ts` — the project has zero external audio files.

### AI Collaboration Guidelines

When responding to ideas or feature requests:
- **Always challenge ideas critically** — identify trade-offs, edge cases, and simpler alternatives before implementing
- **Provide options with pros and cons** — don't just implement the first approach; present at least 2 options for non-trivial decisions
- **Push back on over-engineering** — if a simpler solution exists, present it alongside the complex one
- **Question assumptions** — ask "do we actually need this?" before building abstractions

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
