import { escapeHTML } from '../services/utils.js';

export function avatar({
  mark,
  label = '',
  tone = 'apricot',
  size = 'md',
}) {
  return `<span class="avatar avatar--${tone} avatar--${size}" role="img" aria-label="${escapeHTML(label || mark)}"><span class="avatar__mark">${escapeHTML(mark)}</span></span>`;
}

export function characterAvatar(character, size = 'md') {
  return avatar({
    mark: character.mark,
    label: character.name,
    tone: character.tone,
    size,
  });
}
