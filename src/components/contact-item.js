import { escapeHTML } from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';

export function contactItem({
  character,
  data = '',
  selectable = false,
  selected = false,
}) {
  const inner = `
    ${characterAvatar(character, 'md')}
    <span class="contact-item__main">
      <span class="contact-item__name">${escapeHTML(character.name)}</span>
      <span class="contact-item__meta">${escapeHTML(character.tagline)}</span>
    </span>
    ${character.muted ? `<span class="contact-item__muted" aria-label="已免打扰">${icon('bell-slash')}</span>` : ''}`;

  if (selectable) {
    return `<button class="contact-item contact-item--select${selected ? ' is-selected' : ''}" type="button" ${data} aria-pressed="${selected}">
      ${inner}
      <span class="contact-item__check">${icon(selected ? 'check-circle' : 'circle', selected ? 'fill' : 'regular')}</span>
    </button>`;
  }

  return `<a class="contact-item" href="#/chat/${character.id}" ${data}>
    ${inner}
    <span class="contact-item__chevron">${icon('caret-right')}</span>
  </a>`;
}
