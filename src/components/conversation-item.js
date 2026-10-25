import { escapeHTML, formatRelativeTime } from '../services/utils.js';
import { characterAvatar } from './avatar.js';

export function conversationItem({ character, lastMessage, unread = 0 }) {
  const preview = `${lastMessage.role === 'user' ? '你：' : ''}${lastMessage.content}`;
  return `<a class="conversation-item" href="#/chat/${character.id}" aria-label="和${escapeHTML(character.name)}聊天">
    ${characterAvatar(character, 'md')}
    <span class="conversation-item__main">
      <span class="conversation-item__top">
        <span class="conversation-item__name">${escapeHTML(character.name)}</span>
        <time class="conversation-item__time">${formatRelativeTime(lastMessage.createdAt)}</time>
      </span>
      <span class="conversation-item__bottom">
        <span class="conversation-item__preview">${escapeHTML(preview)}</span>
        ${unread ? `<span class="conversation-item__unread">${unread > 9 ? '9+' : unread}</span>` : ''}
      </span>
    </span>
  </a>`;
}
