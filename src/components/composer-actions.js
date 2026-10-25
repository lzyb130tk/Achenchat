import { getEnabledStickerEntries } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';

export function openComposerActions({ onRedPacket, onSticker, onRetry }) {
  openSheet({
    title: '更多',
    content: `<div class="composer-action-grid">
      <button class="composer-action" type="button" data-composer-redpacket>
        <span class="composer-action__icon">${icon('envelope-simple')}</span>
        <span>红包</span>
      </button>
      <button class="composer-action" type="button" data-composer-sticker>
        <span class="composer-action__icon">${icon('sticker')}</span>
        <span>表情</span>
      </button>
      <button class="composer-action" type="button" data-composer-retry>
        <span class="composer-action__icon">${icon('arrow-clockwise')}</span>
        <span>重试</span>
      </button>
    </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-composer-redpacket]').addEventListener('click', () => {
        closeActiveSheet({ immediate: true, reason: 'replace' });
        onRedPacket?.();
      });
      sheet.querySelector('[data-composer-sticker]').addEventListener('click', () => {
        closeActiveSheet({ immediate: true, reason: 'replace' });
        onSticker?.();
      });
      sheet.querySelector('[data-composer-retry]').addEventListener('click', () => {
        closeActiveSheet({ immediate: true, reason: 'replace' });
        onRetry?.();
      });
    },
  });
}

export function openStickerPicker({ onPick }) {
  const stickers = getEnabledStickerEntries();
  openSheet({
    title: '表情',
    description: stickers.length ? '选一张发过去。' : '',
    content: stickers.length
      ? `<div class="sticker-picker">
          ${stickers
            .map(
              (sticker, index) => `<button class="sticker-picker__item" type="button" data-sticker-index="${index}" aria-label="${escapeHTML(sticker.name)}">
                <img src="${escapeHTML(sticker.url)}" alt="${escapeHTML(sticker.name)}" loading="lazy">
              </button>`,
            )
            .join('')}
        </div>`
      : `<div class="settings-empty">
          <span class="settings-empty__icon">${icon('sticker')}</span>
          <p>还没有可用表情。先添加一组喜欢的图片链接。</p>
          <button class="button button--secondary settings-empty__button" type="button" data-open-stickers>去添加表情包</button>
        </div>`,
    onMount: (sheet) => {
      sheet.querySelectorAll('[data-sticker-index]').forEach((button) => {
        button.addEventListener('click', () => {
          const sticker = stickers[Number(button.dataset.stickerIndex)];
          if (!sticker) return;
          closeActiveSheet({ immediate: true });
          onPick?.(sticker);
        });
      });
      sheet.querySelector('[data-open-stickers]')?.addEventListener('click', () => {
        closeActiveSheet({ immediate: true, reason: 'navigate' });
        window.location.hash = '#/stickers';
      });
    },
  });
}
