# Architecture

A one-page map of the codebase. For setup and conventions see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Module Map

```
src/
├── main.ts                   Phaser game bootstrap; scene registration.
├── config/                   Shared constants + back-compat barrels.
│   ├── achievements.ts       Achievement definitions catalogue — id, label, description, and secret flag per achievement.
│   ├── audioConfig.ts        SFX key ↔ event-name map; music track list.
│   ├── gameConfig.ts         World dimensions, physics, colours, FLOORS enum.
│   ├── levelData.ts          Per-floor metadata: name, scene key, AU thresholds, theme.
│   ├── levelGeometry.ts      Shared geometry constants — mezzanine tier Y positions and catwalk thicknesses.
│   ├── info/                 Barrel — merges per-floor info into INFO_POINTS.
│   │   ├── index.ts          Re-export barrel + `getInfoPointsFor(floorId)`.
│   │   └── types.ts          `InfoPointDef` shape.
│   └── quiz/                 Barrel — merges per-floor quizzes into QUIZ_DATA.
│       ├── index.ts          Re-export barrel + `getQuizFor(floorId)`.
│       └── types.ts          `QuizDefinition` + scoring constants.
├── features/                 Per-feature trees (floors + products).
│   ├── floors/               One directory per floor — scene + content co-located.
│       ├── index.ts          Static barrel — re-exports six of eight floor scenes (platform, architecture, finance, product, customer, executive); all floor scenes are lazy-loaded at runtime via `lazySceneLoaders.ts`. Boss is registered directly there; lobby has no scene.
│       ├── _shared/          Base class + manager collaborators used by every floor.
│       │   ├── LevelScene.ts           Shared base scene (composition root).
│       │   ├── LevelEnemySpawner.ts    Spawns + cleans up enemies.
│       │   ├── LevelTokenManager.ts    Spawns AU tokens + handles pickup.
│       │   ├── LevelZoneSetup.ts       Registers proximity zones for info points.
│       │   ├── LevelDialogBindings.ts  Wires dialog triggers to zones.
│       │   ├── LevelCoffeeManager.ts   Spawns coffee powerup pickups.
│       │   ├── LevelFridgeManager.ts   Spawns energy-drink fridges + buff trigger.
│       │   ├── LevelRoomElevators.ts   In-room elevator triggers (inter-room transport).
│       │   ├── floorAccents.ts         Per-floor silhouette accent + ambient tween.
│       │   ├── floorPatterns.ts        Themed decorative patterns for scene backdrop.
│       │   ├── sceneBackdrop.ts        Layered gradient/pattern/vignette background.
│       │   ├── validateLevelConfig.ts  Structural + registry validator for LevelConfig.
│       │   ├── coachHints.ts           First-visit per-floor toast hint copy.
│       │   ├── dailyChallengeLayout.ts Deterministic per-day layout overrides for tokens/enemies/consumables.
│       │   └── defineFloorScene.ts     Factory that builds a LevelScene subclass from declarative options (key, floorId, config, banner, decorations, returnSide). Used by every standard floor.
│       ├── lobby/            Lobby content — info.ts + quiz.ts (shown on the elevator's ground-floor zone).
│       ├── platform/         Platform Team — + enemies.ts for the bureaucracy-bot.
│       ├── architecture/     Architecture Team — largest quiz pool.
│       ├── finance/          Finance — door inside the Executive Suite (FLOORS.EXECUTIVE).
│       ├── product/          Product Leadership — Business floor, left room.
│       ├── customer/         Customer Success — Business floor, right room.
│       ├── executive/        ExecutiveSuiteScene.ts (penthouse).
│       └── boss/             BossArenaScene — final encounter (floor 5 "Boardroom").
│   └── products/
│       └── rooms/            Individual product rooms reached from the Products floor doors.
│           ├── ProductRoomScene.ts            Shared base for product rooms below.
│           ├── ProductIsyProjectControlsScene.ts
│           ├── ProductIsyBeskrivelseScene.ts
│           ├── ProductIsyRoadScene.ts
│           └── ProductAdminLisensScene.ts
├── entities/                 Gameplay objects owned by scenes.
│   ├── Player.ts             Side-view sprite, movement, footstep/jump cues.
│   ├── Elevator.ts           Cab physics, floor docking, ride cues.
│   ├── Token.ts              AU token pickup with floating animation.
│   ├── DroppedAU.ts          AU tokens dropped by defeated enemies.
│   ├── MovingPlatform.ts     Horizontally/vertically patrolling platform.
│   ├── Coffee.ts             Coffee powerup — grants a short speed boost.
│   ├── EnergyDrinkFridge.ts  Energy-drink fridge — grants caffeine buff.
│   ├── BriefcaseProjectile.ts  Briefcase projectile thrown by enemies.
│   ├── CEOBoss.ts              CEO boss entity (boss arena).
│   ├── Checkpoint.ts           Per-visit overlap trigger — records player respawn position.
│   ├── CoffeeMugProjectile.ts  Mug projectile thrown by player (boss arena).
│   ├── MissionItem.ts          Mission item pickup (e.g. pistol in executive rescue).
│   ├── PistolProjectile.ts     Pistol projectile (executive rescue).
│   ├── Enemy.ts              Shared enemy base (physics, damage, death cues).
│   └── enemies/              Per-enemy config & behaviour.
│       ├── Slime.ts
│       ├── BureaucracyBot.ts
│       ├── ScopeCreep.ts
│       ├── ArchitectureAstronaut.ts
│       ├── TechDebtGhost.ts
│       └── TerroristCommander.ts
├── input/                    Semantic-action input layer.
│   ├── index.ts              Facade — the only import surface the rest of the game uses.
│   ├── InputService.ts       Keyboard/touch → semantic actions; context stack.
│   ├── actions.ts            GameAction catalog ("move-left", "jump", …).
│   ├── bindings.ts           Default key bindings per action context.
│   ├── pointerBindings.ts    Touch/pointer action bindings.
│   ├── keyLabels.ts          Human-readable key names for UI hints.
│   └── phaser-augment.d.ts   Phaser typings adjustments for the service.
├── scenes/                   Infrastructure scenes (non-floor).
│   ├── NavigationContext.ts  Typed hand-off for `scene.start(key, ctx)`.
│   ├── sceneRegistry.ts      EAGER_REGISTRY + validateSceneRegistry(); derives SCENE_REGISTRY.
│   ├── lazySceneLoaders.ts   LOADERS array (internal) → LAZY_SCENE_LOADERS map (exported); loader thunks for floor/product/boss scenes. Edit LOADERS to register a new lazy scene.
│   ├── core/
│   │   ├── BootScene.ts      Loads eager files + player sprite, profiles boot phases in dev, creates `GameStateManager`.
│   │   ├── MenuScene.ts      Title screen; new game / continue; save-slot UI.
│   │   ├── PauseScene.ts     Pause overlay (resume / settings / quit).
│   │   ├── SettingsScene.ts  Settings menu (audio, motion, controls).
│   │   ├── ControlsScene.ts  Keyboard-rebinding submenu.
│   │   └── SaveSlotScene.ts  Save-slot picker (new game / continue / delete).
│   ├── elevator/             Elevator-shaft orchestrator + collaborators.
│   │   ├── ElevatorScene.ts                     Thin orchestrator — delegates layout, transitions, doors, zones to the collaborators below.
│   │   ├── ElevatorController.ts                Owns the Elevator entity + ride loop.
│   │   ├── ElevatorSceneLayout.ts               Shaft visuals, floor labels, unlock rendering.
│   │   ├── ElevatorFloorTransitionManager.ts    Floor-to-floor transition state.
│   │   ├── ElevatorShaftDoors.ts                Side-view landing doors that open on dock.
│   │   ├── ElevatorZones.ts                     Lobby zones, info icons, first-ride intro.
│   │   ├── ProductDoorManager.ts                Per-product door state on the products floor.
│   │   ├── buildingFacade.ts                    Outer-building façade (dark office-tower wall with animated lit windows) painted in the hallway strips flanking the shaft.
│   │   ├── distantSkyline.ts                    City-skyline silhouette above the rooftop; parallax-scrolled, visible only near the shaft top.
│   │   ├── elevatorCabGeometry.ts               Pure cab geometry helpers (rider clamping); no Phaser dependency, used by ElevatorController.
│   │   ├── floorBackdrops.ts                    Per-floor themed near-layer hallway backdrops; pure spec helpers + thin Phaser renderer.
│   │   ├── floorDecorations.ts                  Lobby and per-floor decoration sprites; single entry-point drawAllDecorations().
│   │   ├── platformTiles.ts                     Hallway floor tiles, walkable strips, floor-signage plaques, and invisible shaft-wall segments.
│   │   ├── shaftWalls.ts                        Shaft structural drawing: walls, caps, rooftop props, machine room, dust motes, doors, cable, and LEDs.
│   │   └── skyBackdrop.ts                       Screen-locked night-sky backdrop: gradient sky, moon with halo, and static starfield with slow twinklers.
├── style/                    Design tokens.
│   ├── theme.ts              Central colour + spacing tokens (numeric + CSS strings).
│   └── responsive.ts         Viewport helpers (FIT scaling, aspect-ratio queries).
├── systems/                  Cross-cutting logic — no Phaser GameObject deps.
│   ├── EventBus.ts           Typed pub/sub; `GameEvents` is the event catalog.
│   ├── GameStateManager.ts   Composition root — owns ProgressionSystem + PlaytimeTracker; exposes facades over SaveManager, QuizManager, InfoDialogManager, AchievementManager, TouchHintStore.
│   ├── ZoneManager.ts        Proximity zones; emits `zone:enter/exit`.
│   ├── ProgressionSystem.ts  AU accumulation, floor unlocks, token dedupe.
│   ├── SaveManager.ts        LocalStorage with pluggable `KVStorage` for tests.
│   ├── QuizManager.ts        Quiz pass/fail records + retry cooldowns.
│   ├── InfoDialogManager.ts  Remembers which info points have been seen.
│   ├── AchievementManager.ts Tracks unlocked achievement IDs (architect_achievements_v1).
│   ├── AudioManager.ts       Subscribes to music/sfx events; plays via WebAudio.
│   ├── SettingsStore.ts      Persisted volume levels + motion/control overrides.
│   ├── MotionPreference.ts   Reduced-motion helper (reads OS preference + settings).
│   ├── CaffeineBuff.ts       Pure timer for caffeine buff; callers supply `now`.
│   ├── FloorHitState.ts      Per-floor hit / checkpoint tracking; pure (no Phaser/eventBus); 3-hit forced respawn threshold.
│   ├── PersistedStore.ts     Generic JSON-backed key/value store factory.
│   ├── TouchHintStore.ts     Persistent flag for first-run virtual-gamepad hint.
│   ├── PlaytimeTracker.ts    Total + per-floor active-playtime accumulator; persists via PlaytimeSaveAdapter (10 s flush throttle).
│   ├── Analytics.ts          Opt-in analytics service. Gated on VITE_ANALYTICS_ENDPOINT (build) + SettingsStore.analyticsConsent (runtime). Stashed on scene.registry under "analytics" by BootScene.
│   ├── DailyChallenge.ts     Daily challenge mode — UTC date → deterministic seed; slot id `daily_<YYYYMMDD>`. Persists results via DailyChallengeStore.
│   ├── DailyChallengeStore.ts  Per-day result persistence (localStorage `architect_daily_results_v1`).
│   ├── SeededRandom.ts       Deterministic PRNG (used by DailyChallenge).
│   ├── sliderUtils.ts        Volume slider clamping utilities.
│   ├── sceneLifecycle.ts     `createSceneLifecycle(scene)` — uniform teardown.
│   ├── SpriteGenerator.ts    Composition root → `./sprites/` per-asset modules.
│   ├── SoundGenerator.ts     Composition root → `./sounds/` per-family modules.
│   ├── sounds/               One file per SFX family (combat, footsteps, ui, …).
│   │   ├── ambience.ts
│   │   ├── boss.ts           Boss-arena SFX — hit thud, defeated fanfare, phase sting, projectile and mission-event sounds.
│   │   ├── combat.ts
│   │   ├── footsteps.ts
│   │   ├── items.ts
│   │   ├── lullaby.ts
│   │   ├── mission.ts        Mission-sequence SFX — item pickup chime, bomb-disarm beeps, hostage-freed fanfare.
│   │   ├── movement.ts
│   │   ├── quiz.ts
│   │   ├── ui.ts
│   │   └── wav.ts
│   └── sprites/              One file per asset family (player, tiles, token, …).
├── ui/                       Modal + HUD widgets built on Phaser containers.
│   ├── BombDisarmDialog.ts     Wire-cutting mini-game modal for the executive rescue (extends ModalBase).
│   ├── BossHealthBar.ts        Boss HP bar (boss arena).
│   ├── BossIntroDialog.ts      Boss-arena intro modal (extends ModalBase).
│   ├── CallElevatorButton.ts   Call-elevator action button.
│   ├── ModalBase.ts          Overlay + fade + Esc-key scaffolding for dialogs.
│   ├── ModalKeyboardNavigator.ts  Shared keyboard nav for InfoDialog + QuizDialog.
│   ├── AchievementsDialog.ts Modal listing all achievements with lock/unlock status.
│   ├── WelcomeModal.ts       First-launch onboarding modal (extends ModalBase).
│   ├── InfoDialog.ts         Info content modal (extends ModalBase).
│   ├── QuizDialog.ts         Quiz flow modal (extends ModalBase).
│   ├── QuizResultsScreen.ts  Extracted results screen used by QuizDialog.
│   ├── DialogController.ts   Orchestrates info → quiz → badge-refresh flow.
│   ├── InfoIcon.ts           Floating "i" icon with quiz badge.
│   ├── Toast.ts              Corner-of-screen transient notification (fade in/out).
│   ├── ControlHintsOverlay.ts  Transient key-hint chips shown on first lobby entry.
│   ├── InteractiveDoor.ts    Door sprite toggling open texture on interaction range.
│   ├── HUD.ts                AU counter, floor label.
│   ├── hud/                  Per-HUD-feature controllers — one per feature.
│   │   ├── AchievementBadgeController.ts  Toast badge for unlocked achievements.
│   │   ├── CaffeineRingController.ts      Caffeine-buff ring overlay around AU counter.
│   │   ├── CoinCounterController.ts       AU counter text + tween cues.
│   │   ├── MuteIconController.ts          Musical-note mute toggle (pointerup → audio:toggle-mute).
│   │   ├── ProgressStripController.ts     Floor-progress strip + sfx:floor_unlocked trigger.
│   │   ├── colorUtils.ts                  Shared color helpers.
│   │   └── testUtils.ts                   Test fixtures for hud controllers.
│   ├── ElevatorButtons.ts    Touch controls for the elevator cab.
│   ├── ElevatorPanel.ts      Floor-select panel inside the cab.
│   ├── TouchHintOverlay.ts   First-run virtual-gamepad hint (gated by TouchHintStore).
│   ├── VirtualGamepad.ts     On-screen touch gamepad for touch-primary devices.
│   ├── pillarboxBackdrop.ts  Live-canvas pillarbox blur for non-4:3 viewports.
│   ├── ariaLive.ts           ARIA live region for screen-reader announcements.
│   └── touchPrimary.ts       Detects touch-primary devices (pointer:fine media query).
└── plugins/                  Phaser plugins.
    ├── DebugPlugin.ts        Toggleable debug overlay.
    ├── MusicPlugin.ts        Scene-level music lifecycle helper.
    └── ScopedEventBus.ts     Auto-unsubscribes global EventBus listeners on scene shutdown.
```

