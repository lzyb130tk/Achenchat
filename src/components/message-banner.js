import { escapeHTML, messagePreview } from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';

let active = null;
let timer = null;

export function dismissMessageBanner() {
  if (!active) return;
  const element = active;
  active = null;
  window.clearTimeout(timer);
  element.classList.remove('is-visible');
  window.setTimeout(() => element.remove(), 240);
}

export function showMessageBanner({ character, message, onOpen }) {
  dismissMessageBanner();
  const app = document.getElementById('app');
  if (!app) return;

  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'message-banner';
  element.innerHTML = `${characterAvatar(character, 'sm')}
    <span class="message-banner__copy">
      <span class="message-banner__top">
        <strong>${escapeHTML(character.name)}</strong>
        <span class="message-banner__tag">${icon('chat-circle-dots', 'fill')}新消息</span>
      </span>
      <span class="message-banner__preview">${escapeHTML(messagePreview(message))}</span>
    </span>`;

  element.addEventListener('click', () => {
    dismissMessageBanner();
    onOpen?.();
  });

  app.appendChild(element);
  active = element;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => element.classList.add('is-visible'));
  });
  timer = window.setTimeout(dismissMessageBanner, 4200);
}
