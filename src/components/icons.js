export function icon(name, variant = 'regular') {
  const weight = variant === 'fill' ? 'ph-fill' : 'ph';
  return `<i class="${weight} ph-${name}" aria-hidden="true"></i>`;
}

export function iconButton({
  name,
  label,
  variant = 'regular',
  action = '',
  href = '',
  className = '',
}) {
  const classes = ['icon-button', className].filter(Boolean).join(' ');
  const inner = icon(name, variant);
  if (href) {
    return `<a class="${classes}" href="${href}" aria-label="${label}">${inner}</a>`;
  }
  return `<button class="${classes}" type="button" aria-label="${label}" ${action}>${inner}</button>`;
}

/**
 * Hand-drawn inline icons for the app chrome (dock, chat header, composer).
 *
 * Everything is drawn on a 24×24 grid with round caps and joins so the whole
 * UI reads as one family, inherits `currentColor`, and stays crisp at any size
 * without the Phosphor webfont.
 */
const UI_ICONS = {
  chat: `<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  compass: `<circle cx="12" cy="12" r="9.4"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>`,
  user: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  'chevron-left': `<path d="m15 18-6-6 6-6"/>`,
  'chevron-down': `<path d="m6 9 6 6 6-6"/>`,
  send: `<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>`,
  'arrow-down': `<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>`,
  'arrow-up': `<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>`,
  plus: `<path d="M12 5v14"/><path d="M5 12h14"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  'corner-down-right': `<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>`,
  more: `<circle cx="5.5" cy="12" r="1.55" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.55" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.55" fill="currentColor" stroke="none"/>`,
  stop: `<rect x="7.5" y="7.5" width="9" height="9" rx="2.6" fill="currentColor" stroke="none"/>`,
  sticker: `<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><path d="M8 13.5h.01"/><path d="M15 13.5h.01"/><path d="M9.5 16c.6.4 1.5.7 2.5.7s1.9-.3 2.5-.7"/>`,
  'red-packet': `<rect x="4.6" y="3" width="14.8" height="18" rx="3.4"/><path d="M4.6 8.6h14.8"/><circle cx="12" cy="14.2" r="2.5"/>`,
  retry: `<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`,
};

export function uiIcon(name, { size = 24, strokeWidth = 1.7, className = '' } = {}) {
  const body = UI_ICONS[name];
  if (!body) return '';
  const classes = className ? `ui-icon ${className}` : 'ui-icon';
  return `<svg class="${classes}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
