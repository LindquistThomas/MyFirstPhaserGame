import * as Phaser from 'phaser';
import type { FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import { Toast } from './Toast';
import { announce } from './ariaLive';

const LOCKED_TOAST_DURATION_MS = 2_000;

function formatLockedFloorMessage(floorId: FloorId, requiredAu: number, currentAu: number): string {
  const floorName = LEVEL_DATA[floorId]?.name ?? `Floor ${floorId}`;
  return `${floorName} locked — need ${requiredAu} AU (you have ${currentAu}/${requiredAu})`;
}

export class ElevatorLockedToast {
  private readonly toast: Toast;

  constructor(private readonly scene: Phaser.Scene) {
    this.toast = new Toast(scene);
    this.scene.scopedEvents.on('ui:locked-floor-attempted', ({ floorId, requiredAu, currentAu }) => {
      const message = formatLockedFloorMessage(floorId, requiredAu, currentAu);
      this.toast.show(message, LOCKED_TOAST_DURATION_MS);
      announce(message);
    });
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private destroy(): void {
    this.toast.destroy();
  }
}

export { formatLockedFloorMessage, LOCKED_TOAST_DURATION_MS };
