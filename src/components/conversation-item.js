import {
  escapeHTML,
  formatRelativeTime,
  messagePreview,
} from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';

export function conversationItem({
  character,
  lastMessage,
  unread = 0,
  pinned = false,
  data = '',
}) {
  const preview = `${lastMessage.role === 'user' ? '你：' : ''}${messagePreview(lastMessage)}`;
  return `<a class="conversation-item${pinned ? ' is-pinned' : ''}" href="#/chat/${character.id}" aria-label="和${escapeHTML(character.name)}聊天" ${data}>
    ${characterAvatar(character, 'md')}
    <span class="conversation-item__main">
      <span class="conversation-item__top">
        <span class="conversation-item__name">${escapeHTML(character.name)}</span>
        ${pinned ? `<span class="conversation-item__pin" aria-label="已置顶">${icon('push-pin', 'fill')}</span>` : ''}
        <time class="conversation-item__time">${formatRelativeTime(lastMessage.createdAt)}</time>
      </span>
      <span class="conversation-item__bottom">
        <span class="conversation-item__preview">${escapeHTML(preview)}</span>
        ${character.muted ? `<span class="conversation-item__muted" aria-label="已免打扰">${icon('bell-slash')}</span>` : ''}
        ${unread ? `<span class="conversation-item__unread">${unread > 9 ? '9+' : unread}</span>` : ''}
      </span>
    </span>
  </a>`;
}
