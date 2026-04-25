import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { primaryKeyLabel, type GameAction } from '../input';
import { createSceneLifecycle } from '../systems/sceneLifecycle';

/** A single control hint chip shown to the player. */
interface HintChip {
  action: GameAction;
  label: string;
  container: Phaser.GameObjects.Container;
  dismissed: boolean;
}

const HINT_DISMISS_MS = 30_000;

/**
 * Transient control-hints overlay displayed in the lobby when a player
 * enters for the first time.
 *
 * Four chips explain the core controls:
 *   ← → Move  |  Space Jump  |  ↑ Open info  |  Enter Interact
 *
 * Each chip dismisses individually as soon as the matching action fires,
 * or all chips dismiss automatically after {@link HINT_DISMISS_MS} ms.
 *
 * Attach via `new ControlHintsOverlay(scene)` during `create()`; call
 * `update()` every frame while gameplay is running.
 */
export class ControlHintsOverlay {
  private readonly scene: Phaser.Scene;
  private readonly chips: HintChip[] = [];
  private timer: Phaser.Time.TimerEvent | null = null;
  private dismissed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildChips();
    this.startDismissTimer();

    // Auto-destroy on scene shutdown
    const lifecycle = createSceneLifecycle(scene);
    lifecycle.add(() => this.destroy());
  }

  /** Call once per frame (only while no dialog is open). */
  update(): void {
    if (this.dismissed) return;
    this.checkActionDismissals();
  }

  destroy(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.timer?.remove();
    this.timer = null;
    for (const chip of this.chips) {
      if (!chip.dismissed) this.dismissChip(chip, false);
    }
  }

  private buildChips(): void {
    const hints: Array<{ action: GameAction; label: string }> = [
      { action: 'MoveLeft',   label: `\u2190 \u2192  Move` },
      { action: 'Jump',       label: `${primaryKeyLabel('Jump')}  Jump` },
      { action: 'ToggleInfo', label: `${primaryKeyLabel('ToggleInfo')}  Info` },
      { action: 'Interact',   label: `${primaryKeyLabel('Interact')}  Interact` },
    ];

    const chipW = 130;
    const chipH = 36;
    const gap = 14;
    const totalW = hints.length * chipW + (hints.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = GAME_HEIGHT - 100;

    for (let i = 0; i < hints.length; i++) {
      const h = hints[i];
      if (!h) continue;
      const x = startX + i * (chipW + gap) + chipW / 2;

      const bg = this.scene.add.graphics();
      bg.fillStyle(theme.color.bg.dark, 0.82);
      bg.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 6);
      bg.lineStyle(1, 0x3388aa, 0.7);
      bg.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 6);

      const text = this.scene.add.text(0, 0, h.label, {
        fontFamily: 'monospace', fontSize: '13px',
        color: '#ccddee', fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.scene.add.container(x, y, [bg, text])
        .setDepth(90)
        .setScrollFactor(0);

      this.chips.push({ action: h.action, label: h.label, container, dismissed: false });
    }
  }

  private checkActionDismissals(): void {
    for (const chip of this.chips) {
      if (chip.dismissed) continue;
      // MoveLeft/MoveRight share the same visual hint; dismiss on either.
      const fired =
        chip.action === 'MoveLeft'
          ? this.scene.inputs.justPressed('MoveLeft') || this.scene.inputs.justPressed('MoveRight')
          : this.scene.inputs.justPressed(chip.action);
      if (fired) this.dismissChip(chip, true);
    }

    // Once all chips are dismissed, tear down the overlay.
    if (this.chips.every(c => c.dismissed)) this.destroy();
  }

  private dismissChip(chip: HintChip, animate: boolean): void {
    chip.dismissed = true;
    if (!animate) {
      chip.container.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: chip.container,
      alpha: 0,
      y: chip.container.y - 12,
      duration: 300,
      ease: 'Sine.easeOut',
      onComplete: () => chip.container.destroy(),
    });
  }

  private startDismissTimer(): void {
    this.timer = this.scene.time.delayedCall(HINT_DISMISS_MS, () => this.destroy());
  }
}
