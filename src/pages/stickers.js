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
  return [...new Set(value
    .split(/\s+/)
    .map((url) => url.trim())
    .filter(Boolean))];
}

function watchBrokenImages(container) {
  container.querySelectorAll('img').forEach((image) => {
    image.addEventListener('error', () => image.classList.add('is-broken'));
  });
}

function openStickerNames({ packName, items, pack = null, onSaved }) {
  let rows = items.map((item) => ({ ...item }));
  openSheet({
    title: pack ? '编辑表情包' : '给表情起名',
    description: 'AI 会通过名字理解和选用表情，给每张起个好记的名字。',
    content: `<div class="sticker-editor">
      <label class="field">
        <span class="field__label">表情包名称</span>
        <span class="field__control">
          <input class="field__input" name="packName" maxlength="20" autocomplete="off" value="${escapeHTML(packName)}" placeholder="例如「猫猫日常」">
        </span>
      </label>
      <div class="sticker-names-head">
        <span>表情名称</span>
        <small data-sticker-count>${rows.length} 张</small>
      </div>
      <div class="sticker-name-list" data-sticker-name-list>
        ${rows
          .map(
            (item) => `<div class="sticker-name-row" data-sticker-row data-url="${escapeHTML(item.url)}">
              <span class="sticker-thumb sticker-thumb--sm">
                <span class="sticker-thumb__fallback">${icon('image')}</span>
                <img src="${escapeHTML(item.url)}" alt="" loading="lazy">
              </span>
              <input class="sticker-name-row__input" data-sticker-name maxlength="20" value="${escapeHTML(item.name)}" placeholder="表情名" aria-label="表情名称" autocomplete="off">
              <button class="sticker-name-row__remove" type="button" data-remove-sticker aria-label="移除这张表情">${icon('x')}</button>
            </div>`,
          )
          .join('')}
      </div>
      ${pack ? `<button class="text-button text-button--danger" type="button" data-delete-pack>${icon('trash-simple')}删除这组表情</button>` : ''}
    </div>`,
    actions: `<button class="button button--primary" type="button" data-save-pack>${pack ? '保存' : '添加表情包'}</button>`,
    onMount: (sheet) => {
      watchBrokenImages(sheet);
      const nameInput = sheet.querySelector('[name="packName"]');

      sheet.querySelector('[data-sticker-name-list]').addEventListener('click', (event) => {
        const remove = event.target.closest('[data-remove-sticker]');
        if (!remove) return;
        const row = remove.closest('[data-sticker-row]');
        row.remove();
        rows = rows.filter((item) => item.url !== row.dataset.url);
        const list = sheet.querySelector('[data-sticker-name-list]');
        sheet.querySelector('[data-sticker-count]').textContent =
          `${list.querySelectorAll('[data-sticker-row]').length} 张`;
      });

      sheet.querySelector('[data-save-pack]').addEventListener('click', () => {
        const name = nameInput.value.trim();
        const rowElements = [...sheet.querySelectorAll('[data-sticker-row]')];
        const nextItems = rowElements.map((row) => ({
          url: row.dataset.url,
          name: row.querySelector('[data-sticker-name]').value.trim(),
        }));
        if (!name) {
          toast('给表情包起个名字', { tone: 'danger' });
          nameInput.focus();
          return;
        }
        if (!nextItems.length) {
          toast('至少保留一张表情', { tone: 'danger' });
          return;
        }
        const unnamed = nextItems.findIndex((item) => !item.name);
        if (unnamed >= 0) {
          toast(`给第 ${unnamed + 1} 张表情起个名字`, { tone: 'danger' });
          rowElements[unnamed].querySelector('[data-sticker-name]').focus();
          return;
        }
        if (pack) updateStickerPack(pack.id, { name, items: nextItems });
        else addStickerPack({ name, items: nextItems });
        closeActiveSheet();
        toast(pack ? '表情包已更新' : '表情包已添加');
        onSaved?.();
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
              .addEventListener('click', closeActiveSheet);
            confirmSheet
              .querySelector('[data-confirm-pack-delete]')
              .addEventListener('click', () => {
                deleteStickerPack(pack.id);
                closeActiveSheet({ immediate: true });
                toast('表情包已删除');
                onSaved?.();
              });
          },
        });
      });
    },
  });
}

