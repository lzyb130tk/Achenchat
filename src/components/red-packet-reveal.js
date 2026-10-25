import { escapeHTML, formatMoney } from '../services/utils.js';
import { icon } from './icons.js';

let activeReveal = null;
let activeTimer = null;

function removeReveal() {
  if (!activeReveal) return;
  window.clearTimeout(activeTimer);
  activeReveal.remove();
  activeReveal = null;
}

export function showRedPacketReveal({ from, amountFen, note }) {
  removeReveal();
  const app = document.getElementById('app');
  if (!app) return;

  const element = document.createElement('div');
  element.className = 'red-packet-reveal';
  element.innerHTML = `
    <button class="red-packet-reveal__backdrop" type="button" data-reveal-close aria-label="关闭红包"></button>
    <div class="red-packet-reveal__panel" role="dialog" aria-modal="true" aria-label="${escapeHTML(from)}的红包">
      <div class="red-packet-reveal__envelope">
        <span class="red-packet-reveal__from">${escapeHTML(from)}的红包</span>
        <span class="red-packet-reveal__seal">${icon('envelope-simple', 'fill')}</span>
        <strong class="red-packet-reveal__amount">${formatMoney(amountFen)}</strong>
        <span class="red-packet-reveal__note">${escapeHTML(note || '恭喜发财，大吉大利')}</span>
        <span class="red-packet-reveal__status">已存入零钱</span>
      </div>
      <button class="red-packet-reveal__button" type="button" data-reveal-close>收下</button>
    </div>`;
  app.appendChild(element);
  activeReveal = element;

  element.addEventListener('click', (event) => {
    if (event.target.closest('[data-reveal-close]')) removeReveal();
  });

  requestAnimationFrame(() => element.classList.add('is-open'));
  activeTimer = window.setTimeout(removeReveal, 2400);
  window.setTimeout(() => {
    element.querySelector('[data-reveal-close]:last-child')?.focus({ preventScroll: true });
  }, 80);
}
