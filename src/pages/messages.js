import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { openCharacterEditor } from '../components/character-editor.js';
import {
  bindLongPress,
  openConversationActions,
} from '../components/conversation-actions.js';
import { conversationItem } from '../components/conversation-item.js';
import { icon, iconButton } from '../components/icons.js';
import { openSearchSheet } from '../components/search-sheet.js';
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
  screen.className = 'screen';
  const conversations = getSortedConversations();

  const openCreate = () => {
    openCharacterEditor({
      onSaved: (character) => {
        window.location.hash = `#/chat/${character.id}`;
      },
    });
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
        ${conversations.length
          ? `<div class="conversation-list conversation-list--main">
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
            <p class="list-hint">长按对话可以置顶、免打扰或删除</p>`
          : ''}
      </div>
    </main>
    ${bottomNav('messages')}`;

  if (!conversations.length) {
    screen
      .querySelector('.page-content--messages')
      .appendChild(emptyState(openCreate));
  }

  screen.querySelector('[data-action="search"]')?.addEventListener('click', () => {
    openSearchSheet({
      title: '搜索消息',
      placeholder: '搜索名字或对话',
      emptyText: '没有找到相关对话',
      items: conversations.map(({ character, lastMessage }) => ({
        character,
        href: `#/chat/${character.id}`,
        subtitle: messagePreview(lastMessage),
        searchText: `${character.name} ${character.role} ${character.tagline} ${messagePreview(lastMessage)}`,
      })),
    });
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
