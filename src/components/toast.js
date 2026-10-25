import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';

let activeToast = null;
let activeTimer = null;

export function toast(message, { tone = 'default' } = {}) {
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }
  clearTimeout(activeTimer);

  const element = document.createElement('div');
  element.className = `toast toast--${tone}`;
  element.setAttribute('role', 'status');
  element.innerHTML = `<span class="toast__icon">${icon(tone === 'danger' ? 'warning-circle' : 'check')}</span><span>${escapeHTML(message)}</span>`;
  document.getElementById('app').appendChild(element);
  activeToast = element;

  requestAnimationFrame(() => element.classList.add('is-visible'));
  activeTimer = window.setTimeout(() => {
    element.classList.remove('is-visible');
    window.setTimeout(() => {
      element.remove();
      if (activeToast === element) activeToast = null;
    }, 220);
  }, 2600);
}
