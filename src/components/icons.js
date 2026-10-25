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
