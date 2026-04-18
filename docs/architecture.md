# Architecture

A one-page map of the codebase. For setup and conventions see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Module Map

```
src/
├── main.ts               Phaser game bootstrap; scene registration.
├── config/               Single source of truth for constants & data.
│   ├── gameConfig.ts     World dimensions, physics constants, colors, FLOORS enum.
│   ├── levelData.ts      Per-floor metadata: name, scene key, AU thresholds, theme.
│   ├── infoContent.ts    Info-point copy (IDs shared with InfoDialog + QuizManager).
│   ├── quizData.ts       Quiz question pools, pass threshold, retry cooldown.
│   └── audioConfig.ts    SFX key ↔ event-name map; music track list.
├── entities/             Gameplay objects owned by scenes.
│   ├── Player.ts         Side-view sprite, jump + flip movement, footstep/jump cues.
│   ├── Elevator.ts       Cab physics, floor docking, ride cues.
│   └── Token.ts          AU token pickup with floating animation.
├── scenes/
│   ├── BootScene.ts      Generates every sprite + sound before gameplay starts.
│   ├── MenuScene.ts      Title screen; new game / continue.
│   ├── ElevatorScene.ts  Elevator-shaft orchestrator; delegates to `elevator/` collaborators.
│   ├── elevator/ElevatorController.ts
│   │                     Owns the Elevator entity + ride loop + music cues.
│   ├── elevator/ElevatorZones.ts
│   │                     Owns lobby zones, info icons, first-ride intro flow.
│   ├── elevator/ElevatorShaftDoors.ts
│   │                     Side-view landing doors that open when the cab docks.
│   ├── LevelScene.ts     Shared base scene for the floors below.
│   ├── LobbyScene.ts    Tutorial floor (tier-0 content).
│   ├── PlatformTeamScene.ts    Platform Team.
│   └── Floor2Scene.ts    Cloud Team.
├── systems/              Cross-cutting logic — no Phaser GameObject deps.
│   ├── EventBus.ts       Typed pub/sub; `GameEvents` is the event catalog.
│   ├── ZoneManager.ts    Proximity zones; emits `zone:enter/exit` on transitions.
│   ├── ProgressionSystem.ts
│   │                     AU accumulation, floor unlocks, token dedupe.
│   ├── SaveManager.ts    LocalStorage with pluggable `KVStorage` for tests.
│   ├── QuizManager.ts    Quiz pass/fail records + retry cooldowns.
│   ├── InfoDialogManager.ts  Remembers which info points have been seen.
│   ├── InputManager.ts   Keyboard + touch input abstraction.
│   ├── AudioManager.ts   Subscribes to music/sfx events; plays via WebAudio.
│   ├── SpriteGenerator.ts    Composition root → `./sprites/` per-asset modules.
│   ├── SoundGenerator.ts     Procedural SFX via WebAudio.
│   ├── MusicGenerator.ts     Procedural fallback tracks.
│   └── sprites/          One file per asset family (player, tiles, token, …).
├── ui/                   Modal + HUD widgets built on Phaser containers.
│   ├── ModalBase.ts      Overlay + fade + Esc-key scaffolding for dialogs.
│   ├── InfoDialog.ts     Info content modal (extends ModalBase).
│   ├── QuizDialog.ts     Quiz flow modal (extends ModalBase).
│   ├── DialogController.ts   Orchestrates info → quiz → badge-refresh flow.
│   ├── InfoIcon.ts       Floating "i" icon with quiz badge.
│   ├── HUD.ts            AU counter, floor label.
│   ├── ElevatorButtons.ts, ElevatorPanel.ts
│   │                     Touch controls for the elevator.
└── plugins/              Phaser plugins.
    ├── DebugPlugin.ts    Toggleable debug overlay.
    └── MusicPlugin.ts    Scene-level music lifecycle helper.
```

## Data Flow

### Scene graph

```
BootScene  →  MenuScene  →  ElevatorScene  ↔  Floor0/1/2 (via LevelScene)
```

`BootScene` runs every sprite + sound generator once, then hands off to
`MenuScene`. `ElevatorScene` is the central shaft/lobby; elevator rides transition
to `Floor0/1/2Scene` (each a thin wrapper around `LevelScene`).

### Runtime wiring

```
                 ┌──────────────┐
 Input ───────► │ InputManager │──► Player.update
                 └──────────────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │    Scene    │
                                └─────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
     ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
     │ ZoneManager     │      │ DialogController│      │ ProgressionSys. │
     └─────────────────┘      └─────────────────┘      └─────────────────┘
              │                        │                        │
              └──────────┐             │           ┌────────────┘
                         ▼             ▼           ▼
                     ┌──────────────────────────────┐
                     │   eventBus (GameEvents map)  │
                     └──────────────────────────────┘
                         │             │
                         ▼             ▼
                 ┌───────────────┐   ┌───────────────┐
                 │ AudioManager  │   │ UI subscribers│
                 └───────────────┘   └───────────────┘
```

### Event catalog

Every pub/sub message goes through `src/systems/EventBus.ts`. The
`GameEvents` interface at the top of that file is the catalog — adding
an event there type-checks every call site automatically. Current
events:

| Event              | Payload           | Emitters                     | Consumers        |
|--------------------|-------------------|------------------------------|------------------|
| `music:play`       | `key: string`     | Scenes, ElevatorController   | AudioManager     |
| `music:stop`       | —                 | MusicPlugin                  | AudioManager     |
| `zone:enter`       | `zoneId: string`  | ZoneManager                  | Scenes, UI       |
| `zone:exit`        | `zoneId: string`  | ZoneManager                  | Scenes, UI       |
| `sfx:info_open`    | —                 | DialogController             | AudioManager     |
| `sfx:link_click`   | —                 | InfoDialog                   | AudioManager     |
| `sfx:jump`         | —                 | Player                       | AudioManager     |
| `sfx:footstep_a/b` | —                 | Player                       | AudioManager     |
| `sfx:quiz_*`       | —                 | QuizDialog                   | AudioManager     |

## Testing

- **Unit tests** (`npm run test:unit`) live next to their sources as
  `*.test.ts` and run in jsdom under Vitest. They cover pure systems:
  EventBus, SaveManager, QuizManager, ProgressionSystem, ZoneManager.
- **End-to-end tests** (`npm test`) drive the real game via Playwright.
- **Type safety** (`npm run build`) runs `tsc` before Vite bundles.

## Key design choices

- **Procedural assets.** No image files. `BootScene` generates every
  sprite into Phaser's texture cache at startup.
- **Event-driven coupling.** Systems don't hold references to each
  other; they publish and subscribe through `eventBus`. This keeps
  scene transitions cheap and makes audio a pure subscriber.
- **Pluggable storage.** `SaveManager` exposes a `KVStorage` interface
  so tests can swap in an in-memory store without monkey-patching
  `localStorage`.
- **Config as data.** `src/config/` owns constants, floor metadata,
  quiz questions, info content. Scenes read from it; nothing writes to
  it. Adding a new floor is a config edit + a thin scene subclass.
