import * as Phaser from 'phaser';
import { DialogController } from '../../../ui/DialogController';
import { InfoIcon } from '../../../ui/InfoIcon';
import { GameStateManager } from '../../../systems/GameStateManager';

/**
 * Build a DialogController with the standard level bindings: badge refresh
 * on close, unseen-mark on open, icon lookup by content id. Separate from
 * LevelScene so the wiring can be reused if other scenes need a
 * content-dialog surface.
 */
export function createLevelDialogs(
  scene: Phaser.Scene,
  opts: {
    gameState: GameStateManager;
    getIcon: (contentId: string) => InfoIcon | undefined;
  },
): DialogController {
  return new DialogController(scene, {
    progression: opts.gameState.progression,
    getIconForContent: opts.getIcon,
    onOpen: (id) => opts.gameState.markSeen(id),
    onClose: (id) => {
      // Dialog was just read — switch the icon (if still visible in its
      // zone) from the eye-catching "unseen" animation to the subtle pulse.
      opts.getIcon(id)?.markAsSeen();
    },
  });
}
