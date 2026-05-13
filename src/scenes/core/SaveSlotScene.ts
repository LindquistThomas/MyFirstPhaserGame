import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../../config/gameConfig';
import { LEVEL_DATA } from '../../config/levelData';
import {
  SAVE_SLOTS,
  SaveSlotId,
  SlotInfo,
  loadSlotInfo,
  clearSlot,
  setPlayerSlot,
  getRecoveryReason,
} from '../../systems/SaveManager';
import type { GameStateManager } from '../../systems/GameStateManager';
import { pushContext, popContext } from '../../input';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import type { NavigationContext } from '../NavigationContext';
import { SaveRecoveryDialog } from '../../ui/SaveRecoveryDialog';
import { ButtonListNavigator } from '../../ui/ButtonListNavigator';
import { setDailyState } from '../../systems/DailyChallenge';
import type { GameMode } from '../../systems/GameMode';

/**
 * Slot-picker screen.
 *
 * Shows three save-slot cards (slot1 / slot2 / slot3). Each card displays
 * total AU, the floor name, and last-played timestamp — or "NEW GAME" when the
 * slot has no save. Keyboard / pointer navigation lets the player:
 *   - Select a slot → switches playerSlot and starts a new or continued game.
 *   - Press Delete (X key) on a filled slot → delete-confirmation overlay.
 *   - Press Back (Esc / B) → return to MenuScene without changing the slot.
 *
 * Called from MenuScene via `scene.start('SaveSlotScene')`.
 */
