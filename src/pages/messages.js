import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { characterAvatar } from '../components/avatar.js';
import { conversationItem } from '../components/conversation-item.js';
import { iconButton, icon } from '../components/icons.js';
import { openSearchSheet } from '../components/search-sheet.js';
import { sectionHeading } from '../components/section-heading.js';
import { getSortedConversations } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function featureCard(item) {
  const { character, conversation, lastMessage } = item;
  const assistantMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const quote = (assistantMessage || lastMessage).content;

  return `<a class="feature-chat" href="#/chat/${character.id}">
    <span class="feature-chat__top">
      <span class="feature-chat__eyebrow"><span class="status-dot status-dot--accent"></span>此刻在线 · ${escapeHTML(character.relationship)}</span>
      ${characterAvatar(character, 'md')}
    </span>
    <span class="feature-chat__content">
      <span class="feature-chat__name">${escapeHTML(character.name)}</span>
      <span class="feature-chat__quote">“${escapeHTML(quote)}”</span>
    </span>
    <span class="feature-chat__footer">
      <span class="feature-chat__cta">继续聊天 ${icon('arrow-up-right')}</span>
      ${conversation.unread ? `<span class="feature-chat__unread">${conversation.unread} 条新消息</span>` : ''}
    </span>
  </a>`;
}

function emptyState() {
  return `<section class="empty-state">
    <span class="empty-state__icon">${icon('chat-circle-dots')}</span>
    <h2>还没有对话</h2>
    <p>去找一个想说话的人。</p>
    <a class="button button--primary empty-state__button" href="#/contacts">看看联系人</a>
  </section>`;
}

export function renderMessages() {
  const screen = document.createElement('section');
  screen.className = 'screen';
  const conversations = getSortedConversations();
  const [featured, ...rest] = conversations;

  screen.innerHTML = `
    ${appHeader({
      title: '消息',
      action: iconButton({ name: 'magnifying-glass', label: '搜索消息', action: 'data-action="search"' }),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--messages">
        ${featured ? featureCard(featured) : emptyState()}
        ${rest.length
          ? `<section class="recent-block">
              ${sectionHeading({ title: '最近', aside: `${rest.length} 段对话` })}
              <div class="conversation-list">
                ${rest
                  .map(({ character, conversation, lastMessage }) =>
                    conversationItem({
                      character,
                      lastMessage,
                      unread: conversation.unread,
                    }),
                  )
                  .join('')}
              </div>
            </section>`
          : ''}
      </div>
    </main>
    ${bottomNav('messages')}`;

  screen.querySelector('[data-action="search"]')?.addEventListener('click', () => {
    openSearchSheet({
      title: '搜索消息',
      placeholder: '搜索名字或对话',
      emptyText: '没有找到相关对话',
      items: conversations.map(({ character, lastMessage }) => ({
        character,
        href: `#/chat/${character.id}`,
        subtitle: lastMessage.content,
        searchText: `${character.name} ${character.role} ${character.tagline} ${lastMessage.content}`,
      })),
    });
  });

  return { element: screen };
}
