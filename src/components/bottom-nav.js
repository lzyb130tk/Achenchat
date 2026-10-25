import { getUnreadTotal } from '../services/store.js';
import { icon } from './icons.js';

const TABS = [
  { id: 'messages', label: '消息', href: '#/messages', icon: 'chat-circle-dots' },
  { id: 'contacts', label: '联系人', href: '#/contacts' },
  { id: 'discover', label: '发现', href: '#/discover', icon: 'compass' },
  { id: 'me', label: '我', href: '#/me', icon: 'user-circle' },
];

export function bottomNav(activeTab) {
  const hasUnread = getUnreadTotal() > 0;
  return `<nav class="bottom-nav" aria-label="主导航">
    ${TABS.map((tab) => {
      const active = tab.id === activeTab;
      return `<a class="bottom-nav__item${active ? ' is-active' : ''}" href="${tab.href}" ${active ? 'aria-current="page"' : ''}>
        <span class="bottom-nav__icon">
          ${tab.id === 'contacts'
            ? `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5A5.5 5.5 0 0 1 9 12h0a5.5 5.5 0 0 1 5.5 5.5V19"/><circle cx="17" cy="9" r="2.5"/><path d="M16 13.2c2.8-.2 5 1.8 5 4.5V19"/>
              </svg>`
            : icon(tab.icon, active ? 'fill' : 'regular')}
          ${tab.id === 'messages' && hasUnread ? '<span class="bottom-nav__dot" aria-label="有新消息"></span>' : ''}
        </span>
        <span class="bottom-nav__label">${tab.label}</span>
      </a>`;
    }).join('')}
  </nav>`;
}
