import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import {
  bindLongPress,
  openConversationActions,
} from '../components/conversation-actions.js';
import { conversationItem } from '../components/conversation-item.js';
import { icon, iconButton } from '../components/icons.js';
import { onDataChanged } from '../services/events.js';
import { getSortedConversations } from '../services/store.js';
import { messagePreview } from '../services/utils.js';

function emptyState(onCreate) {
  const element = document.createElement('section');
  element.className = 'empty-state';
  element.innerHTML = `<span class="empty-state__icon">${icon('chat-circle-dots')}</span>
    <h2>还没有对话</h2>
    <p>去找一个想说话的人。</p>
    <button class="button button--primary empty-state__button" type="button" data-empty-create>新建伙伴</button>`;
  element.querySelector('[data-empty-create]').addEventListener('click', onCreate);
  return element;
}

export function renderMessages({ refresh }) {
  const screen = document.createElement('section');
  screen.className = 'screen screen--messages';
  const conversations = getSortedConversations();

  const openCreate = () => {
    window.location.hash = '#/characters/new';
  };

  const headerAction = `${iconButton({
    name: 'magnifying-glass',
    label: '搜索消息',
    action: 'data-action="search"',
  })}${iconButton({
    name: 'plus',
    label: '新建伙伴',
    action: 'data-action="create"',
  })}`;

  screen.innerHTML = `
    ${appHeader({ title: '消息', action: headerAction })}
    <main class="page-scroll">
      <div class="page-content page-content--messages">
        <label class="messages-search">
          <span>${icon('magnifying-glass')}</span>
          <input type="search" data-message-search placeholder="搜索联系人或聊天" aria-label="搜索联系人或聊天" autocomplete="off">
        </label>
        ${conversations.length
          ? `<h2 class="messages-section-title">最近消息</h2>
            <div class="conversation-list conversation-list--main">
              ${conversations
                .map(({ character, conversation, lastMessage }) =>
                  conversationItem({
                    character,
                    lastMessage,
                    unread: conversation.unread,
                    pinned: conversation.pinned,
                    data: `data-conversation-id="${character.id}"`,
                  }),
                )
                .join('')}
            </div>
            <p class="messages-search-empty" data-search-empty hidden>没有找到相关对话</p>`
          : ''}
        <p class="messages-privacy">聊天记录保存在本机，回复由你配置的 AI 服务处理</p>
      </div>
    </main>
    ${bottomNav('messages')}`;

  if (!conversations.length) {
    screen
      .querySelector('.page-content--messages')
      .appendChild(emptyState(openCreate));
  }

  const search = screen.querySelector('[data-message-search]');
  screen.querySelector('[data-action="search"]')?.addEventListener('click', () => {
    search.focus();
  });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    screen.querySelectorAll('[data-conversation-id]').forEach((item) => {
      const found = conversations.find(({ character }) => character.id === item.dataset.conversationId);
      const text = found
        ? `${found.character.name} ${found.character.role || ''} ${found.character.tagline || ''} ${messagePreview(found.lastMessage)}`
        : '';
      item.hidden = !text.toLocaleLowerCase().includes(query);
      if (!item.hidden) visible += 1;
    });
    screen.querySelector('[data-search-empty]')?.toggleAttribute('hidden', visible > 0 || !query);
  });

  screen.querySelector('[data-action="create"]')?.addEventListener('click', openCreate);

  bindLongPress(screen, '[data-conversation-id]', (item) => {
    const found = conversations.find(
      ({ character }) => character.id === item.dataset.conversationId,
    );
    if (!found) return;
    openConversationActions({
      character: found.character,
      conversation: found.conversation,
      refresh,
    });
  });

  const unsubscribe = onDataChanged(() => {
    refresh();
  });

  return {
    element: screen,
    cleanup() {
      unsubscribe();
    },
  };
}