## Ownership map (who owns what)

Use this to find the right file to edit for a given feature.

| Feature area                        | Primary files                                                                          |
|-------------------------------------|----------------------------------------------------------------------------------------|
| Lobby / tutorial content            | `features/floors/lobby/{info,quiz}.ts` (rendered inside `ElevatorScene`)                |
| Platform Team room                  | `features/floors/platform/{PlatformTeamScene,info,quiz,enemies}.ts`                    |
| Architecture Team room              | `features/floors/architecture/{ArchitectureTeamScene,info,quiz}.ts`                    |
| Finance room                        | `features/floors/finance/{FinanceTeamScene,info,quiz}.ts`                              |
| Product Leadership                  | `features/floors/product/{ProductLeadershipScene,info,quiz}.ts`                        |
| Customer Success                    | `features/floors/customer/{CustomerSuccessScene,info,quiz}.ts`                         |
| Products floor + product rooms      | `scenes/elevator/ProductDoorManager.ts` (doors on the Products floor), `features/products/rooms/Product*Scene.ts` |
| Executive Suite                     | `features/floors/executive/{ExecutiveSuiteScene,info,quiz}.ts`                         |
| Boss arena                          | `features/floors/boss/BossArenaScene.ts`, `entities/CEOBoss.ts`, `entities/CoffeeMugProjectile.ts`, `entities/BriefcaseProjectile.ts`, `ui/BossHealthBar.ts` |
| Shared floor base / managers        | `features/floors/_shared/*.ts`                                                         |
| Elevator shaft + transitions        | `scenes/elevator/*.ts`                                                                 |
| Scene hand-off (spawn / load hints) | `scenes/NavigationContext.ts`                                                          |
| Scene teardown helper               | `systems/sceneLifecycle.ts`                                                            |
| Game-state composition root         | `systems/GameStateManager.ts`                                                          |
| Player movement & animation         | `entities/Player.ts`                                                                   |
| Enemies                             | `entities/Enemy.ts`, `entities/enemies/*.ts`                                           |
| AU / tokens / progression           | `entities/Token.ts`, `entities/DroppedAU.ts`, `systems/ProgressionSystem.ts`           |
| Achievements                        | `systems/AchievementManager.ts`, `ui/AchievementsDialog.ts`                            |
| Save slots                          | `systems/SaveManager.ts`, `scenes/core/SaveSlotScene.ts`, `scenes/core/MenuScene.ts`   |
| Quiz runtime                        | `systems/QuizManager.ts`, `ui/QuizDialog.ts`, `ui/QuizResultsScreen.ts`                |
| Info modal runtime                  | `systems/InfoDialogManager.ts`, `ui/InfoDialog.ts`, `ui/DialogController.ts`           |
| Input (keyboard + touch)            | `input/*`                                                                              |
| Audio                               | `systems/AudioManager.ts`, `systems/SoundGenerator.ts` (also generates procedural lullaby), `systems/sounds/*` |
| Daily challenge                     | `systems/DailyChallenge.ts`, `systems/DailyChallengeStore.ts`, `systems/SeededRandom.ts`, `features/floors/_shared/dailyChallengeLayout.ts` |
| Procedural sprites                  | `systems/SpriteGenerator.ts`, `systems/sprites/*.ts`                                   |
| Theme tokens (colours + spacing)    | `style/theme.ts`                                                                       |
| Analytics / playtime                | `systems/Analytics.ts`, `systems/PlaytimeTracker.ts`                                   |
| Daily Challenge mode               | `systems/DailyChallenge.ts`, `systems/DailyChallengeStore.ts`, `systems/SeededRandom.ts`, `features/floors/_shared/dailyChallengeLayout.ts` (seeded layout application), `features/floors/_shared/LevelScene.ts` (result recording), `scenes/core/MenuScene.ts` (entry tile) |

