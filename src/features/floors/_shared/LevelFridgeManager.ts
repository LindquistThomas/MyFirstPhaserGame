import * as Phaser from 'phaser';
import { EnergyDrinkFridge, ENERGY_DRINK_DURATION_MS } from '../../../entities/EnergyDrinkFridge';
import { Player } from '../../../entities/Player';
import { eventBus } from '../../../systems/EventBus';
import { isReducedMotion } from '../../../systems/MotionPreference';
import { ensureCoffeeFridgeSounds } from '../../../systems/SoundGenerator';
import { allKeyLabels } from '../../../input';
import { theme } from '../../../style/theme';
import type { LevelConfig } from './LevelScene';

/** Radius (px) within which the interact prompt appears. */
const PROXIMITY_RADIUS = 80;

/** Label shown in the interact prompt. */
const FRIDGE_ITEM_NAME = 'Energy Drink';

/** Horizontal px to shift the prompt left of the fridge centre. */
const PROMPT_OFFSET_X = -80;
/** Vertical px to shift the prompt above the fridge top edge. */
const PROMPT_OFFSET_Y = -36;

export interface FridgeManagerDeps {
  scene: Phaser.Scene;
  player: Player;
}

/**
 * Manages energy drink fridges in a level scene.
 *
 * - Spawns one {@link EnergyDrinkFridge} per entry in `config.fridges`.
 * - Each frame checks proximity to the player. When close enough, shows
 *   an interact prompt. Pressing the `Interact` action opens the fridge,
 *   applies a long caffeine buff, and emits `sfx:fridge_open`.
 * - Fridges are scene-local (no persistence) and respawn on re-entry.
 */
export class LevelFridgeManager {
  private fridges: EnergyDrinkFridge[] = [];
  private prompt: Phaser.GameObjects.Text;
  private coldBurstEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly deps: FridgeManagerDeps) {
    this.prompt = deps.scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: theme.color.css.textWarn,
        backgroundColor: theme.color.css.bgDialog,
        padding: { x: theme.space.sm, y: theme.space.xs },
      })
      .setDepth(20)
      .setVisible(false);
    this.coldBurstEmitter = this.createColdBurstEmitter();
    const destroyEmitter = (): void => {
      const emitter = this.coldBurstEmitter;
      this.coldBurstEmitter = undefined;
      emitter?.destroy();
    };
    deps.scene.events.once('shutdown', destroyEmitter);
    deps.scene.events.once('destroy', destroyEmitter);
  }

  spawn(config: LevelConfig): void {
    if (!config.fridges?.length) return;
    ensureCoffeeFridgeSounds(this.deps.scene);
    for (const f of config.fridges) {
      this.fridges.push(new EnergyDrinkFridge(this.deps.scene, f.x, f.y));
    }
  }

  update(): void {
    const player = this.deps.player.sprite;
    let nearFridge: EnergyDrinkFridge | null = null;

    for (const fridge of this.fridges) {
      if (fridge.opened) continue;
      const d = Phaser.Math.Distance.Between(player.x, player.y, fridge.x, fridge.y);
      if (d < PROXIMITY_RADIUS) {
        nearFridge = fridge;
        break;
      }
    }

    if (nearFridge) {
      this.prompt
        .setText(`Press ${allKeyLabels('Interact')} \u2192 ${FRIDGE_ITEM_NAME}`)
        .setPosition(nearFridge.x + PROMPT_OFFSET_X, nearFridge.y - nearFridge.displayHeight + PROMPT_OFFSET_Y)
        .setVisible(true);

      if (this.deps.scene.inputs.justPressed('Interact')) {
        this.openFridge(nearFridge);
      }
    } else {
      this.prompt.setVisible(false);
    }
  }

  private openFridge(fridge: EnergyDrinkFridge): void {
    fridge.open();
    this.prompt.setVisible(false);
    this.deps.player.applyCaffeine(ENERGY_DRINK_DURATION_MS);
    eventBus.emit('sfx:fridge_open');
    this.emitColdBurst(fridge.x, fridge.y);
  }

  /** Particle burst of icy blue-green motes when the fridge opens. */
  private emitColdBurst(x: number, y: number): void {
    if (isReducedMotion()) return;
    this.coldBurstEmitter?.emitParticleAt(x, y - 30, 10);
  }

  private createColdBurstEmitter(): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    const scene = this.deps.scene;
    if (isReducedMotion()) return undefined;
    if (!scene.textures.exists('particle')) return undefined;
    const emitter = scene.add.particles(0, 0, 'particle', {
      speed: { min: 30, max: 100 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 550,
      gravityY: 60,
      tint: 0x00ffaa,
      emitting: false,
    });
    emitter.setDepth(11);
    return emitter;
  }
}
