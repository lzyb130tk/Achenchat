import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { characterAvatar } from '../components/avatar.js';
import { contactItem } from '../components/contact-item.js';
import { icon, iconButton } from '../components/icons.js';
import { openSearchSheet } from '../components/search-sheet.js';
import { sectionHeading } from '../components/section-heading.js';
import { CHARACTERS } from '../data/characters.js';
import { escapeHTML } from '../services/utils.js';

export function renderContacts() {
  const partner = CHARACTERS.find((character) => character.relationship === '恋人');
  const friends = CHARACTERS.filter((character) => character.id !== partner?.id);
  const screen = document.createElement('section');
  screen.className = 'screen';

  screen.innerHTML = `
    ${appHeader({
      title: '联系人',
      action: iconButton({ name: 'magnifying-glass', label: '搜索联系人', action: 'data-action="search"' }),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--contacts">
        ${partner
          ? `<a class="love-card" href="#/chat/${partner.id}">
              <span class="love-card__wash" aria-hidden="true"></span>
              ${characterAvatar(partner, 'xl')}
              <span class="love-card__copy">
                <span class="love-card__eyebrow">${escapeHTML(partner.relationship)} · ${escapeHTML(partner.role)}</span>
                <span class="love-card__name">${escapeHTML(partner.name)}</span>
                <span class="love-card__tagline">${escapeHTML(partner.tagline)}</span>
              </span>
              <span class="love-card__arrow">${icon('arrow-up-right')}</span>
            </a>`
          : ''}
        <section class="friends-block">
          ${sectionHeading({ title: '朋友', aside: `${friends.length} 位` })}
          <div class="contact-list">
            ${friends.map((character) => contactItem({ character })).join('')}
          </div>
        </section>
      </div>
    </main>
    ${bottomNav('contacts')}`;

  screen.querySelector('[data-action="search"]')?.addEventListener('click', () => {
    openSearchSheet({
      title: '搜索联系人',
      placeholder: '搜索名字或身份',
      emptyText: '没有找到这位伙伴',
      items: CHARACTERS.map((character) => ({
        character,
        href: `#/chat/${character.id}`,
        subtitle: `${character.role} · ${character.tagline}`,
        searchText: `${character.name} ${character.role} ${character.tagline} ${character.relationship}`,
      })),
    });
  });

  return { element: screen };
}