## Data Flow

### Scene graph

```
BootScene  →  MenuScene  →  SaveSlotScene  →  ElevatorScene  ↔  Floor scenes (features/floors/*, incl. BossArenaScene)
                                                              ↘  product rooms (features/products/rooms/*)
```

`BootScene` loads eager static files, generates only the player sprite,
creates the `GameStateManager`, and hands off to `MenuScene`. `MenuScene`
warms up shared procedural assets after first paint. Boss/executive rescue
sprites and selected SFX are generated lazily on first scene entry.
`SaveSlotScene` is
the slot picker — every new game and continue passes through it before
reaching `ElevatorScene`. `ElevatorScene` is the central shaft; rides
transition into the floor scenes in `features/floors/<floor>/` (each a
thin wrapper around the shared `LevelScene`). The Products floor is
rendered directly by `ElevatorScene` /
`scenes/elevator/ProductDoorManager.ts` — one door per ISY product,
each door launching the corresponding
`features/products/rooms/Product*Scene.ts`.

`SettingsScene`, `ControlsScene`, and `PauseScene` are eager overlay
scenes reachable from the menu and pause menu respectively; they do not
sit in the linear flow above.

### Scene hand-off

Transitions go through `scenes/NavigationContext.ts`. Scenes call
`scene.scene.start(key, ctx)` with a typed `NavigationContext` —
spawn side, returning floor, product-door id, and the one-shot
`loadSave` flag. The old `scene.registry` spawn-state pattern is
gone.

