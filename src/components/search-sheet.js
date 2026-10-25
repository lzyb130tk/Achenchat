import { escapeHTML } from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';

export function openSearchSheet({ title, placeholder, items, emptyText }) {
  openSheet({
    title,
    content: `<div class="search-box">
      ${icon('magnifying-glass')}
      <input class="search-box__input" type="search" placeholder="${escapeHTML(placeholder)}" autocomplete="off" aria-label="${escapeHTML(placeholder)}">
    </div>
    <div class="search-results" data-search-results></div>`,
    onMount: (sheet) => {
      const input = sheet.querySelector('.search-box__input');
      const results = sheet.querySelector('[data-search-results]');

      const renderResults = (query = '') => {
        const normalized = query.trim().toLowerCase();
        const filtered = items.filter((item) =>
          !normalized || item.searchText.toLowerCase().includes(normalized),
        );

        if (!filtered.length) {
          results.innerHTML = `<p class="search-empty">${escapeHTML(emptyText)}</p>`;
          return;
        }

        results.innerHTML = filtered
          .map(
            (item) => `<a class="search-result" href="${item.href}">
              ${characterAvatar(item.character, 'sm')}
              <span class="search-result__copy">
                <span class="search-result__name">${escapeHTML(item.character.name)}</span>
                <span class="search-result__subtitle">${escapeHTML(item.subtitle)}</span>
              </span>
              ${icon('caret-right')}
            </a>`,
          )
          .join('');
      };

      renderResults();
      input.addEventListener('input', () => renderResults(input.value));
      results.addEventListener('click', (event) => {
        if (event.target.closest('a')) closeActiveSheet();
      });
      window.setTimeout(() => input.focus(), 320);
    },
  });
}
