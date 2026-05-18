import { afterEach, describe, expect, it } from 'vitest';
import { applyModalA11y } from './a11y';

function pressTab(shiftKey = false): void {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    shiftKey,
  });
  document.dispatchEvent(event);
}

describe('applyModalA11y', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sets modal aria attributes and focuses first focusable element', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const root = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'title-id';
    const desc = document.createElement('p');
    desc.id = 'desc-id';
    const first = document.createElement('button');
    first.textContent = 'first';
    const second = document.createElement('button');
    second.textContent = 'second';
    root.append(title, desc, first, second);
    document.body.appendChild(root);

    const dispose = applyModalA11y(root, { titleId: title.id, descId: desc.id });
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');
    expect(root.getAttribute('aria-labelledby')).toBe('title-id');
    expect(root.getAttribute('aria-describedby')).toBe('desc-id');
    expect(document.activeElement).toBe(first);

    dispose();
  });

  it('prefers [data-autofocus] and traps tab wrap in both directions', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const root = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'title';
    const desc = document.createElement('p');
    desc.id = 'desc';
    const first = document.createElement('button');
    first.textContent = 'first';
    first.setAttribute('data-autofocus', 'true');
    const second = document.createElement('button');
    second.textContent = 'second';
    root.append(title, desc, first, second);
    document.body.appendChild(root);

    const dispose = applyModalA11y(root, { titleId: title.id, descId: desc.id });
    expect(document.activeElement).toBe(first);

    pressTab();
    expect(document.activeElement).toBe(second);

    pressTab();
    expect(document.activeElement).toBe(first);

    pressTab(true);
    expect(document.activeElement).toBe(second);

    dispose();
    expect(document.activeElement).toBe(trigger);
  });

  it('focuses first focusable when no [data-autofocus] is present', () => {
    const root = document.createElement('div');
    const btn = document.createElement('button');
    btn.textContent = 'only';
    root.appendChild(btn);
    document.body.appendChild(root);

    const dispose = applyModalA11y(root, { titleId: 'x' });
    expect(document.activeElement).toBe(btn);
    dispose();
  });

  it('traps focus on root when there are no focusable elements and Tab is pressed', () => {
    const root = document.createElement('div');
    root.id = 'empty-modal';
    document.body.appendChild(root);

    applyModalA11y(root, { titleId: 'x' });
    pressTab();
    // Focus should remain on root (tabindex=-1) since no focusables
    expect(document.activeElement).toBe(root);
  });

  it('Shift+Tab from a middle element moves focus to previous', () => {
    const root = document.createElement('div');
    const first = document.createElement('button');
    first.textContent = 'first';
    const second = document.createElement('button');
    second.textContent = 'second';
    const third = document.createElement('button');
    third.textContent = 'third';
    root.append(first, second, third);
    document.body.appendChild(root);

    applyModalA11y(root, { titleId: 'x' });
    // Move focus to third
    pressTab();
    pressTab();
    expect(document.activeElement).toBe(third);
    // Shift+Tab from third → second (activeIndex > 0)
    pressTab(true);
    expect(document.activeElement).toBe(second);
  });

  it('restores focus to canvas when previous focus element is no longer connected', () => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('tabindex', '0');
    const container = document.createElement('div');
    container.id = 'game-container';
    container.appendChild(canvas);
    document.body.appendChild(container);

    const root = document.createElement('div');
    document.body.appendChild(root);

    // Focus a button, then call applyModalA11y so it captures previousActive = button
    const prev = document.createElement('button');
    document.body.appendChild(prev);
    prev.focus();

    const dispose = applyModalA11y(root, { titleId: 'x' });

    // Remove the button after applyModalA11y so previousActive.isConnected = false on dispose
    prev.remove();

    dispose();
    // Focus should have been restored to the canvas
    expect(document.activeElement).toBe(canvas);
  });
});
