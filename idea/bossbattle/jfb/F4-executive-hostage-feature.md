# F4 Executive Hostage Rescue Feature

**Status**: Design phase  
**Inspired by**: Die Hard (hostage rescue on top floor)  
**Related Floor**: Executive Suite (F4)

---

## Feature Overview

The Executive Suite (F4) is under siege by an **external terrorist threat**. The C-suite leadership is held hostage. The player must navigate the floor, collect three critical items, disable an active bomb, and defeat the threat to liberate the leadership and progress.

### Core Objective
- Rescue the C-suite leadership held hostage by an external threat
- Unlock access to the inner sanctum where leadership is held
- Defeat/neutralize the threat
- Reward: +AU and progression to next level

---

## Player Flow

```
1. Enter Executive Suite (F4)
   ↓
2. Discover leadership is held hostage (dialogue/visual hint)
   ↓
3. Collect 3 required items scattered across the floor:
     - Pistol (weapon)
     - Security Key Card
     - Bomb Deactivation Code (or device)
   ↓
4. Navigate past/around the Terrorist Guard
   ↓
5. Disable the bomb (interactive puzzle)
   ↓
6. Confront the threat / Open the inner sanctum
   ↓
7. Free the leadership (cutscene/dialogue)
   ↓
8. Receive AU reward & proceed
```

---

## Three Collectable Items

### 1. **Pistol** (weapon)
- **Location**: Scattered on challenging platforms (e.g., high catwalk, moving platform sequence)
- **Visual**: Procedurally generated or simple pixel gun sprite
- **Purpose**: Grants player ability to shoot / disable the threat from distance
- **Interaction**: Walk over it or press Interact to equip

### 2. **Security Key Card**
- **Location**: In a zone near the terrorist's patrol route (risky to retrieve)
- **Visual**: Small glowing card / key sprite
- **Purpose**: Unlocks the inner sanctum door where leadership is held
- **Interaction**: Press Interact when nearby

### 3. **Bomb Deactivation Code** (or Device)
- **Location**: Hidden in a separate sub-puzzle area (e.g., locked safe, guarded by enemy)
- **Visual**: Glowing data pad, digital code display, or physical detonator mockup
- **Purpose**: Disarms the active bomb on the floor
- **Interaction**: Interactive dialogue / puzzle to input the code or press sequence

**Status Tracking**:
- HUD shows collected items (visual checklist or icon bar)
- Once all 3 are collected, inner sanctum door becomes accessible
- Bomb can be disarmed once Code is obtained

---

## Enemy: The Terrorist Threat

### **Threat Type**
- **Name**: TBD (e.g., "TerroristCommander", "HostageTaker", "ExternalThreat")
- **Appearance**: Distinct from Slime/Bot/ScopeCreep enemies (e.g., armored, distinct color)
- **Behavior**:
  - Patrols a fixed horizontal zone in front of the inner sanctum
  - Shoots projectiles at the player (or deals damage on collision)
  - **Non-stompable** (requires weapon or puzzle solution to defeat)
  - Health bar visible when near
  
### **Defeat Mechanic** (pick one or combine):
- **Option A**: Player must equip Pistol and engage in combat (shoot/dodge)
- **Option B**: Disarm Bomb first → Threat is distracted/stunned
- **Option C**: Collect all 3 items → Threat surrenders or is "authorized" away
- **Recommendation**: Hybrid — collect all 3 items + use Pistol to "intimidate" or "disable" the threat

---

## Bomb Disarming (Interactive Puzzle)

### **Mechanic**
- Once Deactivation Code is collected, player can approach the bomb
- Press Interact to open a mini-dialog / UI panel
- **Simple variant**: "Enter the 4-digit code" — press arrow keys and Enter
- **Visual variant**: "Cut the correct wire" — a Minesweeper-style grid or pattern match
- **Timing variant**: "Hold the button while the indicator passes the target zone" (Quicktime-ish)

### **Outcome**
- Success: Bomb disarmed, threat is weakened or distracted
- Failure: Minor damage or reset (retry available)

