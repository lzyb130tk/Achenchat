import { appHeader } from '../components/app-header.js';
import { iconButton, uiIcon } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import {
  addMemoryCategory,
  addMemoryEntry,
  deleteFavorite,
  deleteMemoryEntry,
  getCharacter,
  getChatMemory,
  getFavorites,
  updateMemoryEntry,
  updateMemorySettings,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function headerIconButton(name, label, action) {
  return `<button class="icon-button" type="button" aria-label="${label}" ${action}>${uiIcon(name, { size: 19 })}</button>`;
}

function openContextSheet(characterId, onSaved) {
  const memory = getChatMemory(characterId);
  openSheet({
    title: '带入上下文',
    
    content: `<div class="settings-figure"><strong data-context-output>${memory.contextCount}</strong><span>条消息</span></div>
      <label class="range-row">
        <span class="range-row__top"><span>消息条数</span><output>${memory.contextCount}</output></span>
        <input class="range" type="range" min="2" max="120" step="1" value="${memory.contextCount}" data-context-range>
      </label>
      `,
    actions: `<button class="button button--primary" type="button" data-save-context>保存</button>`,
    onMount: (sheet) => {
      const range = sheet.querySelector('[data-context-range]');
      const output = sheet.querySelector('[data-context-output]');
      range.addEventListener('input', () => {
        output.textContent = range.value;
        range.closest('.range-row').querySelector('output').textContent = range.value;
      });
      sheet.querySelector('[data-save-context]').addEventListener('click', () => {
        updateMemorySettings(characterId, { contextCount: Number(range.value) });
        closeActiveSheet();
        toast('上下文条数已更新');
        onSaved?.();
      });
    },
  });
}

function openSummarySheet(characterId, onSaved) {
  const memory = getChatMemory(characterId);
  const enabled = memory.summaryEvery > 0;
  const rounds = Math.max(1, memory.summaryEvery || 20);
  openSheet({
    title: '自动总结',
    
    content: `<label class="switch-row">
        <span class="switch-row__copy">
          <strong>启用总结</strong>
          <small>关闭后只保留手动写下的记忆</small>
        </span>
        <span class="switch">
          <input type="checkbox" data-summary-enabled${enabled ? ' checked' : ''} aria-label="开启自动总结">
          <span class="switch__track"></span>
        </span>
      </label>
      <label class="field" data-summary-field>
        <span class="field__label">每多少轮</span>
        <span class="field__control">
          <input class="field__input" type="number" inputmode="numeric" min="1" max="200" step="1" value="${rounds}" data-summary-rounds${enabled ? '' : ' disabled'}>
        </span>
      </label>
      <p class="sheet-note" data-summary-progress>已经积累 ${memory.roundsSinceSummary || 0} 轮。</p>`,
    actions: `<button class="button button--primary" type="button" data-save-summary>保存</button>`,
    onMount: (sheet) => {
      const toggle = sheet.querySelector('[data-summary-enabled]');
      const input = sheet.querySelector('[data-summary-rounds]');
      const field = sheet.querySelector('[data-summary-field]');
      const syncEnabled = () => {
        input.disabled = !toggle.checked;
        field.classList.toggle('is-disabled', !toggle.checked);
      };
      toggle.addEventListener('change', syncEnabled);
      syncEnabled();
      sheet.querySelector('[data-save-summary]').addEventListener('click', () => {
        let every = 0;
        if (toggle.checked) {
          const parsed = Math.round(Number(input.value));
          every = Math.min(200, Math.max(1, Number.isFinite(parsed) ? parsed : 20));
        }
        updateMemorySettings(characterId, { summaryEvery: every });
        closeActiveSheet();
        toast(every ? `每 ${every} 轮自动整理` : '已关闭自动总结');
        onSaved?.();
      });
    },
  });
}

function openCategorySheet(characterId, onSaved) {
  openSheet({
    title: '新增分类',
    
    content: `<label class="field">
      <span class="field__label">分类名称</span>
      <span class="field__control">
        <input class="field__input" name="categoryName" maxlength="16" autocomplete="off" placeholder="例如：饮食、工作、纪念日">
      </span>
    </label>`,
    actions: `<button class="button button--primary" type="button" data-save-category>添加分类</button>`,
    onMount: (sheet) => {
      const input = sheet.querySelector('[name="categoryName"]');
      input.focus();
      sheet.querySelector('[data-save-category]').addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) {
          toast('给分类起个名字', { tone: 'danger' });
          input.focus();
          return;
        }
        addMemoryCategory(characterId, name);
        closeActiveSheet();
        toast('分类已添加');
        onSaved?.(name);
      });
    },
  });
}

