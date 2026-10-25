import { escapeHTML } from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';

export function contactItem({ character, data = '' }) {
  return `<a class="contact-item" href="#/chat/${character.id}" ${data}>
    ${characterAvatar(character, 'md')}
    <span class="contact-item__main">
      <span class="contact-item__name">${escapeHTML(character.name)}</span>
      <span class="contact-item__meta">${escapeHTML(character.role)} · ${escapeHTML(character.tagline)}</span>
    </span>
    ${character.muted ? `<span class="contact-item__muted" aria-label="已免打扰">${icon('bell-slash')}</span>` : ''}
    <span class="contact-item__chevron">${icon('caret-right')}</span>
  </a>`;
}
