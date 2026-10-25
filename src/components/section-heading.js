import { escapeHTML } from '../services/utils.js';

export function sectionHeading({ title, aside = '' }) {
  return `<div class="section-heading">
    <h2>${escapeHTML(title)}</h2>
    ${aside ? `<span>${escapeHTML(aside)}</span>` : ''}
  </div>`;
}
