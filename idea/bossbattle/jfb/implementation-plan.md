# Implementation Plan — F4 Executive Hostage Rescue ("Die Hard Mode")

> Companion to `F4-executive-hostage-feature.md` in this folder.

---

## 1. Problem Statement

The Executive Suite (F4, `FLOORS.EXECUTIVE`) currently has platforms, tokens,
enemies, and a Finance door — but no narrative arc. We want a Die Hard–inspired
hostage rescue layer: the C-suite is held captive by an external threat, the
player collects three mission-critical items (Pistol, Security Key Card, Bomb
Deactivation Code), disarms a bomb, defeats a boss-type enemy, and frees the
leadership for bonus AU.

---

## 2. Approach Overview

The feature is **additive** — it layers on top of the existing
`ExecutiveSuiteScene` layout and LevelScene infrastructure.  No changes to
`LevelScene` base mechanics are required if we model the three collectible items
as scene-local pickups (like Coffee) and gate progression via scene state rather
than `ProgressionSystem` persistence.  The bomb disarm is a zone-gated
interactive dialog.  The boss is a new enemy subclass.

### Key design decisions

| Decision | Choice |
| --- | --- |
| Persist rescue progress across reloads? | **No** — scene-local like enemies/coffees. Restarting the scene resets the rescue. Keeps SaveData unchanged. |
| New enemy type for boss? | **Yes** — `TerroristCommander` under `src/entities/enemies/`. Non-stompable, patrols, higher knockback. |
| Bomb disarm mechanic | Zone-gated interact → short timed-button UI (hold Interact while indicator passes target zone). |
| Item pickup model | New `MissionItem` entity (extends Phaser.Physics.Arcade.Sprite). 3 instances placed in LevelConfig-like data inside the scene. Overlap with player → collect. |
| HUD for collected items | Small icon row in top-right of HUD (3 slots: grey → lit). Scene-local UI, not in the shared HUD component. |
| Inner sanctum gate | Existing door pattern (like Finance door) but locked until all 3 items + bomb disarmed + boss defeated. |
| Leadership rescue | Info-dialog with thank-you text + bonus AU award via `progression.addAU()`. |

---

## 3. Todos

### Phase 1 — Foundation

#### 1.1 Create `TerroristCommander` enemy class
- **File**: `src/entities/enemies/TerroristCommander.ts`
- Extends `Enemy`. `canBeStomped = false`. Higher `hitCost` (2).
  Non-standard defeat: call a public `defeat()` that plays a surrender
  animation (hands-up tween → fade) instead of the stomp squash.
- Patrol pattern: horizontal bounce between `minX`/`maxX` like other enemies.
  Slightly faster than Slime, larger sprite.
- Add `'terrorist'` to the `type` union in `LevelConfig.enemies` (in
  `LevelScene.ts`).
- Add a `case 'terrorist'` in `LevelEnemySpawner.spawn()`.
- Generate sprite in `SpriteGenerator` (or a new family file under
  `src/systems/sprites/`).

#### 1.2 Create `MissionItem` entity
- **File**: `src/entities/MissionItem.ts`
- Extends `Phaser.Physics.Arcade.Sprite`. Static body, glow tween.
- Constructor: `(scene, x, y, texture, itemId: 'pistol' | 'keycard' | 'bomb_code')`.
- Picked up on overlap with player → emits callback → destroyed.
- Sprites generated procedurally (pistol = grey + barrel, keycard = small
  rectangle, bomb_code = green data pad).

#### 1.3 Add sprites for new entities
- `SpriteGenerator`: add `enemy_terrorist`, `item_pistol`, `item_keycard`,
  `item_bomb_code`, `bomb_device`, `door_sanctum_locked`, `door_sanctum_open`.
- Keep it in existing sprite family files or create `src/systems/sprites/missionItems.ts`.

#### 1.4 Add SFX events
- **EventBus** (`GameEvents`):
  - `'sfx:item_pickup'` — picking up a mission item
  - `'sfx:bomb_disarm'` — bomb successfully disarmed
  - `'sfx:boss_defeated'` — terrorist commander defeated
  - `'sfx:hostage_freed'` — leadership rescued
- Wire into `SFX_EVENTS` in `audioConfig.ts`.
- Sound generators under `src/systems/sounds/`.

### Phase 2 — Scene Integration

#### 2.1 Extend `ExecutiveSuiteScene` with rescue state
- Add private scene-local state:
  ```ts
  private rescueState = {
    collected: new Set<'pistol' | 'keycard' | 'bomb_code'>(),
    bombDisarmed: false,
    bossDefeated: false,
    leadershipFreed: false,
  };
  ```
- Reset on every `create()` — no persistence.

#### 2.2 Place mission items in the scene
- Pistol: on a high catwalk or moving platform (hard to reach).
- Key Card: near the terrorist's patrol zone (risky pickup).
- Bomb Code: behind a small platforming puzzle on the mezzanine.
- Create overlap collider with player → collect → update `rescueState`.

