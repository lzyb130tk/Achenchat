import { escapeHTML } from '../services/utils.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { icon } from './icons.js';

export function openChoiceSheet({ title, options, current, onChoose }) {
  openSheet({
    title,
    content: `<div class="option-list">
      ${options
        .map(
          (option) => `<button class="option-row${option.value === current ? ' is-selected' : ''}" type="button" data-choice="${option.value}">
            ${option.icon ? `<span class="option-row__icon">${icon(option.icon)}</span>` : ''}
            <span class="option-row__copy">
              <span class="option-row__label">${escapeHTML(option.label)}</span>
              ${option.meta ? `<span class="option-row__meta">${escapeHTML(option.meta)}</span>` : ''}
            </span>
            <span class="option-row__check">${icon('check')}</span>
          </button>`,
        )
        .join('')}
    </div>`,
    onMount: (sheet) => {
      sheet.querySelectorAll('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => {
          onChoose(button.dataset.choice);
          closeActiveSheet();
        });
      });
    },
  });
}