export class SaveSlotScene extends Phaser.Scene {
  private slotInfos: SlotInfo[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private cardBounds: Phaser.Geom.Rectangle[] = [];
  private selectedIndex = 0;
  private cardNavigator?: ButtonListNavigator;
  private confirmOverlay?: Phaser.GameObjects.Container;
  private confirmYes?: Phaser.GameObjects.Text;
  private confirmNo?: Phaser.GameObjects.Text;
  private confirmIndex = 0; // 0 = Yes, 1 = No
  private inConfirm = false;
  private actionOverlay?: Phaser.GameObjects.Container;
  private actionOptions: Array<{ label: string; loadSave: boolean; startMode?: GameMode }> = [];
  private actionIndex = 0;
  private inActionSelect = false;
  /** True while the SaveRecoveryDialog is open; gates scene-level input handlers. */
  private inRecoveryDialog = false;

  constructor() {
    super({ key: 'SaveSlotScene' });
  }

  create(): void {
    this.slotInfos = SAVE_SLOTS.map((id) => loadSlotInfo(id));
    this.cards = [];
    this.cardBounds = [];
    this.selectedIndex = 0;
    this.cardNavigator?.destroy();
    this.cardNavigator = undefined;
    this.inConfirm = false;
    this.inActionSelect = false;

    this.drawBackground();
    this.drawTitle();
    this.drawCards();
    this.setupCardNavigator();
    this.drawFooter();
    this.setupKeyboard();
    this.updateHighlight();

    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Show a one-shot recovery dialog if any slot had its corrupt save discarded.
    // Shown AFTER the slot cards are drawn so the player can see the RECOVERED
    // badge beneath the modal.
    this.maybeShowRecoveryDialog();
  }

  // -------------------------------------------------------------------------
  // Layout

  private drawBackground(): void {
    this.add.graphics().fillStyle(0x05060f, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private drawTitle(): void {
    this.add.text(GAME_WIDTH / 2, 60, 'SELECT SAVE SLOT', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10)
      .setShadow(0, 0, '#0099cc', 14, true, true);
  }

  private drawCards(): void {
    const cardW = 260;
    const cardH = 160;
    const gapX = 40;
    const totalW = SAVE_SLOTS.length * cardW + (SAVE_SLOTS.length - 1) * gapX;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardY = GAME_HEIGHT / 2 - cardH / 2;

    SAVE_SLOTS.forEach((id, i) => {
      const info = this.slotInfos[i]!;
      const x = startX + i * (cardW + gapX);
      const container = this.buildCard(x, cardY, cardW, cardH, i + 1, info);
      this.cards.push(container);
      this.cardBounds.push({ x, y: cardY, width: cardW, height: cardH } as Phaser.Geom.Rectangle);
    });
  }

  private buildCard(
    x: number,
    y: number,
    w: number,
    h: number,
    slotNumber: number,
    info: SlotInfo,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(5);

    // Background rect
    const bg = this.add.graphics();
    bg.fillStyle(0x12162a, 1);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(2, 0x2a3050, 1);
    bg.strokeRect(0, 0, w, h);
    container.add(bg);

    // Slot label
    const label = this.add.text(w / 2, 16, `SLOT ${slotNumber}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: COLORS.titleText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(label);

    if (info.exists) {
      const au = info.totalAU ?? 0;
      const ts = info.lastPlayedAt
        ? new Date(info.lastPlayedAt).toLocaleDateString()
        : '—';

      container.add(this.add.text(w / 2, 50, `${au} AU`, {
        fontFamily: 'monospace', fontSize: '22px', color: '#33ff99',
      }).setOrigin(0.5));

      const floorName = info.currentFloor !== undefined
        ? (LEVEL_DATA[info.currentFloor]?.name ?? '—')
        : '—';

      container.add(this.add.text(w / 2, 80, `Floor: ${floorName}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#9fb1c8',
      }).setOrigin(0.5));

      container.add(this.add.text(w / 2, 102, ts, {
        fontFamily: 'monospace', fontSize: '12px', color: '#5e6e85',
      }).setOrigin(0.5));

      if ((info.bossDefeatedCount ?? 0) >= 1) {
        container.add(this.add.text(w / 2, 122, 'NG+ AVAILABLE', {
          fontFamily: 'monospace', fontSize: '11px', color: '#ffd700', fontStyle: 'bold',
        }).setOrigin(0.5));
      }

      // Delete hint
      container.add(this.add.text(w / 2, h - 16, '[ X ] Delete', {
        fontFamily: 'monospace', fontSize: '11px', color: '#ff4466',
      }).setOrigin(0.5));
    } else {
      const badge = info.recovered ? 'RECOVERED' : 'NEW GAME';
      const badgeColor = info.recovered ? '#ffaa00' : '#3a4460';
      container.add(this.add.text(w / 2, h / 2, badge, {
        fontFamily: 'monospace', fontSize: '20px', color: badgeColor,
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    // Pointer interactivity
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerover', () => {
      this.cardNavigator?.setFocus(slotNumber - 1);
    });
    bg.on('pointerdown', () => {
      this.cardNavigator?.setFocus(slotNumber - 1);
      this.cardNavigator?.activateFocused();
    });

    return container;
  }

  private drawFooter(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '← → / A D: Select  |  Enter: Choose  |  X: Delete  |  Esc / B: Back', {
      fontFamily: 'monospace', fontSize: '13px', color: '#7a8aa3',
    }).setOrigin(0.5).setDepth(5);
  }

  /**
   * If any slot had its corrupt save discarded this session, open a recovery
   * dialog for the FIRST such slot. Subsequent slots will show the "RECOVERED"
   * badge but the player must dismiss the dialog before seeing them.
   * Single-shot per session: `SaveRecoveryDialog.onAfterClose` calls
   * `clearRecoveredSlot` so revisiting this scene doesn't reopen the dialog.
   *
   * `inRecoveryDialog` gates scene-level Confirm/Cancel/navigate handlers while
   * the modal is open so a single key press can't simultaneously close the dialog
   * and activate a slot.
   */
  private maybeShowRecoveryDialog(): void {
    const recovered = this.slotInfos.find((info) => info.recovered);
    if (!recovered) return;
    const reason = getRecoveryReason(recovered.slotId);
    this.inRecoveryDialog = true;
    new SaveRecoveryDialog(this, recovered.slotId, reason, () => {
      this.inRecoveryDialog = false;
    });
  }

  // -------------------------------------------------------------------------
  // Input

  private setupKeyboard(): void {
    const token = pushContext('modal');
    const lc = createSceneLifecycle(this);
    lc.add(() => popContext(token));
    lc.bindInput('NavigateLeft',  () => this.navigate(-1));
    lc.bindInput('NavigateRight', () => this.navigate(1));
    lc.bindInput('NavigateUp',    () => this.navigate(-1));
    lc.bindInput('NavigateDown',  () => this.navigate(1));
    lc.bindInput('Confirm',       () => this.confirmAction());
    lc.bindInput('Cancel',        () => this.goBack());

    // X key → delete selected slot (direct keyboard listener, no InputService action)
    const xKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    if (xKey) {
      const onXDown = () => { if (!this.inConfirm) this.tryDelete(); };
      xKey.on('down', onXDown);
      lc.add(() => xKey.off('down', onXDown));
    }
  }

  private navigate(delta: number): void {
    if (this.inRecoveryDialog) return;
    if (this.inActionSelect) {
      const n = this.actionOptions.length;
      if (n === 0) return;
      this.actionIndex = (this.actionIndex + delta + n) % n;
      this.refreshActionHighlight();
      return;
    }
    if (this.inConfirm) {
      this.confirmIndex = (this.confirmIndex + delta + 2) % 2;
      this.refreshConfirmHighlight();
      return;
    }
    if (!this.cardNavigator) return;
    if (delta > 0) this.cardNavigator.focusNext();
    else this.cardNavigator.focusPrev();
  }

  private confirmAction(): void {
    if (this.inRecoveryDialog) return;
    if (this.inActionSelect) {
      this.executeActionSelection();
      return;
    }
    if (this.inConfirm) {
      if (this.confirmIndex === 0) this.executeDelete();
      else this.closeConfirm();
      return;
    }
    this.activateSelected();
  }

  private setupCardNavigator(): void {
    this.cardNavigator = new ButtonListNavigator(this, 45);
    this.cards.forEach((_card, index) => {
      this.cardNavigator?.add({
        focus: () => {
          this.selectedIndex = index;
          this.updateHighlight();
        },
        blur: () => undefined,
        activate: () => {
          this.selectedIndex = index;
          this.activateSelected();
        },
        bounds: () => this.cardBounds[index] ?? ({ x: 0, y: 0, width: 0, height: 0 } as Phaser.Geom.Rectangle),
      });
    });
    this.cardNavigator.setFocus(this.selectedIndex);
  }

  private tryDelete(): void {
    if (this.inConfirm || this.inActionSelect) return;
    const info = this.slotInfos[this.selectedIndex];
    if (!info?.exists) return;
    this.openDeleteConfirm();
  }

  // -------------------------------------------------------------------------
  // Actions

  private activateSelected(): void {
    const info = this.slotInfos[this.selectedIndex]!;
    if (!info.exists) {
      this.startSelectedSlot({ loadSave: false, startMode: 'normal' });
      return;
    }
    this.openActionPicker(info);
  }

  private startSelectedSlot(selection: { loadSave: boolean; startMode?: GameMode }): void {
    const slotId = SAVE_SLOTS[this.selectedIndex]!;
    setDailyState(this.registry, null);
    setPlayerSlot(slotId);
    // Reset the initial-load guard so ElevatorScene re-applies the correct
    // save (or fresh state) for this slot selection.
    (this.registry.get('gameState') as GameStateManager).resetLoadState();
    const ctx: NavigationContext = {
      loadSave: selection.loadSave,
      startMode: selection.startMode,
    };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => this.scene.start('ElevatorScene', ctx));
  }

