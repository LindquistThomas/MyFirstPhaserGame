import * as Phaser from 'phaser';
import { InfoIcon } from '../ui/InfoIcon';
import { QUIZ_DATA } from '../config/quizData';
import { isQuizPassed } from './QuizManager';

export interface ZoneDefinition {
  contentId: string;
  /**
   * Called each frame. Return true when the player is considered inside this zone.
   * Decoupled from bounds type so callers can use physics state, proximity,
   * rectangle overlap, or any other condition.
   */
  check: () => boolean;
}

/**
 * Manages a set of named content zones.
 *
 * Each zone owns one InfoIcon that is visible only while the player is inside
 * the zone. Call update() every frame; it refreshes all icons and returns the
 * contentId of the first active zone (or null when the player is in none).
 *
 * Usage:
 *   const mgr = new ZoneManager();
 *   mgr.register({ contentId: 'my-topic', check: () => playerNearby }, icon);
 *   // in update():
 *   const active = mgr.update();    // null | contentId
 */
export class ZoneManager {
  private zones: Array<{ def: ZoneDefinition; icon: InfoIcon }> = [];

  /**
   * Register a zone. The icon starts hidden; update() controls its visibility.
   */
  register(def: ZoneDefinition, icon: InfoIcon): void {
    icon.setVisible(false);
    this.zones.push({ def, icon });
  }

  /**
   * Refresh visibility of every registered icon.
   * Returns the contentId of the first zone the player is currently in,
   * or null if the player is outside all zones.
   */
  update(): string | null {
    let activeContentId: string | null = null;

    for (const { def, icon } of this.zones) {
      const inZone = def.check();
      icon.setVisible(inZone);
      if (inZone && activeContentId === null) {
        activeContentId = def.contentId;
      }
    }

    return activeContentId;
  }

  /**
   * Refresh the quiz badge on the icon for a given contentId.
   * Safe to call when the contentId is not registered.
   */
  refreshBadge(scene: Phaser.Scene, contentId: string): void {
    const zone = this.zones.find(z => z.def.contentId === contentId);
    if (zone && QUIZ_DATA[contentId]) {
      zone.icon.setQuizBadge(scene, isQuizPassed(contentId));
    }
  }

  /**
   * Drop all zones. Should be called when the scene shuts down if you want
   * to explicitly clean up (Phaser will also destroy the game objects itself).
   */
  clear(): void {
    this.zones = [];
  }
}