function openEntrySheet(characterId, { entry = null, defaultCategory = '', onSaved } = {}) {
  const memory = getChatMemory(characterId);
  const categories = memory.categories.length
    ? memory.categories
    : ['其他'];
  const selected =
    entry?.category ||
    (categories.includes(defaultCategory) ? defaultCategory : categories[0]);
  openSheet({
    title: entry ? '编辑记忆' : '新增记忆',
   
    content: `<div class="memory-form">
      <label class="field">
        <span class="field__label">分类</span>
        <span class="field__control field__control--select">
          <select class="field__input field__select" name="entryCategory">
            ${categories
              .map(
                (name) =>
                  `<option value="${escapeHTML(name)}"${name === selected ? ' selected' : ''}>${escapeHTML(name)}</option>`,
              )
              .join('')}
          </select>
        </span>
      </label>
      <label class="field">
        <span class="field__label">内容</span>
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea" name="entryContent" rows="5" maxlength="600" placeholder="例如：周末喜欢去安静的咖啡馆，不太喜欢人多的地方。">${escapeHTML(entry?.content || '')}</textarea>
        </span>
      </label>
      
    </div>`,
    actions: `<button class="button button--primary" type="button" data-save-entry>${entry ? '保存修改' : '添加记忆'}</button>`,
    onMount: (sheet) => {
      const categoryInput = sheet.querySelector('[name="entryCategory"]');
      const contentInput = sheet.querySelector('[name="entryContent"]');
      const save = () => {
        const content = contentInput.value.trim();
        const category = categoryInput.value;
        if (!content) {
          toast('写下一点内容', { tone: 'danger' });
          contentInput.focus();
          return;
        }
        if (entry) {
          updateMemoryEntry(characterId, entry.id, { content, category });
          toast('记忆已更新');
        } else {
          addMemoryEntry(characterId, { category, content, source: 'manual' });
          toast('记忆已添加');
        }
        closeActiveSheet();
        onSaved?.(category);
      };
      contentInput.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          save();
        }
      });
      sheet.querySelector('[data-save-entry]').addEventListener('click', save);
      if (!entry) contentInput.focus();
    },
  });
}

function confirmDeleteEntry(characterId, entry, onDeleted) {
  openSheet({
    title: '删除这条记忆',
    description: '删除后，AI 不会再记得这件事。',
    content: `<p class="memory-delete-preview">${escapeHTML(entry.content)}</p>`,
    actions: `<div class="button-row">
      <button class="button button--secondary" type="button" data-cancel-memory-delete>取消</button>
      <button class="button button--danger" type="button" data-confirm-memory-delete>删除</button>
    </div>`,
    onMount: (sheet) => {
      sheet
        .querySelector('[data-cancel-memory-delete]')
        .addEventListener('click', () => closeActiveSheet());
      sheet
        .querySelector('[data-confirm-memory-delete]')
        .addEventListener('click', () => {
          deleteMemoryEntry(characterId, entry.id);
          closeActiveSheet();
          toast('记忆已删除');
          onDeleted?.();
        });
    },
  });
}

