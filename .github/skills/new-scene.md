# Skill: New Scene

## Purpose

Add a new Phaser scene. Every distinct screen or gameplay area is its own scene.

For a playable **floor** (platforming level with tokens, enemies, info points), prefer extending `LevelScene` — see the "New floor" variant at the bottom.

## Convention

- Infrastructure scenes live in `src/scenes/`; product content scenes live in `src/features/products/{hall,rooms}/`.
- Filename = exported class name in PascalCase, suffixed with `Scene` (e.g. `LobbyScene.ts`).
- The string passed to `super(...)` is the scene **key** and must be unique. By convention it matches the class name.

## Template

Create one of:

- `src/scenes/<Name>Scene.ts` for infrastructure scenes.
- `src/features/products/hall/<Name>Scene.ts` or `src/features/products/rooms/<Name>Scene.ts` for product content scenes.

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

1. Register the scene in `src/main.ts`:
    ```ts
    import { NameScene } from './scenes/NameScene';
    // …
    scene: [BootScene, MenuScene, ElevatorScene, /* …, */ NameScene],
    ```
   Product content scenes import from `./features/products/hall/...` or `./features/products/rooms/...`.
2. If the scene has background music, add it to `SCENE_MUSIC` in `src/config/audioConfig.ts`:
   ```ts
   NameScene: 'music_floor2',
   ```
   `MusicPlugin` will start/stop it automatically on scene transitions.
3. Transition into the scene with `this.scene.start('NameScene')`. Elevator-driven transitions go through `ElevatorScene`.

## New floor variant

Floors extend `LevelScene` and declare their content as a `LevelConfig`:

```ts
import { LevelScene } from './LevelScene';

export class MyFloorScene extends LevelScene {
  constructor() {
    super('MyFloorScene', {
      floorId: FLOORS.MY_FLOOR,
      platforms: [/* … */],
      tokens:    [/* … */],
      enemies:   [{ type: 'slime', x: 400, y: 700, minX: 300, maxX: 600, speed: 60 }],
      infoPoints:[{ id: 'my-info-card', x: 800, y: 700 /*, zoneRadius?: number */ }],
    });
  }
}
```

Then add a `LEVEL_DATA` entry in `src/config/levelData.ts` (unlock cost, label, theme) and register the scene in `main.ts`.

## Conventions checklist

- Load assets in `BootScene`, not in the new scene.
- Clean up EventBus subscriptions on `shutdown` (see `src/systems/EventBus.ts`).
- Zone-gated UI starts hidden; reveal it via `zone:enter`.
- Don't reference raw keycodes — use `GameAction`s through `scene.inputs`.
