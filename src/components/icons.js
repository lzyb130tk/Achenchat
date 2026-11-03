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
  'chevron-right': `<path d="m9 18 6-6-6-6"/>`,
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
  smiley: `<circle cx="12" cy="12" r="9"/><path d="M8.4 14.2a4.6 4.6 0 0 0 7.2 0"/><path d="M9.2 9.6h.01"/><path d="M14.8 9.6h.01"/>`,
  'red-packet': `<rect x="4.6" y="3" width="14.8" height="18" rx="3.4"/><path d="M4.6 8.6h14.8"/><circle cx="12" cy="14.2" r="2.5"/>`,
  retry: `<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`,
  pin: `<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>`,
  bell: `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`,
  'bell-off': `<path d="M8.7 3A6 6 0 0 1 18 8c0 7 3 9 3 9H4a2 2 0 0 1 0-2c1.5-1.5 2-4 2-6"/><path d="m2 2 20 20"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`,
  trash: `<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14H5V6"/><path d="M10 11v6"/><path d="M14 11v6"/>`,
  pencil: `<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>`,
  upload: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>`,
  copy: `<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
  'check-square': `<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.6"/><path d="m8.6 12.2 2.4 2.4 4.6-4.9"/>`,
  file: `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>`,
  check: `<path d="m4.8 12.6 4.8 4.8L19.2 6.6"/>`,
  textbox: `<rect x="3" y="5" width="18" height="14" rx="3.2"/><path d="M7 10.5h10"/><path d="M7 14.5h6"/>`,
  image: `<rect x="3" y="4.5" width="18" height="15" rx="3.2"/><circle cx="8.6" cy="10" r="1.6"/><path d="m4 17 4.7-4.7a2 2 0 0 1 2.8 0L18 19"/>`,
  sparkle: `<path d="M12 3.6 13.7 9l5.4 1.7-5.4 1.7L12 17.8l-1.7-5.4L4.9 10.7 10.3 9 12 3.6Z"/>`,
  flame: `<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.6-2.7-5.4-4.2-7.6C13 5.2 12.6 3.4 12 2c-.6 2.4-1.8 3.6-3.2 5.4C7.2 9.6 5.5 11.4 5.5 14.5A6.5 6.5 0 0 0 12 21Z"/>`,
  bookmark: `<path d="M6.4 3.5h11.2a1 1 0 0 1 1 1v16l-6.6-4.2-6.6 4.2v-16a1 1 0 0 1 1-1Z"/>`,
  broadcast: `<circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4"/><path d="M16.2 16.2a6 6 0 0 0 0-8.4"/><path d="M4.8 4.8a10 10 0 0 0 0 14.4"/><path d="M19.2 19.2a10 10 0 0 0 0-14.4"/>`,
  archive: `<rect x="3.5" y="4" width="17" height="4.2" rx="1.6"/><path d="M5.2 8.2V19a1 1 0 0 0 1 1h11.6a1 1 0 0 0 1-1V8.2"/><path d="M10 12.5h4"/>`,
  keyboard: `<rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2.6"/><path d="M6.4 10h.01M9.8 10h.01M13.2 10h.01M16.6 10h.01"/><path d="M8 14.2h8"/>`,
  stack: `<rect x="6.5" y="3.5" width="12" height="13" rx="2.4"/><path d="M4.2 7.2v11.3a2 2 0 0 0 2 2h9.6"/>`,
  hourglass: `<path d="M7 3h10"/><path d="M17 21H7"/><path d="M8 3v3.5c0 2 4 3.5 4 5.5s-4 3.5-4 5.5V21"/><path d="M16 3v3.5c0 2-4 3.5-4 5.5s4 3.5 4 5.5V21"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3.4 2"/>`,
  heart: `<path d="M12 20.2c-.4 0-.8-.2-1.1-.4C7.2 16.7 3.5 13.5 3.5 9.4c0-2.6 1.9-4.6 4.4-4.6 1.7 0 3.1.9 4.1 2.3 1-1.4 2.4-2.3 4.1-2.3 2.5 0 4.4 2 4.4 4.6 0 4.1-3.7 7.3-7.4 10.4-.3.2-.7.4-1.1.4Z"/>`,
  camera: `<path d="M4.2 8h3l1.5-2.3h6.6L16.8 8h3a1 1 0 0 1 1 1v8.8a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>`,
  link: `<path d="M10.6 13.4a3.4 3.4 0 0 0 4.8 0l2.9-2.9a3.4 3.4 0 0 0-4.8-4.8l-1.4 1.4"/><path d="M13.4 10.6a3.4 3.4 0 0 0-4.8 0l-2.9 2.9a3.4 3.4 0 0 0 4.8 4.8l1.4-1.4"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5"/><path d="M12 7.7h.01"/>`,
  search: `<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.2-4.2"/>`,
  mask: `<path d="M4.6 4.8h14.8v5.6a7.4 7.4 0 0 1-7.4 7.4 7.4 7.4 0 0 1-7.4-7.4V4.8Z"/><path d="M9.2 9.6h.01"/><path d="M14.8 9.6h.01"/><path d="M9.6 12.6c.7.6 1.5.9 2.4.9s1.7-.3 2.4-.9"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
};

export function uiIcon(name, { size = 24, strokeWidth = 1.7, className = '' } = {}) {
  const body = UI_ICONS[name];
  if (!body) return '';
  const classes = className ? `ui-icon ${className}` : 'ui-icon';
  return `<svg class="${classes}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
