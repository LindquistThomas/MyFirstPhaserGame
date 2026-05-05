import * as Phaser from 'phaser';
import { allKeyLabels } from '../../../input';
import { Npc, type NpcConfig } from '../../../entities/Npc';
import { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { eventBus } from '../../../systems/EventBus';
import type { DialogController } from '../../../ui/DialogController';
import { NpcDialog } from '../../../ui/NpcDialog';
import type { LevelConfig } from './LevelScene';
import type { FloorId } from '../../../config/gameConfig';

export interface LevelNpcManagerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  progression: ProgressionSystem;
  player: { sprite: Phaser.Physics.Arcade.Sprite };
  platformGroup: Phaser.Physics.Arcade.StaticGroup;
  dialogs: DialogController;
  prompt?: Phaser.GameObjects.Text;
}

export class LevelNpcManager {
  readonly npcs: Npc[] = [];
  private activeNpc?: Npc;

  constructor(private readonly deps: LevelNpcManagerDeps) {}

  spawn(config: LevelConfig): void {
    if (!config.npcs?.length) return;
    for (const npcConfig of config.npcs) {
      const npc = new Npc(this.deps.scene, npcConfig);
      this.npcs.push(npc);
    }
  }

  wireColliders(): void {
    if (this.npcs.length === 0) return;
    this.deps.scene.physics.add.collider(this.npcs, this.deps.platformGroup);
  }

  update(time: number, delta: number): boolean {
    for (const npc of this.npcs) npc.update(time, delta);
    const nearest = this.findNearestNpc();
    this.activeNpc = nearest;
    if (!nearest) return false;

    this.deps.prompt?.setText(`Press ${allKeyLabels('Interact')} → Ask ${nearest.displayName}`).setPosition(
      nearest.x - 86,
      nearest.y - 150,
    ).setVisible(true);

    if (this.deps.scene.inputs.justPressed('Interact') && !this.deps.dialogs.isOpen) {
      eventBus.emit('npc:interact', { npcId: nearest.id, npcName: nearest.displayName, topic: nearest.topic });
      eventBus.emit('sfx:npc_greet');
      this.deps.dialogs.openCustom((onClose) => {
        new NpcDialog(this.deps.scene, {
          npcName: nearest.displayName,
          topic: nearest.topic,
          floorId: this.deps.floorId,
          progression: this.deps.progression,
          onClose,
        });
      });
    }

    return true;
  }

  getActiveNpc(): Npc | undefined {
    return this.activeNpc;
  }

  private findNearestNpc(): Npc | undefined {
    let best: Npc | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    const player = this.deps.player.sprite;
    for (const npc of this.npcs) {
      if (!npc.isPlayerNearby(player)) continue;
      const dist = Phaser.Math.Distance.Between(npc.x, npc.y, player.x, player.y);
      if (dist < bestDist) {
        best = npc;
        bestDist = dist;
      }
    }
    return best;
  }
}

export type { NpcConfig };