---

## Inner Sanctum & Leadership Rescue

### **Door/Gate**
- Appears as locked gate blocking access to the inner sanctum
- **Unlock requirement**: All 3 items collected + Threat defeated/distracted
- Opens with a brief animation or chime sound

### **Leadership Cutscene**
- Brief dialogue from the C-suite:
  - "Thank you, architect. You have saved the leadership."
  - "This level has been secured. New floors await."
  - Flavor text about the organization's resilience

### **Reward**
- **AU**: +5 or +10 (strategic tier, high-value floor)
- **Achievement**: "Hostage Rescue" or "Die Hard Mode"
- **Progression**: Unlock next floor or bonus content

---

## Integration with Existing Systems

### **LevelConfig Extensions**
```typescript
{
  floorId: FLOORS.EXECUTIVE,
  name: 'Executive Suite',
  // ... existing fields ...
  
  // New fields for hostage mechanic
  collectedItems: ['pistol', 'keycard', 'bomb_code'],  // tracked in ProgressionSystem
  terroristPosition: { x: 1000, y: 800 },
  bombPosition: { x: 640, y: 850 },
  innerSanctumDoor: { x: 1080, y: 800 },
}
```

### **Persistent State**
- Track collected items in `ProgressionSystem` under `executiveRescueProgress`
- Save bomb-disarmed status
- Save threat-defeated status

### **EventBus Events** (new)
- `hostage:item_collected` — fired when a collectable is picked up
- `hostage:bomb_disarmed` — fired when bomb is successfully disarmed
- `hostage:threat_defeated` — fired when threat is neutralized
- `hostage:leadership_freed` — fired on final unlock & cutscene trigger

### **New Enemy Type** (if not using existing)
- Extend `Enemy` class → `TerroristCommander` or similar
- Non-stompable, projectile-based, higher health

---

## Visual / Audio Hints

- **Sirens / Alarm Ambience**: Low background siren or tension music in the Executive Suite
- **Red Warning Light**: Pulsing light near the bomb
- **Guard Patrol Animation**: Distinctive walking pose or weapon-drawn animation
- **Item Highlights**: Subtle glow or shimmer on collectables
- **HUD Feedback**: Show item count / bomb status in top-right

---

## Difficulty & Balancing

- **Item Placement**: Ensure collectables are **challenging but not impossible** to reach
- **Guard Patrol**: Patrol path gives player a **timing window** to move safely
- **Bomb Puzzle**: Difficulty can scale (easy: memorize a code; hard: timed challenge)
- **Boss Health**: Balanced so Pistol + dodging = winnable in ~10-15 seconds

---

## Open Questions / Design Decisions

1. **Is the Threat truly a "boss" fight, or more a timed obstacle?**
   - Full combat arena or scripted "intimidate → unlock" moment?

2. **Should collecting all items auto-open the door, or do we need explicit bomb-disarm?**
   - Full collection → door opens automatically?
   - Or: collection + puzzle completion + combat = full unlock?

3. **What is the Threat's motivation / backstory?**
   - Espionage? Sabotage? Random terrorism?
   - Should there be dialogue before/during confrontation?

4. **Retry mechanism**
   - If player dies or fails bomb disarm, do they restart the scene or respawn at a checkpoint?

5. **Accessibility**
   - Is bomb disarm a mandatory combat encounter, or can it be skipped with enough tokens?

---

## Next Steps

1. **Design Decision**: Resolve open questions above
2. **Create ExecutiveSuiteScene v2**: Add collectable items, bomb, terrorist enemy
3. **Implement ProgressionSystem extension**: Track hostage-rescue state
4. **Create Terrorist Enemy class**: Define behavior and combat rules
5. **Add Bomb Interactive Puzzle**: UI + logic
6. **Create Cutscene / Leadership Dialogue**: End-of-floor reward sequence
7. **Testing**: Vitest + Playwright for item collection, combat, bomb puzzle
8. **Audio / Music**: Tension cue for active bomb, victory chime on rescue
