import * as Phaser from 'phaser';
import { QUIZ_DATA } from '../../config/quiz';
import { Player } from '../../entities/Player';
import { InfoIcon } from '../../ui/InfoIcon';
import { DialogController } from '../../ui/DialogController';
import { ZoneManager } from '../../systems/ZoneManager';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import { isQuizPassed } from '../../systems/QuizManager';
import type { LevelConfig } from './LevelScene';

const DEFAULT_ZONE_RADIUS = 120;

export interface ZoneSetupDeps {
  scene: Phaser.Scene;
  player: Player;
  dialogs: DialogController;
}

/**
 * Turns `LevelConfig.infoPoints` into runtime proximity zones. Owns the
 * per-level ZoneManager and the `contentId → InfoIcon` mapping so
 * dialogs and quiz-badge refreshes can target specific zones.
 */
export class LevelZoneSetup {
  readonly zoneManager = new ZoneManager();
  readonly iconsByContentId = new Map<string, InfoIcon>();

  constructor(private readonly deps: ZoneSetupDeps) {}

  create(config: LevelConfig): void {
    if (!config.infoPoints?.length) return;

    const lifecycle = createSceneLifecycle(this.deps.scene);
    lifecycle.bindEventBus('zone:enter', (zoneId) => {
      this.iconsByContentId.get(zoneId)?.setVisible(true);
    });
    lifecycle.bindEventBus('zone:exit', (zoneId) => {
      this.iconsByContentId.get(zoneId)?.setVisible(false);
    });

    for (const ip of config.infoPoints) {
      const icon = new InfoIcon(this.deps.scene, 210, 22, () => {
        this.deps.dialogs.open(ip.contentId);
      }, ip.contentId);
      icon.setVisible(false);
      if (QUIZ_DATA[ip.contentId]) {
        icon.setQuizBadge(this.deps.scene, isQuizPassed(ip.contentId));
      }
      this.iconsByContentId.set(ip.contentId, icon);

      const check = this.buildZoneCheck(ip);
      this.zoneManager.register(ip.contentId, check);
    }
  }

  update(): void {
    this.zoneManager.update();
  }

  clear(): void {
    this.zoneManager.clear();
    this.iconsByContentId.clear();
  }

  getActiveZone(): string | null {
    return this.zoneManager.getActiveZone();
  }

  private buildZoneCheck(
    ip: NonNullable<LevelConfig['infoPoints']>[number],
  ): () => boolean {
    const body = () => this.deps.player.sprite;
    if (ip.zone?.shape === 'rect') {
      const w = ip.zone.width;
      const h = ip.zone.height;
      const offsetY = ip.zone.offsetY ?? -h / 2;
      const rect = new Phaser.Geom.Rectangle(
        ip.x - w / 2,
        ip.y + offsetY - h / 2,
        w,
        h,
      );
      return () => Phaser.Geom.Rectangle.Contains(rect, body().x, body().y);
    }
    const radius = ip.zone?.shape === 'circle'
      ? ip.zone.radius
      : (ip.zoneRadius ?? DEFAULT_ZONE_RADIUS);
    return () => Phaser.Math.Distance.Between(body().x, body().y, ip.x, ip.y) < radius;
  }
}
