import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { contactItem } from '../components/contact-item.js';
import { icon, iconButton } from '../components/icons.js';
import { sectionHeading } from '../components/section-heading.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import {
  deleteCharacter,
  getAllCharacters,
  getTags,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function groupedCharacters(characters, tags, filter) {
  const groups = [];
  for (const tag of tags) {
    const members = characters.filter((character) => character.tagId === tag.id);
    if (members.length) groups.push({ id: tag.id, name: tag.name, members });
  }
  const untagged = characters.filter(
    (character) => !tags.some((tag) => tag.id === character.tagId),
  );
  if (untagged.length) groups.push({ id: 'untagged', name: '未分组', members: untagged });

  if (!filter || filter === 'all') return groups;
  return groups.filter((group) => group.id === filter);
}

export function renderContacts({ refresh, match }) {
  const screen = document.createElement('section');
  screen.className = 'screen screen--contacts';
  const tags = getTags();
  const characters = getAllCharacters();
  const requestedTag = match?.[1] ? decodeURIComponent(match[1]) : '';
  let activeFilter = tags.some((tag) => tag.id === requestedTag) ? requestedTag : 'all';
  let selecting = false;
  const selected = new Set();

  const openCreate = () => {
    window.location.hash = '#/characters/new';
  };

  const headerAction = `${iconButton({
    name: 'magnifying-glass',
    label: '搜索联系人',
    action: 'data-action="search"',
  })}${iconButton({
    name: 'plus',
    label: '新建伙伴',
    action: 'data-action="create"',
  })}`;

  screen.innerHTML = `
    <div class="app-header-slot" data-header-slot></div>
    <main class="page-scroll">
      <div class="page-content page-content--contacts">
        <div class="tag-strip" role="group" aria-label="按标签筛选" data-tag-strip>
          <button class="tag-chip${activeFilter === 'all' ? ' is-selected' : ''}" type="button" data-tag-filter="all">全部</button>
          ${tags
            .map(
              (tag) =>
                `<button class="tag-chip" type="button" data-tag-filter="${tag.id}">${escapeHTML(tag.name)}</button>`,
            )
            .join('')}
          <button class="tag-chip tag-chip--manage" type="button" data-manage-tags>${icon('tag')}标签</button>
          <button class="tag-chip tag-chip--select" type="button" data-action="select">${icon('list-checks')}多选</button>
        </div>
        <div class="contacts-shortcuts">
          <a class="contacts-shortcut" href="#/shake">
            <span class="contacts-shortcut__icon">${icon('user-plus')}</span>
            <span>新的朋友</span>
            ${icon('caret-right')}
          </a>
          <button class="contacts-shortcut" type="button" data-manage-tags>
            <span class="contacts-shortcut__icon">${icon('tag')}</span>
            <span>标签与分组</span>
            ${icon('caret-right')}
          </button>
        </div>
        <div data-contact-body></div>
        <div class="contacts-footer-note" aria-hidden="true">${icon('chats-circle')}<span>新的相遇，会从这里开始</span></div>
      </div>
    </main>
    ${bottomNav('contacts')}`;

  const headerSlot = screen.querySelector('[data-header-slot]');
  const tagStrip = screen.querySelector('[data-tag-strip]');
  const body = screen.querySelector('[data-contact-body]');

  const renderHeader = () => {
    headerSlot.innerHTML = selecting
      ? `<header class="app-header app-header--compact contact-select-header">
          <button class="contact-select-header__cancel" type="button" data-select-cancel>取消</button>
          <div class="app-header__copy">
            <h1 class="app-header__title">已选择 ${selected.size} 位</h1>
          </div>
          <button class="contact-select-header__delete" type="button" data-select-delete${selected.size ? '' : ' disabled'}>删除</button>
        </header>`
      : appHeader({ title: '联系人', action: headerAction });
  };

  const renderBody = () => {
    const groups = groupedCharacters(characters, tags, activeFilter);
    if (!groups.length) {
      body.innerHTML = `<section class="empty-state empty-state--compact">
        <span class="empty-state__icon">${icon('users-three')}</span>
        <h2>${activeFilter === 'all' ? '还没有伙伴' : '这个标签还是空的'}</h2>
        <p>${activeFilter === 'all' ? '新建一位，从一句开场白开始。' : '在伙伴资料里，给他加上这个标签。'}</p>
      </section>`;
      return;
    }
    body.innerHTML = groups
      .map(
        (group) => `<section class="contact-group">
          ${sectionHeading({
            title: `${group.name} · ${group.members.length}`,
          })}
          <div class="contact-list">
            ${group.members
              .map((character) =>
                contactItem({
                  character,
                  selectable: selecting,
                  selected: selected.has(character.id),
                  data: selecting ? `data-contact-select="${character.id}"` : '',
                }),
              )
              .join('')}
          </div>
        </section>`,
      )
      .join('');
  };

  const syncFilterChips = () => {
    screen.querySelectorAll('[data-tag-filter]').forEach((chip) => {
      chip.classList.toggle('is-selected', chip.dataset.tagFilter === activeFilter);
    });
  };

  const enterSelect = () => {
    selecting = true;
    screen.classList.add('is-selecting');
    selected.clear();
    activeFilter = 'all';
    syncFilterChips();
    tagStrip.hidden = true;
    renderHeader();
    renderBody();
  };

  const exitSelect = () => {
    selecting = false;
    screen.classList.remove('is-selecting');
    selected.clear();
    tagStrip.hidden = false;
    renderHeader();
    renderBody();
  };

  const toggleSelected = (id) => {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    const row = body.querySelector(`[data-contact-select="${id}"]`);
    if (row) {
      const active = selected.has(id);
      row.classList.toggle('is-selected', active);
      row.setAttribute('aria-pressed', String(active));
      row.querySelector('.contact-item__check').innerHTML = icon(
        active ? 'check-circle' : 'circle',
        active ? 'fill' : 'regular',
      );
    }
    renderHeader();
  };

  const openDeleteSheet = () => {
    if (!selected.size) return;
    const count = selected.size;
    openSheet({
      title: `删除 ${count} 位伙伴？`,
      description: '聊天记录和伙伴设置会一并清除，无法恢复。',
      actions: `<div class="button-row">
        <button class="button button--secondary" type="button" data-cancel-delete>取消</button>
        <button class="button button--danger" type="button" data-confirm-delete>删除</button>
      </div>`,
      onMount: (sheet) => {
        sheet.querySelector('[data-cancel-delete]').addEventListener('click', closeActiveSheet);
        sheet.querySelector('[data-confirm-delete]').addEventListener('click', () => {
          for (const id of selected) deleteCharacter(id);
          closeActiveSheet({ immediate: true });
          toast(`已删除 ${count} 位伙伴`);
          refresh();
        });
      },
    });
  };

  renderHeader();
  renderBody();

  screen.addEventListener('click', (event) => {
    const target = event.target;

    if (target.closest('[data-action="select"]')) {
      enterSelect();
      return;
    }
    if (target.closest('[data-select-cancel]')) {
      exitSelect();
      return;
    }
    if (target.closest('[data-select-delete]')) {
      openDeleteSheet();
      return;
    }

    const row = target.closest('[data-contact-select]');
    if (row && selecting) {
      event.preventDefault();
      toggleSelected(row.dataset.contactSelect);
      return;
    }

    const createButton = target.closest('[data-action="create"]');
    if (createButton) {
      openCreate();
      return;
    }

    const searchButton = target.closest('[data-action="search"]');
    if (searchButton) {
      window.location.hash = '#/contacts/search';
      return;
    }

    const manageTags = target.closest('[data-manage-tags]');
    if (manageTags) {
      window.location.hash = '#/contacts/tags';
      return;
    }

    const filterChip = target.closest('[data-tag-filter]');
    if (filterChip) {
      activeFilter = filterChip.dataset.tagFilter;
      syncFilterChips();
      renderBody();
    }
  });

  return { element: screen };
}
