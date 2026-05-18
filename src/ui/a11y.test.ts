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

  it('shift-tab from a middle element moves to the previous element', () => {
    const root = document.createElement('div');
    root.id = 'modal';
    const title = document.createElement('h2');
    title.id = 'mid-title';
    const a = document.createElement('button');
    a.textContent = 'a';
    const b = document.createElement('button');
    b.textContent = 'b';
    const c = document.createElement('button');
    c.textContent = 'c';
    root.append(title, a, b, c);
    document.body.appendChild(root);

    const dispose = applyModalA11y(root, { titleId: title.id });
    b.focus();
    pressTab(true);
    expect(document.activeElement).toBe(a);
    dispose();
  });

  it('focuses root when Tab is pressed with no focusable elements inside', () => {
    const root = document.createElement('div');
    root.id = 'empty-modal';
    root.setAttribute('tabindex', '-1');
    const title = document.createElement('h2');
    title.id = 'empty-title';
    root.appendChild(title);
    document.body.appendChild(root);

    const dispose = applyModalA11y(root, { titleId: title.id });
    pressTab();
    expect(document.activeElement).toBe(root);
    dispose();
  });

  it('focuses canvas fallback when previousActive is no longer connected', () => {
    const container = document.createElement('div');
    container.id = 'game-container';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('tabindex', '0');
    container.appendChild(canvas);
    document.body.appendChild(container);

    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const root = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'canvas-title';
    root.appendChild(title);
    document.body.appendChild(root);

    const dispose = applyModalA11y(root, { titleId: title.id });
    document.body.removeChild(trigger);
    dispose();
    expect(document.activeElement).toBe(canvas);
  });
});