### Persistent state

`GameStateManager` (in `systems/GameStateManager.ts`) is constructed
once in `BootScene.create()` and stashed in `scene.registry` under
the key `gameState`. It owns the `ProgressionSystem` and `PlaytimeTracker` instances and
exposes facades over the five `*Manager`/`*Store` modules (`SaveManager`,
`QuizManager`, `InfoDialogManager`, `AchievementManager`, `TouchHintStore`). Tests inject a fake `KVStorage`
into the constructor to swap localStorage atomically.

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
     ┌─────────────────┐      ┌─────────────────┐      ┌──────────────────┐
     │ ZoneManager     │      │ DialogController│      │ GameStateManager │
     └─────────────────┘      └─────────────────┘      └──────────────────┘
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
`GameEvents` interface at the top of that file is the **canonical
source of truth** — adding an event there type-checks every call site
automatically.

> **Full catalog:** see the `GameEvents` interface in
> `src/systems/EventBus.ts`. The table below mirrors every event as of
> the last sync; if they diverge, `EventBus.ts` wins.

#### `music:*` — playback control

| Event                   | Payload         | Emitters                          | Consumers            |
|-------------------------|-----------------|-----------------------------------|----------------------|
| `music:play`            | `key: string`   | Scenes, ElevatorController        | AudioManager         |
| `music:stop`            | —               | MusicPlugin                       | AudioManager         |
| `music:push`            | `key: string`   | Scenes (temp overlay)             | AudioManager         |
| `music:pop`             | —               | Scenes (restore after push)       | AudioManager         |
| `music:request`         | `key: string`   | Scenes (lazy-load then play)      | MusicPlugin          |
| `music:request-push`    | `key: string`   | Scenes (lazy-load then push)      | MusicPlugin          |
| `music:pause`           | —               | PauseScene                        | AudioManager         |
| `music:resume`          | —               | PauseScene                        | AudioManager         |

