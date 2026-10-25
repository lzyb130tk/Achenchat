import { escapeHTML } from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';

export function contactItem({ character }) {
  return `<a class="contact-item" href="#/chat/${character.id}">
    ${characterAvatar(character, 'md')}
    <span class="contact-item__main">
      <span class="contact-item__name">${escapeHTML(character.name)}</span>
      <span class="contact-item__meta">${escapeHTML(character.role)} · ${escapeHTML(character.tagline)}</span>
    </span>
    <span class="contact-item__chevron">${icon('caret-right')}</span>
  </a>`;
}
