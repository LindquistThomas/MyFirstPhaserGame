## Enemies & Obstacles (Phase 2)

Add enemies and environmental hazards to floor levels to create gameplay challenge.

### Proposed Enemy Types

- **Legacy Code Bugs** — moving enemies that patrol platforms, player must avoid or jump over
- **Bureaucracy Walls** — barriers that require a certain AU threshold to pass
- **Meeting Traps** — timed zones that slow the player down when entered

### Implementation Notes

- Enemies should use Phaser Arcade Physics with simple AI (patrol, chase)
- Each floor could have themed enemies (e.g., Platform Team gets "Docker Containers" that stack, Cloud Team gets "Latency Ghosts")
- Collision with enemies could cost AU or send player back to elevator
- Create base `Enemy` class in `src/entities/Enemy.ts` with subclasses per type

### Acceptance Criteria

- [ ] At least one enemy type per floor
- [ ] Enemy contact has a consequence (lose AU / respawn)
- [ ] Enemies have idle/patrol animations
- [ ] Enemies are placed via level config (same pattern as platforms/tokens)
