import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';

export function appHeader({ title, action = '', backTo = '' }) {
  const titleMarkup = `<h1 class="app-header__title">${escapeHTML(title)}</h1>`;

  if (backTo) {
    return `<header class="app-header app-header--compact">
      <a class="icon-button app-header__back" href="${backTo}" aria-label="返回">${icon('arrow-left')}</a>
      ${titleMarkup}
      <span class="app-header__side" aria-hidden="true"></span>
    </header>`;
  }

  return `<header class="app-header">
    <span class="app-header__brand" aria-hidden="true">a</span>
    ${titleMarkup}
    <span class="app-header__side">${action}</span>
  </header>`;
}