export function renderMemory({ characterId }) {
  const character = getCharacter(characterId);
  if (!character) return null;

  let activeFilter = 'all';
  const screen = document.createElement('section');
  screen.className = 'screen';
  screen.innerHTML = `
    ${appHeader({
      title: '聊天记忆',
      backTo: `#/chat/${character.id}/settings`,
      action: [
        headerIconButton('chat', '带入上下文', 'data-memory-context'),
        headerIconButton('hourglass', '自动总结', 'data-memory-summary'),
        headerIconButton('plus', '新增记忆', 'data-new-memory'),
      ].join(''),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--memory" data-memory-content></div>
    </main>`;

  const content = screen.querySelector('[data-memory-content]');

  const paint = () => {
    const memory = getChatMemory(character.id);
    if (
      activeFilter !== 'all' &&
      !memory.categories.includes(activeFilter)
    ) {
      activeFilter = 'all';
    }
    const counts = new Map();
    for (const entry of memory.items) {
      counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    }
    const visible =
      activeFilter === 'all'
        ? memory.items
        : memory.items.filter((entry) => entry.category === activeFilter);
    const recent = visible.slice().reverse();

    content.innerHTML = `
      <section class="memory-filters" aria-label="记忆分类">
        <button class="memory-filter${activeFilter === 'all' ? ' is-selected' : ''}" type="button" data-filter="all">
          全部 <span>${memory.items.length}</span>
        </button>
        ${memory.categories
          .map(
            (name) => `<button class="memory-filter${activeFilter === name ? ' is-selected' : ''}" type="button" data-filter="${escapeHTML(name)}">
              ${escapeHTML(name)} <span>${counts.get(name) || 0}</span>
            </button>`,
          )
          .join('')}
        <button class="memory-filter memory-filter--add" type="button" data-new-category aria-label="新增分类">
          ${uiIcon('plus', { size: 13 })}
        </button>
      </section>
      ${
        recent.length
          ? `<div class="memory-cards">
              ${recent
                .map(
                  (entry, index) => `<article class="memory-card" data-entry="${entry.id}" style="--card-index:${index}">
                    <div class="memory-card__head">
                      <span class="memory-card__category">${escapeHTML(entry.category)}</span>
                      ${entry.source === 'auto' ? '<span class="memory-card__auto">自动整理</span>' : ''}
                      <span class="memory-card__actions">
                        <button class="memory-card__action" type="button" aria-label="编辑记忆" data-edit-entry="${entry.id}">${uiIcon('pencil', { size: 14 })}</button>
                        <button class="memory-card__action" type="button" aria-label="删除记忆" data-delete-entry="${entry.id}">${uiIcon('trash', { size: 14 })}</button>
                      </span>
                    </div>
                    <p class="memory-card__content">${escapeHTML(entry.content)}</p>
                  </article>`,
                )
                .join('')}
            </div>`
          : `<div class="memory-empty">
              <span class="memory-empty__icon">${uiIcon('archive', { size: 28 })}</span>
              <p>${activeFilter === 'all' ? '还没有写下记忆。' : '这个分类还是空的。'}</p>
              <button class="text-button" type="button" data-new-memory>写一条记忆</button>
            </div>`
      }`;
  };

  const openNewEntry = () => {
    openEntrySheet(character.id, {
      defaultCategory: activeFilter === 'all' ? '' : activeFilter,
      onSaved: (category) => {
        if (category) activeFilter = category;
        paint();
      },
    });
  };

  screen.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-memory]')) {
      openNewEntry();
      return;
    }
    if (event.target.closest('[data-new-category]')) {
      openCategorySheet(character.id, (name) => {
        if (name) activeFilter = name;
        paint();
      });
      return;
    }
    if (event.target.closest('[data-memory-context]')) {
      openContextSheet(character.id, paint);
      return;
    }
    if (event.target.closest('[data-memory-summary]')) {
      openSummarySheet(character.id, paint);
      return;
    }
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      activeFilter = filter.dataset.filter;
      paint();
      return;
    }
    const editButton = event.target.closest('[data-edit-entry]');
    if (editButton) {
      const entry = getChatMemory(character.id).items.find(
        (item) => item.id === editButton.dataset.editEntry,
      );
      if (entry) {
        openEntrySheet(character.id, {
          entry,
          onSaved: () => paint(),
        });
      }
      return;
    }
    const deleteButton = event.target.closest('[data-delete-entry]');
    if (deleteButton) {
      const entry = getChatMemory(character.id).items.find(
        (item) => item.id === deleteButton.dataset.deleteEntry,
      );
      if (entry) confirmDeleteEntry(character.id, entry, paint);
    }
  });

  paint();
  return { element: screen };
}

/* --------------------------------------------------------------------------
   收藏
   从聊天设置 → 趣味进入。条目按时间排序，支持标题 / 内容实时搜索，
   点开是还原当时对话的弹层。
   -------------------------------------------------------------------------- */

function favoriteTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function favoritePreview(favorite) {
  const parts = favorite.messages
    .map((message) => {
      if (message.type === 'sticker') return '[表情]';
      if (message.type === 'redpacket') return '[红包]';
      if (message.type === 'image') return '[图片]';
      return (message.content || '').trim();
    })
    .filter(Boolean);
  return parts.slice(0, 3).join(' ／ ') || '没有文字内容';
}

function favoriteMessageMarkup(message) {
  const mine = message.role === 'user';
  let inner = `<span class="message-bubble__text">${escapeHTML(message.content || '')}</span>`;
  if (message.type === 'sticker' && message.url) {
    inner = `<img class="favorite-message__sticker" src="${escapeHTML(message.url)}" alt="${escapeHTML(message.name || '表情')}" loading="lazy">`;
  } else if (message.type === 'redpacket') {
    inner = `<span class="favorite-message__packet">${uiIcon('red-packet', { size: 14 })}红包 ¥${((message.amountFen || 0) / 100).toFixed(2)}</span>`;
  } else if (message.type === 'image') {
    inner = `<span class="favorite-message__image">${uiIcon('image', { size: 14 })}图片${message.images?.length > 1 ? ` ×${message.images.length}` : ''}</span>`;
  }
  return `<div class="favorite-message favorite-message--${mine ? 'user' : 'assistant'}"><div class="message-bubble message-bubble--${mine ? 'user' : 'assistant'}">${inner}</div></div>`;
}

export function renderFavorites({ characterId = '' } = {}) {
  const screen = document.createElement('section');
  screen.className = 'screen screen--favorites';

  let query = '';
  let order = 'desc';
  let searchOpen = false;

  const backTo = characterId ? `#/chat/${characterId}/settings` : '#/me';

  screen.innerHTML = `
    ${appHeader({
      title: '收藏',
      backTo,
      action: `${iconButton({
        name: 'magnifying-glass',
        label: '搜索收藏',
        action: 'data-favorites-search',
      })}${iconButton({
        name: 'arrows-down-up',
        label: '切换时间排序',
        action: 'data-favorites-sort',
        className: 'favorites-sort',
      })}`,
    })}
    <main class="page-scroll">
      <div class="page-content page-content--favorites">
        <label class="favorites-search" data-favorites-searchbar hidden>
          <span>${uiIcon('search', { size: 16 })}</span>
          <input type="search" data-favorites-query placeholder="搜索标题或内容" aria-label="搜索收藏" autocomplete="off">
          <button class="favorites-search__clear" type="button" data-favorites-clear aria-label="清空搜索">${uiIcon('x', { size: 14 })}</button>
        </label>
        <div class="favorites-list" data-favorites-list></div>
      </div>
    </main>`;

  const list = screen.querySelector('[data-favorites-list]');
  const searchBar = screen.querySelector('[data-favorites-searchbar]');
  const input = screen.querySelector('[data-favorites-query]');
  const sortButton = screen.querySelector('.favorites-sort');

  const visibleFavorites = () => {
    const needle = query.trim().toLocaleLowerCase();
    const items = getFavorites().filter((favorite) => {
      if (!needle) return true;
      const haystack = `${favorite.title} ${favorite.characterName} ${favorite.messages
        .map((message) => message.content || '')
        .join(' ')}`.toLocaleLowerCase();
      return haystack.includes(needle);
    });
    return items
      .slice()
      .sort((a, b) =>
        order === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      );
  };

  const openFavorite = (favorite) => {
    openSheet({
      title: favorite.title,
      description: `${favorite.characterName || '对方'} · ${favorite.messages.length} 条 · ${favoriteTime(favorite.createdAt)}`,
      className: 'favorite-sheet',
      content: `<div class="favorite-thread">${favorite.messages
        .map(favoriteMessageMarkup)
        .join('')}</div>`,
      actions: `<button class="button button--secondary" type="button" data-favorite-remove>删除这条收藏</button>`,
      onMount: (sheet) => {
        sheet
          .querySelector('[data-favorite-remove]')
          .addEventListener('click', () => {
            deleteFavorite(favorite.id);
            closeActiveSheet({ immediate: true });
            toast('收藏已删除');
            paint();
          });
      },
    });
  };

  const paint = () => {
    sortButton.classList.toggle('is-asc', order === 'asc');
    sortButton.setAttribute(
      'aria-label',
      order === 'desc' ? '当前按时间降序，点击切换' : '当前按时间升序，点击切换',
    );
    const items = visibleFavorites();
    if (!items.length) {
      list.innerHTML = `<div class="favorites-empty">
        <span class="favorites-empty__icon">${uiIcon('bookmark', { size: 28 })}</span>
        <h2>${query.trim() ? '没有匹配的收藏' : '还没有收藏'}</h2>
        <p>${query.trim() ? '换个关键词试试。' : '长按一条消息，选「多选」，再点顶栏的收藏。'}</p>
      </div>`;
      return;
    }
    list.innerHTML = items
      .map(
        (favorite) => `<button class="favorite-card" type="button" data-favorite="${favorite.id}">
          <span class="favorite-card__top">
            <span class="favorite-card__title">${escapeHTML(favorite.title)}</span>
            <time class="favorite-card__time">${favoriteTime(favorite.createdAt)}</time>
          </span>
          <span class="favorite-card__meta">${escapeHTML(favorite.characterName || '对方')} · ${favorite.messages.length} 条消息</span>
          <span class="favorite-card__preview">${escapeHTML(favoritePreview(favorite))}</span>
        </button>`,
      )
      .join('');
  };

  screen.addEventListener('click', (event) => {
    if (event.target.closest('[data-favorites-search]')) {
      searchOpen = !searchOpen;
      searchBar.hidden = !searchOpen;
      if (searchOpen) input.focus();
      return;
    }
    if (event.target.closest('[data-favorites-sort]')) {
      order = order === 'desc' ? 'asc' : 'desc';
      paint();
      return;
    }
    if (event.target.closest('[data-favorites-clear]')) {
      query = '';
      input.value = '';
      paint();
      input.focus();
      return;
    }
    const card = event.target.closest('[data-favorite]');
    if (card) {
      const favorite = getFavorites().find((item) => item.id === card.dataset.favorite);
      if (favorite) openFavorite(favorite);
    }
  });

  input.addEventListener('input', () => {
    query = input.value;
    paint();
  });

  paint();
  return { element: screen };
}
