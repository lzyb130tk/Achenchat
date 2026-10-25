import { appHeader } from '../components/app-header.js';
import { icon, iconButton } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import {
  addStickerPack,
  deleteStickerPack,
  getStickerPacks,
  updateStickerPack,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function parseUrls(value) {
  return value
    .split(/\s+/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function openStickerEditor({ pack = null, onDismiss } = {}) {
  openSheet({
    title: pack ? '编辑表情包' : '添加表情包',
    description: '粘贴图片链接，每行一个。建议使用正方形图片。',
    content: `<div class="sticker-editor">
      <label class="field">
        <span class="field__label">名称</span>
        <span class="field__control">
          <input class="field__input" name="packName" maxlength="20" autocomplete="off" value="${escapeHTML(pack?.name || '')}" placeholder="例如「猫猫日常」">
        </span>
      </label>
      <label class="field">
        <span class="field__label">图片链接</span>
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea field__textarea--links" name="packUrls" rows="6" spellcheck="false" placeholder="https://example.com/1.png&#10;https://example.com/2.png">${escapeHTML((pack?.urls || []).join('\n'))}</textarea>
        </span>
      </label>
      <p class="field__hint">只支持 http 或 https 图片地址。</p>
      ${pack ? `<button class="text-button text-button--danger" type="button" data-delete-pack>${icon('trash-simple')}删除这组表情</button>` : ''}
    </div>`,
    actions: `<button class="button button--primary" type="button" data-save-pack>保存</button>`,
    onDismiss,
    onMount: (sheet) => {
      const nameInput = sheet.querySelector('[name="packName"]');
      const urlInput = sheet.querySelector('[name="packUrls"]');

      sheet.querySelector('[data-save-pack]').addEventListener('click', () => {
        const name = nameInput.value.trim();
        const urls = parseUrls(urlInput.value);
        if (!name) {
          toast('给表情包起个名字', { tone: 'danger' });
          nameInput.focus();
          return;
        }
        if (!urls.length) {
          toast('至少粘贴一个图片链接', { tone: 'danger' });
          urlInput.focus();
          return;
        }
        const invalid = urls.filter((url) => !/^https?:\/\//i.test(url));
        if (invalid.length) {
          toast('有链接不是 http/https 地址', { tone: 'danger' });
          return;
        }
        if (pack) updateStickerPack(pack.id, { name, urls });
        else addStickerPack({ name, urls });
        closeActiveSheet();
        toast(pack ? '表情包已更新' : '表情包已添加');
      });

      sheet.querySelector('[data-delete-pack]')?.addEventListener('click', () => {
        openSheet({
          title: '删除表情包',
          description: `“${pack.name}”会从列表和聊天里移除。`,
          actions: `<div class="button-row">
            <button class="button button--secondary" type="button" data-cancel-pack-delete>取消</button>
            <button class="button button--danger" type="button" data-confirm-pack-delete>删除</button>
          </div>`,
          onMount: (confirmSheet) => {
            confirmSheet
              .querySelector('[data-cancel-pack-delete]')
              .addEventListener('click', () => closeActiveSheet());
            confirmSheet
              .querySelector('[data-confirm-pack-delete]')
              .addEventListener('click', () => {
                deleteStickerPack(pack.id);
                closeActiveSheet({ immediate: true });
                toast('表情包已删除');
                onDismiss?.();
              });
          },
        });
      });
    },
  });
}

function packCard(pack) {
  return `<article class="sticker-pack" data-pack="${pack.id}">
    <header class="sticker-pack__head">
      <span class="sticker-pack__copy">
        <strong>${escapeHTML(pack.name)}</strong>
        <small>${pack.urls.length} 张</small>
      </span>
      <label class="switch">
        <input type="checkbox" data-pack-enabled="${pack.id}"${pack.enabled ? ' checked' : ''} aria-label="启用${escapeHTML(pack.name)}">
        <span class="switch__track"></span>
      </label>
    </header>
    <div class="sticker-strip">
      ${pack.urls
        .slice(0, 5)
        .map(
          (url) =>
            `<span class="sticker-thumb"><span class="sticker-thumb__fallback">${icon('image')}</span><img src="${escapeHTML(url)}" alt="" loading="lazy"></span>`,
        )
        .join('')}
      ${pack.urls.length > 5 ? `<span class="sticker-thumb sticker-thumb--more">+${pack.urls.length - 5}</span>` : ''}
    </div>
    <button class="text-button" type="button" data-edit-pack="${pack.id}">${icon('pencil-simple')}编辑</button>
  </article>`;
}

export function renderStickers({ refresh }) {
  const packs = getStickerPacks();
  const screen = document.createElement('section');
  screen.className = 'screen';

  screen.innerHTML = `
    ${appHeader({
      title: '表情',
      backTo: '#/me',
      action: iconButton({
        name: 'plus',
        label: '添加表情包',
        action: 'data-new-pack',
      }),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--stickers">
        <p class="page-intro">上传图片链接组成表情包。开启后，AI 偶尔会在聊天里用它们回应。</p>
        ${
          packs.length
            ? `<div class="sticker-packs">${packs.map(packCard).join('')}</div>`
            : `<section class="empty-state empty-state--compact">
                <span class="empty-state__icon">${icon('sticker')}</span>
                <h2>还没有表情包</h2>
                <p>粘贴几张图片链接，就能让对话多一点表情。</p>
                <button class="button button--primary empty-state__button" type="button" data-empty-add>添加表情包</button>
              </section>`
        }
      </div>
    </main>`;

  const openNew = () => {
    openStickerEditor({ onDismiss: refresh });
  };

  screen.querySelector('[data-new-pack]').addEventListener('click', openNew);
  screen.querySelector('[data-empty-add]')?.addEventListener('click', openNew);

  screen.querySelectorAll('[data-edit-pack]').forEach((button) => {
    button.addEventListener('click', () => {
      const pack = packs.find((item) => item.id === button.dataset.editPack);
      if (pack) openStickerEditor({ pack, onDismiss: refresh });
    });
  });

  screen.querySelectorAll('[data-pack-enabled]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      updateStickerPack(checkbox.dataset.packEnabled, {
        enabled: checkbox.checked,
      });
      toast(checkbox.checked ? '已让 AI 使用这组表情' : '已停用这组表情');
    });
  });

  return { element: screen };
}
