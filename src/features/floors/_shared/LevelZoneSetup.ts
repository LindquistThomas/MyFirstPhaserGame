import * as Phaser from 'phaser';
import { QUIZ_DATA } from '../../../config/quiz';
import { Player } from '../../../entities/Player';
import { InfoIcon } from '../../../ui/InfoIcon';
import { DialogController } from '../../../ui/DialogController';
import { ZoneManager } from '../../../systems/ZoneManager';
import { createSceneLifecycle } from '../../../systems/sceneLifecycle';
import { GameStateManager } from '../../../systems/GameStateManager';
import type { LevelConfig } from './LevelScene';

const DEFAULT_ZONE_RADIUS = 120;

/** Spatial representation of a zone for debug overlay rendering. */
export type DebugZone =
  | { id: string; shape: 'rect'; x: number; y: number; width: number; height: number; active: boolean }
  | { id: string; shape: 'circle'; x: number; y: number; radius: number; active: boolean };

export interface ZoneSetupDeps {
  scene: Phaser.Scene;
  player: Player;
  dialogs: DialogController;
  gameState: GameStateManager;
}

/**
 * Turns `LevelConfig.infoPoints` into runtime proximity zones. Owns the
 * per-level ZoneManager and the `contentId → InfoIcon` mapping so
 * dialogs and quiz-badge refreshes can target specific zones.
 */
export class LevelZoneSetup {
  readonly zoneManager = new ZoneManager();
  readonly iconsByContentId = new Map<string, InfoIcon>();
  /** Spatial shape per zone id — used by the debug overlay to draw bounds. */
  private readonly debugShapes = new Map<string, DebugZone>();

  constructor(private readonly deps: ZoneSetupDeps) {}

  create(config: LevelConfig): void {
    if (!config.infoPoints?.length) return;

    const lifecycle = createSceneLifecycle(this.deps.scene);
    lifecycle.add(() => this.zoneManager.clear());
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
        icon.setQuizBadge(this.deps.scene, this.deps.gameState.isQuizPassed(ip.contentId));
      }
      this.iconsByContentId.set(ip.contentId, icon);

      const check = this.buildZoneCheck(ip);
      this.zoneManager.register(ip.contentId, check);
      this.debugShapes.set(ip.contentId, this.buildDebugShape(ip));
    }
  }

  update(): void {
    this.zoneManager.update();
  }

  clear(): void {
    this.zoneManager.clear();
    this.iconsByContentId.clear();
    this.debugShapes.clear();
  }

  getActiveZone(): string | null {
    return this.zoneManager.getActiveZone();
  }

  /** Snapshot of zone shapes + active state for the debug overlay. */
  getDebugZones(): DebugZone[] {
    const activeId = this.zoneManager.getActiveZone();
    const out: DebugZone[] = [];
    for (const shape of this.debugShapes.values()) {
      out.push({ ...shape, active: shape.id === activeId });
    }
    return out;
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

  private buildDebugShape(
    ip: NonNullable<LevelConfig['infoPoints']>[number],
  ): DebugZone {
    if (ip.zone?.shape === 'rect') {
      const w = ip.zone.width;
      const h = ip.zone.height;
      const offsetY = ip.zone.offsetY ?? -h / 2;
      return {
        id: ip.contentId,
        shape: 'rect',
        x: ip.x - w / 2,
        y: ip.y + offsetY - h / 2,
        width: w,
        height: h,
        active: false,
      };
    }
    const radius = ip.zone?.shape === 'circle'
      ? ip.zone.radius
      : (ip.zoneRadius ?? DEFAULT_ZONE_RADIUS);
    return { id: ip.contentId, shape: 'circle', x: ip.x, y: ip.y, radius, active: false };
  }
}
