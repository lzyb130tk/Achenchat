import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';

let activeSheet = null;

function focusableElements(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null);
}

export function closeActiveSheet({ immediate = false, reason = 'dismiss' } = {}) {
  if (!activeSheet) return;
  const { layer, returnFocus, cleanup, onDismiss } = activeSheet;
  activeSheet = null;
  cleanup();
  layer.classList.remove('is-open');
  const remove = () => {
    layer.remove();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  };
  if (immediate) remove();
  else window.setTimeout(remove, 260);
  if (reason === 'dismiss' && typeof onDismiss === 'function') {
    window.setTimeout(onDismiss, 0);
  }
}

export function openSheet({
  title,
  description = '',
  content = '',
  actions = '',
  className = '',
  onMount,
  onDismiss,
}) {
  closeActiveSheet({ immediate: true, reason: 'replace' });

  const app = document.getElementById('app');
  const titleId = `sheet-title-${Date.now()}`;
  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.innerHTML = `
    <button class="sheet-backdrop" type="button" data-sheet-close aria-label="关闭"></button>
    <section class="sheet ${className}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="sheet__grip" aria-hidden="true"></div>
      <header class="sheet__header">
        <div class="sheet__heading">
          <h2 id="${titleId}">${escapeHTML(title)}</h2>
          ${description ? `<p>${escapeHTML(description)}</p>` : ''}
        </div>
        <button class="icon-button sheet__close" type="button" data-sheet-close aria-label="关闭">${icon('x')}</button>
      </header>
      <div class="sheet__body">${content}</div>
      ${actions ? `<div class="sheet__actions">${actions}</div>` : ''}
    </section>`;

  app.appendChild(layer);
  const sheet = layer.querySelector('.sheet');
  const returnFocus = document.activeElement;

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeActiveSheet();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusableElements(sheet);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  layer.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet-close]')) closeActiveSheet();
  });
  document.addEventListener('keydown', onKeydown);
  activeSheet = {
    layer,
    returnFocus,
    onDismiss,
    cleanup: () => document.removeEventListener('keydown', onKeydown),
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      layer.classList.add('is-open');
      if (typeof onMount === 'function') onMount(sheet);
    });
  });

  return closeActiveSheet;
}
