import { appHeader } from '../components/app-header.js';
import { openChoiceSheet } from '../components/choice-sheet.js';
import { icon, iconButton } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import {
  addMemoryCategory,
  addMemoryEntry,
  deleteMemoryEntry,
  getCharacter,
  getChatMemory,
  updateMemoryEntry,
  updateMemorySettings,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function openContextSheet(characterId, onSaved) {
  const memory = getChatMemory(characterId);
  openSheet({
    title: '带入上下文',
    description: '每次回复时，最近这段对话会一起发给 AI。',
    content: `<div class="settings-figure"><strong data-context-output>${memory.contextCount}</strong><span>条消息</span></div>
      <label class="range-row">
        <span class="range-row__top"><span>消息条数</span><output>${memory.contextCount}</output></span>
        <input class="range" type="range" min="2" max="120" step="1" value="${memory.contextCount}" data-context-range>
      </label>
      <p class="sheet-note">更多上下文更连贯，也会多消耗一些 token。</p>`,
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
  openChoiceSheet({
    title: '自动总结',
    current: String(memory.summaryEvery || 0),
    options: [
      { value: '0', label: '关闭', meta: '只保留手动写下的记忆', icon: 'minus-circle' },
      { value: '10', label: '每 10 条', meta: '对话很密集时' },
      { value: '20', label: '每 20 条' },
      { value: '30', label: '每 30 条', meta: '比较均衡' },
      { value: '50', label: '每 50 条' },
      { value: '100', label: '每 100 条', meta: '更省 token' },
    ],
    onChoose: (value) => {
      updateMemorySettings(characterId, { summaryEvery: Number(value) });
      toast(Number(value) ? `每 ${value} 条消息自动整理` : '已关闭自动总结');
      onSaved?.();
    },
  });
}

function openCategorySheet(characterId, onSaved) {
  openSheet({
    title: '新增分类',
    description: '给记忆分个组，之后会一起出现在 AI 的设定里。',
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
    description: '写下想让 AI 一直记得的事。',
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
      <p class="field__hint">这条记忆会随每次回复一起交给 AI，尽量写得短而具体。</p>
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
      backTo: `#/chat/${character.id}`,
      action: iconButton({
        name: 'plus',
        label: '新增记忆',
        action: 'data-new-memory',
      }),
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
      <p class="page-intro">只属于你和${escapeHTML(character.name)}的记忆。每次回复时，这些事会一起交给 AI。</p>
      <section class="memory-overview">
        <span class="memory-overview__figure"><strong>${memory.items.length}</strong><span>条记忆</span></span>
        <span class="memory-overview__hint">最近 ${memory.contextCount} 条对话 · ${memory.summaryEvery ? `每 ${memory.summaryEvery} 条整理` : '不自动整理'}</span>
      </section>
      <div class="settings-group">
        <div class="settings-group__card">
          <button class="settings-row" type="button" data-memory-context>
            <span class="settings-row__icon">${icon('chat-circle-text')}</span>
            <span class="settings-row__label">带入上下文</span>
            <span class="settings-row__trailing">
              <span class="settings-row__value">最近 ${memory.contextCount} 条</span>
              <span class="settings-row__chevron">${icon('caret-right')}</span>
            </span>
          </button>
          <button class="settings-row" type="button" data-memory-summary>
            <span class="settings-row__icon">${icon('clock-counter-clockwise')}</span>
            <span class="settings-row__label">自动总结</span>
            <span class="settings-row__trailing">
              <span class="settings-row__value">${memory.summaryEvery ? `每 ${memory.summaryEvery} 条` : '已关闭'}</span>
              <span class="settings-row__chevron">${icon('caret-right')}</span>
            </span>
          </button>
        </div>
      </div>
      <section class="memory-section">
        <div class="memory-section__head">
          <h2>分类</h2>
          <button class="text-button text-button--small" type="button" data-new-category>${icon('plus')}新增</button>
        </div>
        <div class="memory-filters">
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
        </div>
      </section>
      <section class="memory-section">
        <div class="memory-section__head">
          <h2>记忆</h2>
        </div>
        ${
          recent.length
            ? `<div class="memory-list">
                ${recent
                  .map(
                    (entry) => `<article class="memory-entry" data-entry="${entry.id}">
                      <div class="memory-entry__head">
                        <span class="memory-entry__category">${escapeHTML(entry.category)}</span>
                        ${entry.source === 'auto' ? '<span class="memory-entry__auto">自动整理</span>' : ''}
                        <span class="memory-entry__actions">
                          <button class="memory-entry__action" type="button" aria-label="编辑记忆" data-edit-entry="${entry.id}">${icon('pencil-simple')}</button>
                          <button class="memory-entry__action" type="button" aria-label="删除记忆" data-delete-entry="${entry.id}">${icon('trash-simple')}</button>
                        </span>
                      </div>
                      <p class="memory-entry__content">${escapeHTML(entry.content)}</p>
                    </article>`,
                  )
                  .join('')}
              </div>`
            : `<div class="memory-empty">
                <span class="memory-empty__icon">${icon('brain')}</span>
                <p>${activeFilter === 'all' ? '还没有写下记忆。' : '这个分类还是空的。'}</p>
                <button class="text-button" type="button" data-new-memory>写一条记忆</button>
              </div>`
        }
      </section>`;
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
