import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';

export function settingsRow({
  iconName,
  label,
  value = '',
  action = '',
  tone = '',
  status = '',
  chevron = true,
}) {
  const valueMarkup = value
    ? `<span class="settings-row__value">${status ? `<span class="status-dot status-dot--${status}"></span>` : ''}${escapeHTML(value)}</span>`
    : '';

  return `<button class="settings-row${tone === 'danger' ? ' settings-row--danger' : ''}" type="button" data-setting-action="${action}">
    <span class="settings-row__icon">${icon(iconName)}</span>
    <span class="settings-row__label">${escapeHTML(label)}</span>
    <span class="settings-row__trailing">
      ${valueMarkup}
      ${chevron ? `<span class="settings-row__chevron">${icon('caret-right')}</span>` : ''}
    </span>
  </button>`;
}

export function settingsGroup({ label, rows, extra = '' }) {
  return `<section class="settings-group">
    <h2 class="settings-group__label">${escapeHTML(label)}</h2>
    <div class="settings-group__card">
      ${rows}
    </div>
    ${extra}
  </section>`;
}
