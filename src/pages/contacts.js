import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { openCharacterEditor } from '../components/character-editor.js';
import { contactItem } from '../components/contact-item.js';
import { icon, iconButton } from '../components/icons.js';
import { openSearchSheet } from '../components/search-sheet.js';
import { sectionHeading } from '../components/section-heading.js';
import { openTagManager } from '../components/tag-manager.js';
import {
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

export function renderContacts({ refresh }) {
  const screen = document.createElement('section');
  screen.className = 'screen';
  const tags = getTags();
  const characters = getAllCharacters();
  let activeFilter = 'all';

  const openCreate = () => {
    openCharacterEditor({
      onSaved: (character) => {
        window.location.hash = `#/chat/${character.id}`;
      },
    });
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
    ${appHeader({ title: '联系人', action: headerAction })}
    <main class="page-scroll">
      <div class="page-content page-content--contacts">
        <div class="tag-strip" role="group" aria-label="按标签筛选">
          <button class="tag-chip${activeFilter === 'all' ? ' is-selected' : ''}" type="button" data-tag-filter="all">全部</button>
          ${tags
            .map(
              (tag) =>
                `<button class="tag-chip" type="button" data-tag-filter="${tag.id}">${escapeHTML(tag.name)}</button>`,
            )
            .join('')}
          <button class="tag-chip tag-chip--manage" type="button" data-manage-tags>${icon('tag')}标签</button>
        </div>
        <div data-contact-body></div>
      </div>
    </main>
    ${bottomNav('contacts')}`;

  const body = screen.querySelector('[data-contact-body]');

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
            title: group.name,
            aside: `${group.members.length} 位`,
          })}
          <div class="contact-list">
            ${group.members.map((character) => contactItem({ character })).join('')}
          </div>
        </section>`,
      )
      .join('');
  };

  renderBody();

  screen.querySelectorAll('[data-tag-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.tagFilter;
      screen.querySelectorAll('[data-tag-filter]').forEach((chip) => {
        chip.classList.toggle('is-selected', chip === button);
      });
      renderBody();
    });
  });

  screen.querySelector('[data-manage-tags]').addEventListener('click', () => {
    openTagManager({ onDismiss: refresh });
  });

  screen.querySelector('[data-action="search"]')?.addEventListener('click', () => {
    openSearchSheet({
      title: '搜索联系人',
      placeholder: '搜索名字或身份',
      emptyText: '没有找到这位伙伴',
      items: characters.map((character) => ({
        character,
        href: `#/chat/${character.id}`,
        subtitle: `${character.role} · ${character.tagline}`,
        searchText: `${character.name} ${character.role} ${character.tagline} ${character.relationship}`,
      })),
    });
  });

  screen.querySelector('[data-action="create"]')?.addEventListener('click', openCreate);

  return { element: screen };
}
