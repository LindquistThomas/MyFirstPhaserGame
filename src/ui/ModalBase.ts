import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { pushContext, popContext, type ContextToken } from '../input';

/**
 * Shared scaffolding for full-screen modal overlays (info + quiz dialogs).
 *
 * Owns the container, the dimmed overlay, the Esc-to-close binding,
 * the `modal` input-context push/pop, and the fade in/out lifecycle.
 * Subclasses populate the container with their panel content in the
 * constructor and call `fadeIn()` when ready.
 *
 * Depth 200 and scrollFactor 0 are standard for all in-game overlays.
 */
export abstract class ModalBase {
  protected readonly scene: Phaser.Scene;
  protected readonly container: Phaser.GameObjects.Container;

  private cancelHandler: (() => void) | null = null;
  private contextToken: ContextToken | null = null;
  private shutdownHandler: (() => void) | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);

    this.buildOverlay();
    this.enterModalContext();

    // If the scene shuts down while the modal is still open, tear everything
    // down immediately so the context push and listeners don't leak.
    this.shutdownHandler = () => this.destroyImmediate();
    this.scene.events.once('shutdown', this.shutdownHandler);
    this.scene.events.once('destroy', this.shutdownHandler);
  }

  /** Dimmed fullscreen rect; added as the first child so subclasses can rely on index 0. */
  private buildOverlay(): void {
    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.65,
    );
    overlay.setScrollFactor(0).setInteractive(); // block clicks through
    this.container.add(overlay);
  }

  private enterModalContext(): void {
    this.contextToken = pushContext('modal');
    this.cancelHandler = () => this.close();
    this.scene.inputs.on('Cancel', this.cancelHandler);
  }

  /** Call at end of subclass constructor once panel content is built. */
  protected fadeIn(duration = 200): void {
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration });
  }

  /** Hook for subclasses to release additional resources before the fade-out. */
  protected onBeforeClose(): void {
    /* default no-op */
  }

  /** Hook fired after the container is destroyed. Subclasses forward to their onClose callback. */
  protected onAfterClose(): void {
    /* default no-op */
  }

  close(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.onBeforeClose();
    this.releaseInputAndShutdown();

    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150,
      onComplete: () => {
        this.container.destroy();
        this.onAfterClose();
      },
    });
  }

  /** Synchronous teardown used when the scene shuts down mid-modal. */
  private destroyImmediate(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.onBeforeClose();
    this.releaseInputAndShutdown();
    this.container.destroy();
    this.onAfterClose();
  }

  private releaseInputAndShutdown(): void {
    if (this.cancelHandler) {
      this.scene.inputs.off('Cancel', this.cancelHandler);
      this.cancelHandler = null;
    }
    if (this.contextToken) {
      popContext(this.contextToken);
      this.contextToken = null;
    }
    if (this.shutdownHandler) {
      this.scene.events.off('shutdown', this.shutdownHandler);
      this.scene.events.off('destroy', this.shutdownHandler);
      this.shutdownHandler = null;
    }
  }
}