#### `audio:*` — volume / mute

| Event                   | Payload           | Emitters      | Consumers          |
|-------------------------|-------------------|---------------|--------------------|
| `audio:toggle-mute`     | —                 | Menu / HUD    | AudioManager       |
| `audio:mute-changed`    | `muted: boolean`  | AudioManager  | HUD, Menu          |
| `audio:volume-changed`  | —                 | SettingsStore | AudioManager       |

#### `ambience:*` — ambient bed

| Event            | Payload         | Emitters | Consumers    |
|------------------|-----------------|----------|--------------|
| `ambience:play`  | `key: string`   | Scenes   | AudioManager |
| `ambience:stop`  | —               | Scenes   | AudioManager |

#### `zone:*` — proximity zones

| Event        | Payload           | Emitters    | Consumers  |
|--------------|-------------------|-------------|------------|
| `zone:enter` | `zoneId: string`  | ZoneManager | Scenes, UI |
| `zone:exit`  | `zoneId: string`  | ZoneManager | Scenes, UI |

#### `sfx:*` — sound effects

| Event                | Payload | Emitters                    | Consumers    |
|----------------------|---------|-----------------------------|--------------|
| `sfx:info_open`      | —       | DialogController            | AudioManager |
| `sfx:link_click`     | —       | InfoDialog                  | AudioManager |
| `sfx:jump`           | —       | Player                      | AudioManager |
| `sfx:footstep_a`     | —       | Player                      | AudioManager |
| `sfx:footstep_b`     | —       | Player                      | AudioManager |
| `sfx:quiz_correct`   | —       | QuizDialog                  | AudioManager |
| `sfx:quiz_wrong`     | —       | QuizDialog                  | AudioManager |
| `sfx:quiz_success`   | —       | QuizDialog                  | AudioManager |
| `sfx:quiz_fail`      | —       | QuizDialog                  | AudioManager |
| `sfx:hit`            | —       | Player (damage)             | AudioManager |
| `sfx:stomp`          | —       | Enemy (stomped)             | AudioManager |
| `sfx:heartbeat`      | —       | Player (danger zone)        | AudioManager |
| `sfx:drop_au`        | —       | Player (AU dropped on hit)  | AudioManager |
| `sfx:recover_au`     | —       | Player (AU recovered)       | AudioManager |
| `sfx:coffee_sip`     | —       | Coffee                      | AudioManager |
| `sfx:fridge_open`    | —       | EnergyDrinkFridge           | AudioManager |
| `sfx:npc_greet`      | —       | LevelNpcManager             | AudioManager |
| `sfx:boss_hit`       | —       | CEOBoss                     | AudioManager |
| `sfx:boss_defeated`  | —       | TerroristCommander          | AudioManager |
| `sfx:boss_phase_2`   | —       | CEOBoss                     | AudioManager |
| `sfx:boss_phase_3`   | —       | CEOBoss                     | AudioManager |
| `sfx:mug_throw`      | —       | Player (mug projectile)     | AudioManager |
| `sfx:briefcase_throw`| —       | CEOBoss                     | AudioManager |
| `sfx:item_pickup`    | —       | MissionItem                 | AudioManager |
| `sfx:bomb_disarm`    | —       | ExecutiveSuiteScene         | AudioManager |
| `sfx:hostage_freed`  | —       | ExecutiveSuiteScene         | AudioManager |
| `sfx:pistol_shot`    | —       | CEOBoss (pistol)            | AudioManager |
| `sfx:floor_unlocked` | —       | ProgressStripController (HUD) | AudioManager |