#### 2.3 Place bomb device
- Visual: `bomb_device` sprite near the inner sanctum door.
- Zone-gated: register a `'bomb-zone'` in `ZoneManager`.
- When player enters zone AND has `bomb_code` → show interact prompt.
- On interact: open a timed mini-game (hold Interact while indicator sweeps — 
  release in the green zone). Success → `bombDisarmed = true`, emit
  `'sfx:bomb_disarm'`.  Failure → minor damage, retry.

#### 2.4 Boss encounter
- Place `TerroristCommander` via the enemy array in `getLevelConfig()`.
- **Defeat condition**: player must have Pistol collected.  When player has
  Pistol and stomps/overlaps the boss from above, instead of the normal damage
  path, call `commander.defeat()`.  (Alternative: auto-defeat when all 3 items
  are collected — simpler.)
- On defeat: `bossDefeated = true`, emit `'sfx:boss_defeated'`.

#### 2.5 Inner sanctum door
- Add a second door entry in `ExecutiveSuiteScene.DOORS` or a custom locked
  door sprite.
- Door locked until `rescueState` fully complete (all 3 items + bomb + boss).
- Visual: shows padlock overlay when locked, open texture when unlocked.
- On interact (unlocked): transition to rescue cutscene or show an
  info-dialog with leadership thank-you text + award bonus AU.

#### 2.6 Mission HUD overlay
- Small UI in top-right: 3 icon slots (pistol / keycard / code).
- Grey when uncollected, coloured when collected.
- Bomb status indicator (red → green).
- Scene-local (created in `ExecutiveSuiteScene.create()`, not in shared HUD).

### Phase 3 — Content & Polish

#### 3.1 Info dialog content for leadership rescue
- Add an info entry in `src/features/floors/executive/info.ts` with
  `contentId: 'executive-hostage-rescued'`.
- Text: leadership thanks, flavor about organizational resilience.

#### 3.2 Achievement
- Add `'hostage-rescue'` to `AchievementId` union and `ACHIEVEMENTS` array.
- Label: "Die Hard". Description: "Rescue the C-suite leadership."
- Secret achievement (hidden until unlocked).
- Trigger in `ExecutiveSuiteScene` after `leadershipFreed = true`.

#### 3.3 Audio
- Tension music variant for the Executive Suite during active rescue
  (before completion). Could be a second `SCENE_MUSIC` entry or a
  `music:push` on scene entry when rescue is incomplete.
- Victory chime / fanfare on leadership freed.

#### 3.4 Bomb-disarm mini-game UI
- Small overlay panel (like QuizDialog but simpler).
- Indicator bar sweeps left→right. Green target zone in the middle.
- Player holds Interact to "lock in" — if indicator is in the green zone on
  release, success. 2-3 second sweep. Visual feedback (flash red/green).

### Phase 4 — Testing

#### 4.1 Unit tests
- `TerroristCommander.test.ts` — patrol bounds, non-stompable, defeat().
- `MissionItem.test.ts` — pickup callback, destroy on collect.
- `ExecutiveSuiteScene` rescue state transitions (mock scene).

#### 4.2 Playwright tests (opt-in)
- Navigate to Executive Suite with full save.
- Collect items, disarm bomb, defeat boss, enter sanctum.
- Verify achievement toast and AU award.

---

## 4. Dependency Graph

```
1.1 TerroristCommander ──┐
1.2 MissionItem ──────────┤
1.3 Sprites ──────────────┼──▶ 2.1 Scene rescue state ──▶ 2.2 Place items
1.4 SFX events ───────────┘                            ──▶ 2.3 Bomb device
                                                       ──▶ 2.4 Boss encounter
                                                       ──▶ 2.5 Inner sanctum door
                                                       ──▶ 2.6 Mission HUD

2.2–2.6 ──▶ 3.1 Info content
         ──▶ 3.2 Achievement
         ──▶ 3.3 Audio
         ──▶ 3.4 Bomb UI

3.* ──▶ 4.1 Unit tests
     ──▶ 4.2 Playwright tests
```

---

## 5. Risk & Considerations

- **Scope**: This is a large feature. Consider shipping Phase 1+2 as a first
  PR, then Phase 3+4 as follow-ups.
- **SaveData**: Intentionally NOT persisted — rescue resets on scene re-entry.
  If we later want persistence, extend `SaveData` and bump
  `CURRENT_SAVE_VERSION`.
- **Boss balance**: `TerroristCommander` should be challenging but fair.
  Start with hitCost=2, speed=100, and tune after playtesting.
- **Bomb mini-game**: Keep it simple (timed bar). Over-engineering the UI
  risks scope creep (ironic).
- **Existing scene layout**: The Executive Suite has limited horizontal space
  (10 tiles ground + 4-tile mezzanine). Items and bomb need to fit without
  cluttering the existing layout. May need to extend the world width or add
  more catwalks.
