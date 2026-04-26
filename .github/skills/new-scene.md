# Skill: New Scene

## Purpose

Add a new Phaser scene. Every distinct screen or gameplay area is its own scene.

For a playable **floor** (platforming level with tokens, enemies, info points), prefer extending `LevelScene` — see the "New floor" variant at the bottom.

## Convention

- Infrastructure scenes live under `src/scenes/` (subdivided into `core/` for Boot/Menu and `elevator/` for the lift).
- Floor scenes live under `src/features/floors/<floor>/` and extend `LevelScene`.
- Product content scenes live under `src/features/products/rooms/`.
- Filename = exported class name in PascalCase, suffixed with `Scene` (e.g. `MenuScene.ts`).
- The string passed to `super(...)` is the scene **key** and must be unique. By convention it matches the class name.

## Template

Create one of:

- `src/scenes/core/<Name>Scene.ts` or `src/scenes/elevator/<Name>Scene.ts` for infrastructure scenes.
- `src/features/floors/<floor>/<Name>TeamScene.ts` for a floor (use the "New floor variant" below).
- `src/features/products/rooms/<Name>Scene.ts` for product content scenes.

```ts
import * as Phaser from 'phaser';

export class NameScene extends Phaser.Scene {
  constructor() {
    super('NameScene');
  }

  create(): void {
    // Build the scene. Assets should already be loaded by BootScene.
    // Register zones / input / UI here.
    this.events.once('shutdown', () => {
      // Unsubscribe any EventBus handlers here.
    });
  }

  update(_time: number, _delta: number): void {
    // Per-frame logic (zoneManager.update(), entity updates, …).
  }
}
```

## Integration

1. Register the scene in `src/scenes/sceneRegistry.ts` (the single source of truth — `main.ts` is no longer the touchpoint):
    ```ts
    import { NameScene } from './core/NameScene';
    // …
    export const SCENE_REGISTRY: ReadonlyArray<SceneRegistration> = [
      // …existing entries…
      { key: 'NameScene', cls: NameScene },
    ];
    ```
   Floor scenes import from `'../features/floors/<floor>/...'`; product content scenes import from `'../features/products/rooms/...'`.
   `validateSceneRegistry()` runs at boot in dev and will fail loudly if `LEVEL_DATA` keys or `SCENE_MUSIC` keys are not found in the registry.
2. If the scene has background music, add it to `SCENE_MUSIC` in `src/config/audioConfig.ts`:
   ```ts
   NameScene: 'music_floor2',
   ```
   `MusicPlugin` will start/stop it automatically on scene transitions.
3. Transition into the scene with `this.scene.start('NameScene')`. Elevator-driven transitions go through `ElevatorScene`.

## New floor variant

Floors live under `src/features/floors/<floor>/<Name>TeamScene.ts`, extend `LevelScene`, and declare their content as a `LevelConfig`:

```ts
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { FLOORS } from '../../../config/gameConfig';

export class MyFloorTeamScene extends LevelScene {
  constructor() {
    super('MyFloorTeamScene', FLOORS.MY_FLOOR);
  }

  protected override getLevelConfig(): LevelConfig {
    return {
      floorId: FLOORS.MY_FLOOR,
      platforms: [/* … */],
      tokens:    [/* … */],
      roomElevators: [],
      playerStart: { x: 120, y: 700 },
      exitPosition: { x: 80, y: 700 },
      enemies:   [{ type: 'slime', x: 400, y: 700, minX: 300, maxX: 600, speed: 60 }],
      infoPoints:[{ contentId: 'my-info-card', x: 800, y: 700,
                    zone: { shape: 'circle', radius: 120 } }],
    };
  }
}
```

Then add a `LEVEL_DATA` entry in `src/config/levelData.ts` (unlock cost, label, theme) and add a `{ key: 'MyFloorTeamScene', cls: MyFloorTeamScene }` entry to `SCENE_REGISTRY` in `src/scenes/sceneRegistry.ts`.

## Conventions checklist

- Load assets in `BootScene`, not in the new scene.
- Clean up EventBus subscriptions on `shutdown` (see `src/systems/EventBus.ts`).
- Zone-gated UI starts hidden; reveal it via `zone:enter`.
- Don't reference raw keycodes — use `GameAction`s through `scene.inputs`.