#### `checkpoint:*` — save points

| Event                 | Payload       | Emitters | Consumers |
|-----------------------|---------------|----------|-----------|
| `checkpoint:activate` | `id: string`  | LevelScene, BossArenaScene | — |

#### `npc:*` — NPC questions

| Event                | Payload                                      | Emitters         | Consumers |
|----------------------|----------------------------------------------|------------------|-----------|
| `npc:interact`       | `{ npcId; npcName; topic }`                  | LevelNpcManager  | — |
| `npc:answer:correct` | `{ npcName; questionId }`                    | NpcDialog        | — |
| `npc:answer:wrong`   | `{ npcName; questionId }`                    | NpcDialog        | — |

#### `boss:*` — boss lifecycle

| Event               | Payload          | Emitters | Consumers     |
|---------------------|------------------|----------|---------------|
| `boss:defeated`     | —                | CEOBoss  | BossArenaScene |
| `boss:phase_changed`| `phase: number`  | CEOBoss  | BossArenaScene |

#### `buff:*` — player buffs

| Event                 | Payload               | Emitters             | Consumers    |
|-----------------------|-----------------------|----------------------|--------------|
| `buff:caffeine_start` | `durationMs: number`  | Player               | CaffeineRingController (HUD) |
| `buff:caffeine_end`   | —                     | Player               | CaffeineRingController (HUD) |

