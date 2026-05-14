import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { pushContext, popContext, type ContextToken } from '../input';
import { theme } from '../style/theme';
import { shouldSkipTween } from '../systems/motionTween';
import { applyModalA11y } from './a11y';

let modalA11yCounter = 0;

export interface ModalA11yOptions {
  title?: string;
  description?: string;
}

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
  private activeTween: Phaser.Tweens.Tween | null = null;
  private destroyed = false;
  private a11yRoot: HTMLDivElement | null = null;
  private a11yTitleEl: HTMLParagraphElement | null = null;
  private a11yDescEl: HTMLParagraphElement | null = null;
  private a11yDispose: (() => void) | null = null;
  private a11yDescId: string | null = null;

  constructor(scene: Phaser.Scene, a11yOptions?: ModalA11yOptions) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);

    this.buildOverlay();
    this.setupA11y(a11yOptions);
    this.enterModalContext();

    // If the scene shuts down while the modal is still open, tear everything
    // down immediately so the context push and listeners don't leak.
    this.shutdownHandler = () => this.destroyImmediate();
    this.scene.events.once('shutdown', this.shutdownHandler);
    this.scene.events.once('destroy', this.shutdownHandler);
  }

  protected setA11yContent(title: string, description?: string): void {
    if (!this.a11yRoot || !this.a11yTitleEl) return;
    this.a11yTitleEl.textContent = title;
    if (!this.a11yDescEl || !this.a11yDescId) return;

    const trimmed = description?.trim() ?? '';
    this.a11yDescEl.textContent = trimmed;
    if (trimmed.length > 0) {
      this.a11yRoot.setAttribute('aria-describedby', this.a11yDescId);
    } else {
      this.a11yRoot.removeAttribute('aria-describedby');
    }
  }

  /** Dimmed fullscreen rect; added as the first child so subclasses can rely on index 0. */
  private buildOverlay(): void {
    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      theme.color.bg.dark, 0.65,
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
    this.activeTween?.stop();
    const tweenDuration = shouldSkipTween() ? 0 : duration;
    this.activeTween = this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: tweenDuration,
      onComplete: () => {
        this.activeTween = null;
      },
    });
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
    this.activeTween?.stop();
    this.activeTween = null;

    const tweenDuration = shouldSkipTween() ? 0 : 150;
    this.activeTween = this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: tweenDuration,
      onComplete: () => {
        this.activeTween = null;
        this.container.destroy();
        this.onAfterClose();
      },
    });
  }

  /** Synchronous teardown used when the scene shuts down mid-modal. */
  private destroyImmediate(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.activeTween?.stop();
    this.activeTween = null;
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
    if (this.a11yDispose) {
      this.a11yDispose();
      this.a11yDispose = null;
    }
    if (this.a11yRoot) {
      this.a11yRoot.remove();
      this.a11yRoot = null;
      this.a11yTitleEl = null;
      this.a11yDescEl = null;
      this.a11yDescId = null;
    }
  }

  private setupA11y(a11yOptions?: ModalA11yOptions): void {
    const id = `game-modal-${++modalA11yCounter}`;
    const root = document.createElement('div');
    root.id = `${id}-root`;
    root.dataset.modalRoot = 'true';
    root.style.position = 'fixed';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = '1px';
    root.style.height = '1px';
    root.style.overflow = 'hidden';
    root.style.clip = 'rect(0 0 0 0)';
    root.style.whiteSpace = 'nowrap';

    const titleEl = document.createElement('p');
    const defaultTitle = this.constructor.name.replace(/([a-z])([A-Z])/g, '$1 $2');
    titleEl.id = `${id}-title`;
    titleEl.textContent = a11yOptions?.title ?? defaultTitle;
    root.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.id = `${id}-desc`;
    descEl.textContent = a11yOptions?.description ?? '';
    root.appendChild(descEl);
    this.a11yDescId = descEl.id;

    const focusAnchor = document.createElement('button');
    focusAnchor.type = 'button';
    focusAnchor.setAttribute('data-autofocus', 'true');
    focusAnchor.setAttribute('aria-label', 'Modal dialog');
    focusAnchor.textContent = 'Modal dialog';
    root.appendChild(focusAnchor);

    document.body.appendChild(root);

    this.a11yRoot = root;
    this.a11yTitleEl = titleEl;
    this.a11yDescEl = descEl;
    this.a11yDispose = applyModalA11y(root, {
      titleId: titleEl.id,
      descId: descEl.textContent?.trim() ? descEl.id : undefined,
    });
  }
}