  private goBack(): void {
    if (this.inRecoveryDialog) return;
    if (this.inActionSelect) { this.closeActionPicker(); return; }
    if (this.inConfirm) { this.closeConfirm(); return; }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => this.scene.start('MenuScene'));
  }

  private openActionPicker(info: SlotInfo): void {
    this.inActionSelect = true;
    this.actionIndex = 0;
    this.actionOptions = [
      { label: '[ CONTINUE ]', loadSave: true },
      { label: '[ NEW GAME ]', loadSave: false, startMode: 'normal' },
    ];
    if ((info.bossDefeatedCount ?? 0) >= 1) {
      this.actionOptions.push({ label: '[ NEW GAME+ ]', loadSave: false, startMode: 'ngplus' });
    }

    const ow = 460;
    const oh = 200;
    const ox = (GAME_WIDTH - ow) / 2;
    const oy = (GAME_HEIGHT - oh) / 2;
    const overlay = this.add.container(0, 0).setDepth(50);
    const blocker = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.45,
    ).setInteractive({ useHandCursor: false });
    blocker.on('pointerdown', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); });
    blocker.on('pointerup', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); });
    blocker.on('pointermove', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); });
    overlay.add(blocker);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d1c, 0.95);
    bg.fillRect(ox, oy, ow, oh);
    bg.lineStyle(2, 0x33d6ff, 1);
    bg.strokeRect(ox, oy, ow, oh);
    overlay.add(bg);

    overlay.add(this.add.text(ox + ow / 2, oy + 24, 'SELECT MODE', {
      fontFamily: 'monospace', fontSize: '20px', color: '#33d6ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    overlay.add(this.add.text(ox + ow / 2, oy + 50, 'New Game and New Game+ reset slot progress.', {
      fontFamily: 'monospace', fontSize: '12px', color: '#9fb1c8',
    }).setOrigin(0.5));

    this.actionOptions.forEach((option, idx) => {
      const t = this.add.text(ox + ow / 2, oy + 92 + idx * 34, option.label, {
        fontFamily: 'monospace', fontSize: '18px', color: '#9fb1c8',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { this.actionIndex = idx; this.refreshActionHighlight(); });
      t.on('pointerdown', () => {
        this.actionIndex = idx;
        this.executeActionSelection();
      });
      overlay.add(t);
    });

    this.actionOverlay = overlay;
    this.refreshActionHighlight();
  }

  private refreshActionHighlight(): void {
    if (!this.actionOverlay) return;
    let optionCursor = 0;
    for (const child of this.actionOverlay.list) {
      if (typeof child !== 'object' || child === null) continue;
      if (!('text' in child) || typeof child.text !== 'string') continue;
      if (!child.text.startsWith('[')) continue;
      const active = optionCursor === this.actionIndex;
      (child as Phaser.GameObjects.Text).setColor(active ? '#ffffff' : '#9fb1c8');
      optionCursor++;
    }
  }

  private executeActionSelection(): void {
    const selection = this.actionOptions[this.actionIndex];
    if (!selection) return;
    this.closeActionPicker();
    this.startSelectedSlot(selection);
  }

  private closeActionPicker(): void {
    this.inActionSelect = false;
    this.actionOptions = [];
    this.actionOverlay?.destroy();
    this.actionOverlay = undefined;
  }

  // -------------------------------------------------------------------------
  // Highlight

  private updateHighlight(): void {
    const BORDER_NORMAL   = 0x2a3050;
    const BORDER_SELECTED = 0x33d6ff;

    this.cards.forEach((container, i) => {
      const bg = container.list[0] as Phaser.GameObjects.Graphics;
      const w = 260, h = 160;
      bg.clear();
      bg.fillStyle(i === this.selectedIndex ? 0x1a2244 : 0x12162a, 1);
      bg.fillRect(0, 0, w, h);
      bg.lineStyle(2, i === this.selectedIndex ? BORDER_SELECTED : BORDER_NORMAL, 1);
      bg.strokeRect(0, 0, w, h);
    });
  }

  // -------------------------------------------------------------------------
  // Delete confirmation overlay

  private openDeleteConfirm(): void {
    this.inConfirm = true;
    this.confirmIndex = 1; // default to "No"
    this.cardNavigator?.hideRing();

    const ow = 340, oh = 140;
    const ox = (GAME_WIDTH - ow) / 2;
    const oy = (GAME_HEIGHT - oh) / 2;

    // Full-screen dimming blocker — prevents pointer events reaching slot cards behind the overlay
    const overlay = this.add.container(0, 0).setDepth(50);
    const blocker = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.45,
    ).setInteractive({ useHandCursor: false });
    blocker.on('pointerdown', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); });
    blocker.on('pointerup',   (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); });
    blocker.on('pointermove', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); });
    overlay.add(blocker);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d1c, 0.95);
    bg.fillRect(ox, oy, ow, oh);
    bg.lineStyle(2, 0xff4466, 1);
    bg.strokeRect(ox, oy, ow, oh);
    overlay.add(bg);

    const slotNum = this.selectedIndex + 1;
    overlay.add(this.add.text(ox + ow / 2, oy + 22, `Delete Slot ${slotNum}?`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ff4466', fontStyle: 'bold',
    }).setOrigin(0.5));

    overlay.add(this.add.text(ox + ow / 2, oy + 52, 'This cannot be undone.', {
      fontFamily: 'monospace', fontSize: '13px', color: '#9fb1c8',
    }).setOrigin(0.5));

    this.confirmYes = this.add.text(ox + ow / 2 - 60, oy + 90, '[ YES ]', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ff4466',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.confirmYes.on('pointerdown', () => this.executeDelete());
    this.confirmYes.on('pointerover', () => { this.confirmIndex = 0; this.refreshConfirmHighlight(); });
    overlay.add(this.confirmYes);

    this.confirmNo = this.add.text(ox + ow / 2 + 60, oy + 90, '[ NO ]', {
      fontFamily: 'monospace', fontSize: '16px', color: '#9fb1c8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.confirmNo.on('pointerdown', () => this.closeConfirm());
    this.confirmNo.on('pointerover', () => { this.confirmIndex = 1; this.refreshConfirmHighlight(); });
    overlay.add(this.confirmNo);

    this.confirmOverlay = overlay;
    this.refreshConfirmHighlight();
  }

  private refreshConfirmHighlight(): void {
    this.confirmYes?.setColor(this.confirmIndex === 0 ? '#ffffff' : '#ff4466');
    this.confirmNo?.setColor(this.confirmIndex === 1 ? '#ffffff' : '#9fb1c8');
  }

  private executeDelete(): void {
    const slotId = SAVE_SLOTS[this.selectedIndex]!;
    clearSlot(slotId as SaveSlotId);
    this.closeConfirm();
    // Rebuild the scene to refresh slot info
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(200, () => this.scene.restart());
  }

  private closeConfirm(): void {
    this.inConfirm = false;
    this.confirmOverlay?.destroy();
    this.confirmOverlay = undefined;
    this.confirmYes = undefined;
    this.confirmNo = undefined;
    this.cardNavigator?.setFocus(this.selectedIndex);
  }
}