#### `persistence:*` — storage errors

| Event                | Payload                                              | Emitters       | Consumers |
|----------------------|------------------------------------------------------|----------------|-----------|
| `persistence:error`  | `storageKey: string, message: string`                | PersistedStore | HUD       |
| `persistence:failed` | `{reason: 'quota'\|'unavailable'\|'parse'\|'unknown'; detail?}` | SaveManager | HUD |

#### `pause:*` — pause menu

| Event                   | Payload | Emitters      | Consumers  |
|-------------------------|---------|---------------|------------|
| `pause:settings-closed` | —       | SettingsScene | PauseScene |

#### `progression:*` — AU / floor progression

| Event                       | Payload              | Emitters           | Consumers                          |
|-----------------------------|----------------------|--------------------|-------------------------------------|
| `progression:floor_unlocked`| `floorId: FloorId`   | ProgressionSystem  | ElevatorScene, HUD, Analytics      |
| `progression:floor_entered` | `floorId: FloorId`   | LevelScene         | Analytics                           |
| `progression:au_milestone`  | `milestone: number`  | ProgressionSystem  | HUD, Analytics                     |
| `progression:loaded`        | —                    | SettingsScene      | —                                  |

#### `achievement:*` — achievements

| Event                  | Payload                      | Emitters             | Consumers |
|------------------------|------------------------------|----------------------|-----------|
| `achievement:unlocked` | `id: string, label: string`  | GameStateManager     | HUD       |

#### `input:*` — input detection

| Event                  | Payload | Emitters      | Consumers                  |
|------------------------|---------|---------------|----------------------------|
| `input:touch_detected` | —       | VirtualGamepad | — |

#### `settings:*` — user settings

| Event              | Payload | Emitters      | Consumers                     |
|--------------------|---------|---------------|-------------------------------|
| `settings:changed` | —       | SettingsStore | VirtualGamepad, HUD, Token  |

#### `quiz:*` — quiz system

| Event                  | Payload                                                   | Emitters              | Consumers                |
|------------------------|-----------------------------------------------------------|-----------------------|--------------------------|
| `quiz:cooldown_expired`| `infoId: string`                                          | QuizDialog            | ariaLive (screen reader) |
| `quiz:completed`       | `{ infoId; score; total; passed; attemptNumber }`         | QuizResultsScreen     | Analytics                |

#### `session:*` — analytics session

| Event           | Payload                       | Emitters         | Consumers |
|-----------------|-------------------------------|------------------|-----------|
| `session:start` | `sessionId: string`           | AnalyticsService | —         |
| `session:end`   | `{ durationMs: number }`      | AnalyticsService | —         |

