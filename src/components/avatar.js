import { escapeHTML } from '../services/utils.js';

export function avatar({
  mark,
  label = '',
  tone = 'apricot',
  size = 'md',
  src = '',
  className = '',
}) {
  const safeMark = escapeHTML(mark || '');
  const classes = ['avatar', `avatar--${tone}`, `avatar--${size}`, className]
    .filter(Boolean)
    .join(' ');
  const labelText = escapeHTML(label || mark || '头像');
  const image = src
    ? `<img class="avatar__image" src="${escapeHTML(src)}" alt="" loading="lazy" decoding="async">`
    : '';
  return `<span class="${classes}${src ? ' avatar--image' : ''}" role="img" aria-label="${labelText}">
    <span class="avatar__mark avatar__fallback">${safeMark}</span>
    ${image}
  </span>`;
}

export function characterAvatar(character, size = 'md') {
  return avatar({
    mark: character.mark,
    label: character.name,
    tone: character.tone,
    size,
    src: character.avatar || '',
  });
}

export function profileAvatar(profile, size = 'md') {
  return avatar({
    mark: Array.from(profile?.name || '你').slice(-1)[0],
    label: profile?.name || '你',
    tone: 'ink',
    size,
    src: profile?.avatar || '',
  });
}
