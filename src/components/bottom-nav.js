import { getUnreadTotal } from '../services/store.js';
import { uiIcon } from './icons.js';

const TABS = [
  { id: 'messages', label: '消息', href: '#/messages', icon: 'chat' },
  { id: 'contacts', label: '联系人', href: '#/contacts', icon: 'users' },
  { id: 'discover', label: '发现', href: '#/discover', icon: 'compass' },
  { id: 'me', label: '我', href: '#/me', icon: 'user' },
];

export function bottomNav(activeTab) {
  const hasUnread = getUnreadTotal() > 0;
  return `<div class="nav-dock">
    <nav class="bottom-nav" aria-label="主导航">
      ${TABS.map((tab) => {
        const active = tab.id === activeTab;
        const dot =
          tab.id === 'messages' && hasUnread
            ? '<span class="bottom-nav__dot" aria-label="有新消息"></span>'
            : '';
        return `<a class="bottom-nav__item${active ? ' is-active' : ''}" href="${tab.href}" ${active ? 'aria-current="page"' : ''}>
          <span class="bottom-nav__icon">${uiIcon(tab.icon, { size: 23, strokeWidth: 1.7 })}${dot}</span>
          <span class="bottom-nav__label">${tab.label}</span>
        </a>`;
      }).join('')}
    </nav>
  </div>`;
}