#### `game:*` — run lifecycle

| Event           | Payload | Emitters       | Consumers  |
|-----------------|---------|----------------|------------|
| `game:completed`| —       | BossArenaScene | Analytics  |

#### `boot:*` — boot sequence

| Event              | Payload                                       | Emitters  | Consumers               |
|--------------------|-----------------------------------------------|-----------|-------------------------|
| `boot:reset`       | —                                             | BootScene | MusicPlugin             |
| `boot:asset-error` | `{ key: string; type: string; url: string }`  | BootScene | MusicPlugin             |

## Testing

- **Unit tests** (`npm run test:unit`) live next to their sources as
  `*.test.ts` and run in jsdom under Vitest. They cover pure
  systems (`src/systems/**`, `src/input/**`), config barrels
  (`src/config/info`, `src/config/quiz`), entities
  (`src/entities/**`), UI widgets (`src/ui/**`), and select
  scene/feature helpers.
- **End-to-end tests** (`npm test`) drive the real game via
  Playwright (`menu`, `elevator`, `floors`, `tokens`, `quiz`,
  `progression`, `visual`).
- **Type safety** (`npm run build`) runs `tsc` strict before Vite
  bundles.
- **Coverage thresholds** (`vitest.config.ts`): `src/systems/**` and
  `src/input/**` at 80%; `src/ui/**` at 65% (60% branches);
  `src/entities/**` at 60%; `src/scenes/**` at 20% (18% functions);
  `src/features/floors/**` at 25% (20% branches, 25% functions, 25% statements).
  `src/plugins/**`, `src/main.ts`, the procedural-generator modules
  (`src/systems/SpriteGenerator.ts`, `src/systems/sprites/**`,
  `src/systems/SoundGenerator.ts`, `src/systems/sounds/**`), and a
  small list of UI files
  (`src/ui/{ElevatorButtons,InfoDialog,InfoIcon,ModalBase,QuizDialog,QuizResultsScreen,ControlHintsOverlay,touchPrimary}.ts`)
  are excluded entirely from coverage.

## Key design choices

- **Procedural assets.** No image files. Boot keeps first paint fast by
  generating only critical assets eagerly (player + shared SFX/music path)
  and defers boss/rescue + coffee/fridge subsets via `ensure*` helpers in
  `SpriteGenerator.ts` / `SoundGenerator.ts`.
- **Event-driven coupling.** Systems don't hold references to each
  other; they publish and subscribe through `eventBus`. Audio is a
  pure subscriber.
- **Pluggable storage.** `SaveManager` exposes a `KVStorage`
  interface so tests can swap in an in-memory store without
  monkey-patching `localStorage`. `GameStateManager` forwards that
  interface to the other four stores in its constructor.
- **Single composition root for game state.** `GameStateManager` is
  the only thing that knows how the persistent stores fit
  together. Scenes and UI read from it; tests replace it.
- **Typed scene hand-off.** `NavigationContext` collects every
  cross-scene field in one optional-everything interface. No registry
  spelunking; no per-scene "data" shapes.
- **Uniform scene teardown.** `createSceneLifecycle(scene)` gives
  every scene one disposer list that fires on both `shutdown` and
  `destroy`. Adoption is in progress — the pattern is the target for
  all scenes.
- **Config as data.** `src/config/` owns constants, floor metadata,
  barrel re-exports of per-floor content. The authored quiz + info
  text lives alongside its scene under `src/features/floors/`.
- **One file per floor.** Each floor's owner edits
  `features/floors/<floor>/{Scene,info,quiz[,enemies]}.ts`. Merge
  hotspots are gone.
- **Centralised theme tokens.** `style/theme.ts` owns the colour and
  spacing catalogue; both numeric (`0x…`) and CSS (`#…`) forms are
  co-located so Phaser graphics and Text styles share the same
  source of truth.
- **Eager/lazy scene split.** Core/elevator scenes are bundled in the
  main chunk (`EAGER_REGISTRY` in `sceneRegistry.ts`); floor, product-room,
  and boss scenes are split into separate Vite chunks and fetched on demand
  via `LAZY_SCENE_LOADERS` in `lazySceneLoaders.ts` (built from the internal
  `LOADERS` array — that is the edit target). The elevator fade acts as the
  loading screen.
