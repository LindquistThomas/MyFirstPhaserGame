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
│   ├── audioConfig.ts    SFX key ↔ event-name map; music track list.
│   ├── info/             Info-point copy, split by floor (Tier A.2).
│   │   ├── index.ts      Barrel: merges per-floor records into INFO_POINTS.
│   │   ├── types.ts      InfoPointDef type.
│   │   ├── lobby.ts      welcome-board + architecture-elevator.
│   │   ├── platform.ts   Platform-team room info points.
│   │   ├── architecture.ts   Architecture-team room info points.
│   │   ├── finance.ts    Finance side of the Business floor.
│   │   ├── product.ts    Product Leadership + Products-hall rooms.
│   │   └── exec.ts       Executive Suite (penthouse).
│   └── quiz/             Quiz pools, split by floor (Tier A.1).
│       ├── index.ts      Barrel: merges per-floor records into QUIZ_DATA; `getQuizFor(floorId)`.
│       ├── types.ts      QuizDefinition / QuizQuestion + scoring constants.
│       ├── lobby.ts      Lobby-floor quizzes.
│       ├── platform.ts   Platform-team room quizzes.
│       ├── architecture.ts   Architecture-team room quizzes.
│       ├── finance.ts    Finance quizzes (placeholder).
│       ├── product.ts    Product-team quizzes (placeholder).
│       └── exec.ts       Executive-suite quizzes (placeholder).
├── entities/             Gameplay objects owned by scenes.
│   ├── Player.ts         Side-view sprite, jump + flip movement, footstep/jump cues.
│   ├── Elevator.ts       Cab physics, floor docking, ride cues.
│   ├── Token.ts          AU token pickup with floating animation.
│   ├── DroppedAU.ts      AU tokens dropped by defeated enemies.
│   ├── Enemy.ts          Shared enemy base (physics, damage, death cues).
│   └── enemies/          Per-enemy config & behaviour (Slime, BureaucracyBot, …).
├── input/                Semantic-action input layer (replaces the old InputManager).
│   ├── index.ts          Facade — the only import surface the rest of the game uses.
│   ├── InputService.ts   Keyboard/touch → semantic actions; context stack.
│   ├── actions.ts        GameAction catalog ("move-left", "jump", …).
│   ├── bindings.ts       Default key bindings per action context.
│   ├── pointerBindings.ts    Touch/pointer action bindings.
│   ├── keyLabels.ts      Human-readable key names for UI hints.
│   └── phaser-augment.d.ts   Phaser typings adjustments for the service.
├── scenes/
│   ├── BootScene.ts          Generates every sprite + sound before gameplay starts.
│   ├── MenuScene.ts          Title screen; new game / continue; save-slot UI.
│   ├── ElevatorScene.ts      Elevator-shaft orchestrator; delegates to `elevator/`.
│   ├── LevelScene.ts         Shared base scene for the floors below.
│   ├── LobbyScene.ts         Ground floor — tutorial content.
│   ├── PlatformTeamScene.ts  Floor 1 (left room) — Platform Team.
│   ├── ArchitectureTeamScene.ts  Floor 1 (right room) — Architecture Team.
│   ├── FinanceTeamScene.ts   Floor 3 (left room) — Finance.
│   ├── ProductLeadershipScene.ts Floor 3 (right room) — Product Leadership.
│   ├── ExecutiveSuiteScene.ts    Floor 4 — Executive Suite (penthouse).
│   ├── ProductsHallScene.ts  Floor 5 hall — one door per ISY product.
│   ├── elevator/             Elevator-shaft collaborators.
│   │   ├── ElevatorController.ts  Owns the Elevator entity + ride loop + music cues.
│   │   ├── ElevatorZones.ts       Owns lobby zones, info icons, first-ride intro.
│   │   └── ElevatorShaftDoors.ts  Side-view landing doors that open on dock.
│   └── products/             Individual product rooms reached from the hall.
│       ├── ProductRoomScene.ts    Shared base for the product rooms below.
│       ├── ProductIsyProjectControlsScene.ts
│       ├── ProductIsyBeskrivelseScene.ts
│       ├── ProductIsyRoadScene.ts
│       └── ProductAdminLisensScene.ts
├── systems/              Cross-cutting logic — no Phaser GameObject deps.
│   ├── EventBus.ts           Typed pub/sub; `GameEvents` is the event catalog.
│   ├── ZoneManager.ts        Proximity zones; emits `zone:enter/exit`.
│   ├── ProgressionSystem.ts  AU accumulation, floor unlocks, token dedupe.
│   ├── SaveManager.ts        LocalStorage with pluggable `KVStorage` for tests.
│   ├── QuizManager.ts        Quiz pass/fail records + retry cooldowns.
│   ├── InfoDialogManager.ts  Remembers which info points have been seen.
│   ├── AudioManager.ts       Subscribes to music/sfx events; plays via WebAudio.
│   ├── SpriteGenerator.ts    Composition root → `./sprites/` per-asset modules.
│   ├── SoundGenerator.ts     Procedural SFX via WebAudio.
│   ├── MusicGenerator.ts     Procedural fallback tracks.
│   └── sprites/              One file per asset family (player, tiles, token, …).
├── ui/                   Modal + HUD widgets built on Phaser containers.
│   ├── ModalBase.ts          Overlay + fade + Esc-key scaffolding for dialogs.
│   ├── InfoDialog.ts         Info content modal (extends ModalBase).
│   ├── QuizDialog.ts         Quiz flow modal (extends ModalBase).
│   ├── DialogController.ts   Orchestrates info → quiz → badge-refresh flow.
│   ├── InfoIcon.ts           Floating "i" icon with quiz badge.
│   ├── HUD.ts                AU counter, floor label.
│   └── ElevatorButtons.ts,
│       ElevatorPanel.ts      Touch controls for the elevator.
└── plugins/              Phaser plugins.
    ├── DebugPlugin.ts    Toggleable debug overlay.
    └── MusicPlugin.ts    Scene-level music lifecycle helper.
