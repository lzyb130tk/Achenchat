import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';

export function appHeader({ title, action = '', backTo = '', subtitle = '' }) {
  const titleMarkup = `<div class="app-header__copy">
    <h1 class="app-header__title">${escapeHTML(title)}</h1>
    ${subtitle ? `<p class="app-header__subtitle">${escapeHTML(subtitle)}</p>` : ''}
  </div>`;

  if (backTo) {
    return `<header class="app-header app-header--compact">
      <a class="icon-button app-header__back" href="${backTo}" aria-label="返回">${icon('arrow-left')}</a>
      ${titleMarkup}
      <span class="app-header__side${action ? '' : ' is-empty'}">${action}</span>
    </header>`;
  }

  return `<header class="app-header">
    ${titleMarkup}
    <span class="app-header__side${action ? '' : ' is-empty'}">${action}</span>
  </header>`;
}
