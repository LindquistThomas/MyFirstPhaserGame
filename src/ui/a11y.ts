const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

function isFocusable(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hasAttribute('inert')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

function focusElement(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

export function applyModalA11y(
  root: HTMLElement,
  opts: { titleId: string; descId?: string },
): () => void {
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', opts.titleId);
  if (opts.descId) {
    root.setAttribute('aria-describedby', opts.descId);
  } else {
    root.removeAttribute('aria-describedby');
  }
  if (!root.hasAttribute('tabindex')) {
    root.setAttribute('tabindex', '-1');
  }

  const previousActive =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const focusFirst = () => {
    const autoFocus = root.querySelector<HTMLElement>('[data-autofocus]');
    if (autoFocus && isFocusable(autoFocus)) {
      focusElement(autoFocus);
      return;
    }
    const first = getFocusableElements(root)[0];
    if (first) {
      focusElement(first);
      return;
    }
    focusElement(root);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;

    const focusables = getFocusableElements(root);
    if (focusables.length === 0) {
      event.preventDefault();
      focusElement(root);
      return;
    }

    const active =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeIndex = active ? focusables.indexOf(active) : -1;

    event.preventDefault();
    if (event.shiftKey) {
      if (activeIndex <= 0) {
        focusElement(focusables[focusables.length - 1]!);
      } else {
        focusElement(focusables[activeIndex - 1]!);
      }
      return;
    }

    if (activeIndex < 0 || activeIndex >= focusables.length - 1) {
      focusElement(focusables[0]!);
      return;
    }
    focusElement(focusables[activeIndex + 1]!);
  };

  document.addEventListener('keydown', onKeyDown, true);
  focusFirst();

  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    if (previousActive && previousActive.isConnected) {
      focusElement(previousActive);
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>('#game-container canvas');
    if (canvas) focusElement(canvas);
  };
}
