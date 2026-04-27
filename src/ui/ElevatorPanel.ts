import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FloorId, COLORS } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { eventBus } from '../systems/EventBus';

/** Height of each floor button row (px). Tall enough to fit the AU-needed hint. */
const BTN_H = 55;
/** Vertical gap between rows (px). */
const BTN_GAP = 6;

/** Fully-opaque alpha when no overlap. */
const ALPHA_NORMAL = 1.0;
/** Reduced alpha when the player is behind the panel. */
const ALPHA_DIM = 0.25;
/** Duration of the fade tween (ms). */
const FADE_DURATION = 150;

export class ElevatorPanel {
  private scene: Phaser.Scene;
  private progression: ProgressionSystem;
  private container!: Phaser.GameObjects.Container;
  private isVisible = false;
  private onSelectCallback: (floorId: FloorId) => void;
  /** True while the panel is faded due to player overlap. */
  private isFaded = false;
  private fadeTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    progression: ProgressionSystem,
    onSelect: (floorId: FloorId) => void
  ) {
    this.scene = scene;
    this.progression = progression;
    this.onSelectCallback = onSelect;

    this.buildContainer();

    // Refresh the button list whenever a new floor is unlocked.
    const onUnlock = () => { this.rebuildButtons(); };
    eventBus.on('progression:floor_unlocked', onUnlock);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      eventBus.off('progression:floor_unlocked', onUnlock);
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  show(): void {
    this.isVisible = true;
    this.rebuildButtons();
    this.container.setVisible(true);
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    // Reset fade state so next show() starts fully opaque.
    this.fadeTween?.stop();
    this.fadeTween = undefined;
    this.isFaded = false;
    this.container.setAlpha(ALPHA_NORMAL);
  }

  toggle(): void {
    if (this.isVisible) this.hide();
    else this.show();
  }

  /**
   * Call each frame while the panel is visible.
   * Fades the panel to {@link ALPHA_DIM} when the player's screen-space
   * position overlaps the panel bounds, and restores full opacity when they
   * move clear. Uses a short tween so the transition isn't jarring.
   *
   * @param playerScreenX  Player x in screen (viewport) coordinates.
   * @param playerScreenY  Player y in screen (viewport) coordinates.
   */
  update(playerScreenX: number, playerScreenY: number): void {
    if (!this.isVisible) return;

    const px = this.container.x;
    const py = this.container.y;
    const pw = this.panelWidth;
    const ph = this.panelHeight;

    // Add padding so the panel fades smoothly as the player approaches.
    // Horizontal: equal padding on both sides.
    // Vertical: pad the top edge only — padding below the panel would trigger
    // the fade when the player walks on the lobby floor beneath it.
    const PAD_H = 16;
    const PAD_TOP = 16;
    const overlaps =
      playerScreenX >= px - PAD_H && playerScreenX <= px + pw + PAD_H &&
      playerScreenY >= py - PAD_TOP && playerScreenY <= py + ph;

    if (overlaps && !this.isFaded) {
      this.isFaded = true;
      this.fadeTween?.stop();
      this.fadeTween = this.scene.tweens.add({
        targets: this.container,
        alpha: ALPHA_DIM,
        duration: FADE_DURATION,
        ease: 'Sine.easeOut',
      });
    } else if (!overlaps && this.isFaded) {
      this.isFaded = false;
      this.fadeTween?.stop();
      this.fadeTween = this.scene.tweens.add({
        targets: this.container,
        alpha: ALPHA_NORMAL,
        duration: FADE_DURATION,
        ease: 'Sine.easeOut',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Floors displayed top-to-bottom, sorted by AU requirement descending so the
   * hardest-to-reach (highest) floors appear first — matching the building's
   * visual stacking order. Equal-requirement floors fall back to FloorId
   * descending so the ordering stays stable.
   */
  private get sortedFloors(): FloorId[] {
    return (Object.values(LEVEL_DATA) as { id: FloorId; auRequired: number }[])
      .sort((a, b) => b.auRequired - a.auRequired || b.id - a.id)
      .map(f => f.id);
  }

  /** Create the outer container and panel chrome (background + title). */
  private buildContainer(): void {
    const panelX = GAME_WIDTH / 2 - this.panelWidth / 2;
    const panelY = GAME_HEIGHT - this.panelHeight - 60;

    this.container = this.scene.add.container(panelX, panelY);
    this.container.setDepth(60);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    this.redrawChrome();
  }

  private get panelWidth(): number { return 200; }

  private get panelHeight(): number {
    const rows = this.sortedFloors.length;
    return 45 + rows * (BTN_H + BTN_GAP) + 10;
  }

  /** Draw the panel background and title. Called once from buildContainer(). */
  private redrawChrome(): void {
    const { panelWidth, panelHeight } = this;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.9);
    bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 8);
    bg.lineStyle(2, 0x00d4ff, 0.5);
    bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 8);
    this.container.addAt(bg, 0);

    const title = this.scene.add.text(panelWidth / 2, 12, 'ELEVATOR', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: COLORS.titleText,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.addAt(title, 1);
  }

  /**
   * Destroy and recreate all floor button rows so the panel always reflects
   * the current unlock state. Keeps the chrome (bg + title) at indices 0–1.
   */
  private rebuildButtons(): void {
    // Remove all children except the two chrome items (bg at 0, title at 1).
    const toRemove = this.container.list.slice(2) as Phaser.GameObjects.GameObject[];
    toRemove.forEach(child => child.destroy());

    const { panelWidth } = this;
    let yOffset = 45;

    for (const floorId of this.sortedFloors) {
      const floorData = LEVEL_DATA[floorId];
      const isUnlocked = this.progression.isFloorUnlocked(floorId);

      const btnContainer = this.scene.add.container(10, yOffset);

      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(isUnlocked ? 0x1a3a5a : 0x3a1a1a, 0.8);
      btnBg.fillRoundedRect(0, 0, panelWidth - 20, BTN_H, 4);
      btnContainer.add(btnBg);

      // Floor number
      const floorNum = this.scene.add.text(10, 4, `F${floorData.floorNumber}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: isUnlocked ? '#00d4ff' : '#ff4444',
        fontStyle: 'bold',
      });
      btnContainer.add(floorNum);

      // Floor name
      const floorName = this.scene.add.text(10, 22, floorData.name, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: isUnlocked ? '#aabbcc' : '#664444',
      });
      btnContainer.add(floorName);

      if (!isUnlocked) {
        // "X AU needed" hint for locked floors.
        const auNeeded = this.progression.getAUNeededForFloor(floorId);
        const hint = this.scene.add.text(10, 38, `${auNeeded} AU needed`, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#995555',
        });
        btnContainer.add(hint);
      }

      // Status indicator (right-aligned)
      const statusText = isUnlocked ? '▶' : '🔒';
      const status = this.scene.add.text(panelWidth - 40, 14, statusText, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: isUnlocked ? '#53a653' : '#8b0000',
      });
      btnContainer.add(status);

      // Make interactive only when unlocked.
      if (isUnlocked) {
        const hitArea = this.scene.add.rectangle(
          (panelWidth - 20) / 2, BTN_H / 2, panelWidth - 20, BTN_H
        ).setInteractive({ useHandCursor: true });
        hitArea.setAlpha(0.001);
        btnContainer.add(hitArea);

        hitArea.on('pointerover', () => {
          btnBg.clear();
          btnBg.fillStyle(0x2a5a8a, 0.9);
          btnBg.fillRoundedRect(0, 0, panelWidth - 20, BTN_H, 4);
        });

        hitArea.on('pointerout', () => {
          btnBg.clear();
          btnBg.fillStyle(0x1a3a5a, 0.8);
          btnBg.fillRoundedRect(0, 0, panelWidth - 20, BTN_H, 4);
        });

        hitArea.on('pointerdown', () => {
          this.onSelectCallback(floorId);
        });
      }

      this.container.add(btnContainer);
      yOffset += BTN_H + BTN_GAP;
    }
  }
}