```

## Ownership map (who owns what)

Use this to find the right file to edit for a given feature.

| Feature area                        | Primary files                                                                 |
|-------------------------------------|-------------------------------------------------------------------------------|
| Lobby / tutorial                    | `scenes/LobbyScene.ts`, `config/info/lobby.ts`, `config/quiz/lobby.ts`        |
| Platform Team room                  | `scenes/PlatformTeamScene.ts`, `config/info/platform.ts`, `config/quiz/platform.ts` |
| Architecture Team room              | `scenes/ArchitectureTeamScene.ts`, `config/info/architecture.ts`, `config/quiz/architecture.ts` |
| Finance room                        | `scenes/FinanceTeamScene.ts`, `config/info/finance.ts`, `config/quiz/finance.ts` |
| Product Leadership + Products hall  | `scenes/ProductLeadershipScene.ts`, `scenes/ProductsHallScene.ts`, `config/info/product.ts`, `config/quiz/product.ts` |
| Executive Suite                     | `scenes/ExecutiveSuiteScene.ts`, `config/info/exec.ts`, `config/quiz/exec.ts` |
| Elevator shaft + transitions        | `scenes/ElevatorScene.ts`, `scenes/elevator/*.ts`                             |
| Player movement & animation         | `entities/Player.ts`                                                          |
| Enemies                             | `entities/Enemy.ts`, `entities/enemies/*.ts`                                  |
| AU / tokens / progression           | `entities/Token.ts`, `entities/DroppedAU.ts`, `systems/ProgressionSystem.ts`  |
| Save slots                          | `systems/SaveManager.ts`, `scenes/MenuScene.ts`                               |
| Quiz runtime                        | `systems/QuizManager.ts`, `ui/QuizDialog.ts`                                  |
| Input (keyboard + touch)            | `input/*`                                                                     |
| Audio                               | `systems/AudioManager.ts`, `systems/SoundGenerator.ts`, `systems/MusicGenerator.ts` |
| Procedural sprites                  | `systems/SpriteGenerator.ts`, `systems/sprites/*.ts`                          |

## Data Flow

### Scene graph

```
BootScene  →  MenuScene  →  ElevatorScene  ↔  Floor scenes (via LevelScene)
                                            ↘  ProductsHallScene  →  product rooms
```

`BootScene` runs every sprite + sound generator once, then hands off to
`MenuScene`. `ElevatorScene` is the central shaft/lobby; rides transition
into the floor scenes (each a thin wrapper around `LevelScene`). The
Products hall exits into individual product-room scenes.

### Runtime wiring

```
                 ┌──────────────┐
 Input ───────► │ InputService │──► Player.update
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
  EventBus, SaveManager, QuizManager, ProgressionSystem, ZoneManager,
  InputService, and the config/info + config/quiz barrels.
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
- **One file per floor for quiz and info content.** Each floor's owner
  edits `config/info/<floor>.ts` and `config/quiz/<floor>.ts` — the
  merge-conflict hotspot of one giant file is gone.