function openStickerEditor({ pack = null, onSaved } = {}) {
  if (pack) {
    openStickerNames({
      pack,
      packName: pack.name,
      items: pack.items,
      onSaved,
    });
    return;
  }

  openSheet({
    title: '新建表情包',
    description: '先给这组表情起个名字，再粘贴图片链接，每行一个。',
    content: `<div class="sticker-editor">
      <label class="field">
        <span class="field__label">名称</span>
        <span class="field__control">
          <input class="field__input" name="packName" maxlength="20" autocomplete="off" placeholder="例如「猫猫日常」">
        </span>
      </label>
      <label class="field">
        <span class="field__label">图片链接</span>
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea field__textarea--links" name="packUrls" rows="6" spellcheck="false" placeholder="https://example.com/1.png&#10;https://example.com/2.png"></textarea>
        </span>
      </label>
      <p class="field__hint">只支持 http 或 https 图片地址。下一步再逐一给表情起名。</p>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-next-step>下一步</button>`,
    onMount: (sheet) => {
      const nameInput = sheet.querySelector('[name="packName"]');
      const urlInput = sheet.querySelector('[name="packUrls"]');
      sheet.querySelector('[data-next-step]').addEventListener('click', () => {
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
        openStickerNames({
          packName: name,
          items: urls.map((url, index) => ({ url, name: `表情 ${index + 1}` })),
          onSaved,
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
        <small>${pack.items.length} 张 · ${escapeHTML(pack.items.slice(0, 2).map((item) => item.name).join('、'))}${pack.items.length > 2 ? '…' : ''}</small>
      </span>
      <label class="switch">
        <input type="checkbox" data-pack-enabled="${pack.id}"${pack.enabled ? ' checked' : ''} aria-label="启用${escapeHTML(pack.name)}">
        <span class="switch__track"></span>
      </label>
    </header>
    <div class="sticker-strip">
      ${pack.items
        .slice(0, 5)
        .map(
          (item) =>
            `<span class="sticker-thumb"><span class="sticker-thumb__fallback">${icon('image')}</span><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.name)}" title="${escapeHTML(item.name)}" loading="lazy"></span>`,
        )
        .join('')}
      ${pack.items.length > 5 ? `<span class="sticker-thumb sticker-thumb--more">+${pack.items.length - 5}</span>` : ''}
    </div>
    <button class="text-button" type="button" data-edit-pack="${pack.id}">${icon('pencil-simple')}编辑</button>
  </article>`;
}

export function renderStickers({ refresh }) {
  const packs = getStickerPacks();
  const screen = document.createElement('section');
  screen.className = 'screen screen--stickers';

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
      <div class="page-content page-content--stickers${packs.length ? '' : ' page-content--stickers-empty'}">
        <p class="page-intro">AI 会理解表情含义，在合适的对话里使用。</p>
        ${
          packs.length
            ? `<div class="sticker-packs">${packs.map(packCard).join('')}</div>`
            : `<section class="stickers-empty">
                <div class="stickers-empty__main">
                  <img class="stickers-empty__art" src="src/assets/sticker-empty.png" alt="两张可爱的猫咪表情卡片">
                  <h2>还没有表情包</h2>
                  <p>添加几张常用图片，让对话更有表情。</p>
                  <button class="button button--primary stickers-empty__create" type="button" data-empty-add>${icon('plus')}创建表情包</button>
                  <button class="stickers-empty__link" type="button" data-link-import>从链接导入</button>
                </div>
                <p class="stickers-empty__tip">${icon('sparkle')}<span>为表情包起一个清楚的名字，<br>AI 会更准确地使用它。</span></p>
              </section>`
        }
      </div>
    </main>`;

  watchBrokenImages(screen);

  const openNew = () => {
    window.location.hash = '#/stickers/new';
  };

  screen.querySelector('[data-new-pack]').addEventListener('click', openNew);
  screen.querySelector('[data-empty-add]')?.addEventListener('click', openNew);
  screen.querySelector('[data-link-import]')?.addEventListener('click', () => {
    window.location.hash = '#/stickers/new/links';
  });

  screen.querySelectorAll('[data-edit-pack]').forEach((button) => {
    button.addEventListener('click', () => {
      const pack = packs.find((item) => item.id === button.dataset.editPack);
      if (pack) openStickerEditor({ pack, onSaved: refresh });
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
