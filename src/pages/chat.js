import { avatar, characterAvatar, profileAvatar } from '../components/avatar.js';
import { createChatComposer } from '../components/chat-composer.js';
import {
  applyChatStyle,
  openChatSettings,
  styleBubble,
} from '../components/chat-settings.js';
import { icon } from '../components/icons.js';
import { dismissMessageBanner } from '../components/message-banner.js';
import { openPartnerSheet } from '../components/partner-sheet.js';
import { openRedPacketSheet } from '../components/red-packet-sheet.js';
import { toast } from '../components/toast.js';
import {
  addMessage,
  claimRedPacket,
  ensureConversation,
  getChatStyle,
  getCharacter,
  getConversation,
  getProfile,
  hasApiConfig,
} from '../services/store.js';
import {
  getReplyState,
  isReplying,
  setActiveChat,
  startReply,
  stopReply,
  subscribeReply,
} from '../services/reply-runner.js';
import { takePendingPrompt } from '../services/prompt.js';
import {
  escapeHTML,
  formatChatDay,
  formatMoney,
  isSameDay,
} from '../services/utils.js';

function chatHeader(character) {
  return `<header class="chat-header">
    <a class="icon-button chat-header__back" href="#/messages" aria-label="返回">${icon('arrow-left')}</a>
    <button class="chat-header__identity" type="button" data-open-profile>
      ${characterAvatar(character, 'sm')}
      <span class="chat-header__copy">
        <span class="chat-header__name">${escapeHTML(character.name)}</span>
        <span class="chat-header__status">${character.muted ? `${icon('bell-slash')}已免打扰` : '<span class="status-dot status-dot--accent"></span>在你的身边'}</span>
      </span>
    </button>
    <button class="icon-button chat-header__action" type="button" aria-label="对话选项" data-open-profile>${icon('dots-three')}</button>
    <button class="icon-button chat-header__action" type="button" aria-label="聊天设置" data-open-settings>${icon('gear-six')}</button>
  </header>`;
}

function redPacketCard(message) {
  const claimable = message.role === 'assistant' && !message.claimed;
  const state =
    message.role === 'user'
      ? '已发出'
      : message.claimed
        ? '已存入钱包'
        : '领取红包';
  return `<button class="red-packet-card${message.claimed ? ' is-claimed' : ''}" type="button"
    ${claimable ? `data-claim-packet="${message.id}"` : 'disabled'}>
    <span class="red-packet-card__icon">${icon('envelope-simple', 'fill')}</span>
    <span class="red-packet-card__copy">
      <strong>${escapeHTML(message.note || '恭喜发财，大吉大利')}</strong>
      <small>${state}</small>
    </span>
    <span class="red-packet-card__amount">${formatMoney(message.amountFen)}</span>
  </button>`;
}

function stickerMessage(message) {
  return `<span class="sticker-message">
    <span class="sticker-message__fallback">${icon('sticker')}</span>
    <img src="${escapeHTML(message.url)}" alt="表情" loading="lazy">
  </span>`;
}

function messageBody(message) {
  if (message.type === 'redpacket') return redPacketCard(message);
  if (message.type === 'sticker') return stickerMessage(message);
  return `<div class="message-bubble message-bubble--${message.role === 'user' ? 'user' : 'assistant'}" data-bubble-text>${escapeHTML(message.content)}</div>`;
}

function messageRow(message, character, profile, showAvatar) {
  const isUser = message.role === 'user';
  const avatarMarkup = isUser
    ? `<span class="message-row__avatar message-row__avatar--user">${profileAvatar(profile, 'xs')}</span>`
    : `<span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span>`;

  return `<div class="message-row message-row--${isUser ? 'user' : 'assistant'}${message.type !== 'text' ? ' message-row--rich' : ''}">
    ${isUser ? '' : avatarMarkup}
    ${messageBody(message)}
    ${isUser ? avatarMarkup : ''}
  </div>`;
}

function dayDivider(timestamp) {
  return `<div class="chat-day"><span>${formatChatDay(timestamp)}</span></div>`;
}

function emptyState(character) {
  return `<div class="chat-empty">
    ${avatar({ mark: character.mark, tone: character.tone, size: 'xl', label: character.name, src: character.avatar })}
    <h2>和${escapeHTML(character.name)}的第一句话</h2>
    <p>不用想好开场白。</p>
  </div>`;
}

function threadMarkup(messages, character, profile, showUserAvatar) {
  if (!messages.length) return emptyState(character);
  let previousTimestamp = null;
  let previousRole = null;
  return messages
    .map((message) => {
      let markup = '';
      if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
        markup += dayDivider(message.createdAt);
        previousRole = null;
      }
      const showAvatar =
        message.role === 'user' ? showUserAvatar : previousRole !== message.role;
      markup += messageRow(message, character, profile, showAvatar);
      previousTimestamp = message.createdAt;
      previousRole = message.role;
      return markup;
    })
    .join('');
}

export function renderChat({ characterId, refresh }) {
  const character = getCharacter(characterId);
  if (!character) return null;

  ensureConversation(character.id);
  const conversation = getConversation(character.id);
  const profile = getProfile();
  const initialStyle = getChatStyle(character.id);

  const screen = document.createElement('section');
  screen.className = 'screen screen--chat';
  screen.innerHTML = `
    ${chatHeader(character)}
    <main class="chat-scroll" data-chat-scroll>
      <div class="chat-thread" data-chat-thread role="log" aria-label="和${escapeHTML(character.name)}的对话"></div>
    </main>
    <div class="chat-composer-slot" data-composer-slot></div>`;

  const scroller = screen.querySelector('[data-chat-scroll]');
  const thread = screen.querySelector('[data-chat-thread]');
  let chatStyle = { ...initialStyle };

  setActiveChat(character.id);
  dismissMessageBanner();

  let previousTimestamp = conversation.messages.at(-1)?.createdAt || null;
  let previousRole = conversation.messages.at(-1)?.role || null;

  const paintStatic = () => {
    thread.innerHTML = threadMarkup(
      conversation.messages,
      character,
      profile,
      chatStyle.showUserAvatar,
    );
    applyChatStyle(screen, chatStyle);
  };
  paintStatic();

  let stickToBottom = true;
  let scrollQueued = false;
  let pendingRow = null;
  let pendingBubble = null;

  const isNearBottom = () =>
    scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100;

  const scrollToBottom = (force = false) => {
    if (!force && !stickToBottom) return;
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      scroller.scrollTop = scroller.scrollHeight;
      stickToBottom = true;
    });
  };

  scroller.addEventListener('scroll', () => {
    stickToBottom = isNearBottom();
  });

  const appendMessage = (message) => {
    thread.querySelector('.chat-empty')?.remove();
    let markup = '';
    if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
      markup += dayDivider(message.createdAt);
      previousRole = null;
    }
    const showAvatar =
      message.role === 'user' ? chatStyle.showUserAvatar : previousRole !== message.role;
    markup += messageRow(message, character, profile, showAvatar);
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    while (holder.firstChild) thread.appendChild(holder.firstChild);
    const lastBubble = thread.querySelector('.message-row:last-child [data-bubble-text]');
    styleBubble(lastBubble, chatStyle.bubbleCss);
    previousTimestamp = message.createdAt;
    previousRole = message.role;
    scrollToBottom(true);
  };

  const appendPendingRow = () => {
    if (pendingRow) return;
    thread.querySelector('.chat-empty')?.remove();
    if (!previousTimestamp || !isSameDay(previousTimestamp, Date.now())) {
      thread.insertAdjacentHTML('beforeend', dayDivider(Date.now()));
      previousRole = null;
    }
    const showAvatar = previousRole !== 'assistant';
    pendingRow = document.createElement('div');
    pendingRow.className = 'message-row message-row--assistant message-row--pending';
    pendingRow.innerHTML = `<span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span>
      <div class="message-bubble message-bubble--assistant is-thinking" data-bubble-text>
        <span class="typing-dots" aria-label="正在输入"><i></i><i></i><i></i></span>
      </div>`;
    thread.appendChild(pendingRow);
    pendingBubble = pendingRow.querySelector('.message-bubble');
    styleBubble(pendingBubble, chatStyle.bubbleCss);
    previousTimestamp = Date.now();
    previousRole = 'assistant';
    scrollToBottom(true);
  };

  const removePendingRow = () => {
    const hadPending = Boolean(pendingRow);
    pendingRow?.remove();
    pendingRow = null;
    pendingBubble = null;
    const latest = getConversation(character.id)?.messages.at(-1);
    previousTimestamp = latest?.createdAt || null;
    previousRole = hadPending ? null : latest?.role || null;
  };

  const updatePendingText = (text) => {
    if (!pendingBubble) appendPendingRow();
    if (!pendingBubble) return;
    if (pendingBubble.classList.contains('is-thinking')) {
      pendingBubble.classList.remove('is-thinking');
      pendingBubble.classList.add('is-streaming');
      pendingBubble.textContent = '';
    }
    pendingBubble.textContent = text;
    scrollToBottom();
  };

  const composer = createChatComposer({
    characterName: character.name,
    hasConfig: hasApiConfig(),
    onConfigure: () => {
      window.location.hash = '#/settings/api';
    },
    onStop: () => {
      stopReply(character.id);
    },
    onRedPacket: () => {
      openRedPacketSheet({
        character,
        onSent: (message) => {
          appendMessage(message);
          previousTimestamp = message.createdAt;
          previousRole = message.role;
        },
      });
    },
    onSend: (text) => {
      if (!hasApiConfig()) {
        toast('先配置 API，才能收到回复', { tone: 'danger' });
        return false;
      }
      if (isReplying(character.id)) return false;
      const message = addMessage(character.id, 'user', text);
      appendMessage(message);
      previousTimestamp = message.createdAt;
      previousRole = message.role;
      startReply(character.id);
      return true;
    },
  });

  screen.querySelector('[data-composer-slot]').appendChild(composer.element);

  const handleReplyEvent = (event) => {
    if (event.type === 'start') {
      appendPendingRow();
      composer.setStreaming(true);
      return;
    }
    if (event.type === 'delta') {
      updatePendingText(event.text);
      return;
    }
    if (event.type === 'done') {
      removePendingRow();
      composer.setStreaming(false);
      appendMessage(event.message);
      composer.focus();
      return;
    }
    if (event.type === 'message') {
      appendMessage(event.message);
      return;
    }
    if (event.type === 'cancelled') {
      removePendingRow();
      composer.setStreaming(false);
      composer.focus();
      return;
    }
    if (event.type === 'error') {
      removePendingRow();
      composer.setStreaming(false);
      composer.focus();
    }
  };

  const unsubscribe = subscribeReply(character.id, handleReplyEvent);
  const running = getReplyState(character.id);
  if (running.running) {
    appendPendingRow();
    composer.setStreaming(true);
    if (running.text) updatePendingText(running.text);
  }

  thread.addEventListener('click', (event) => {
    const card = event.target.closest('[data-claim-packet]');
    if (!card || card.disabled) return;
    const messageId = card.dataset.claimPacket;
    const result = claimRedPacket(character.id, messageId);
    if (!result.ok) {
      toast(result.message || '红包暂时不能领取', { tone: 'danger' });
      return;
    }
    card.classList.add('is-claimed');
    card.disabled = true;
    card.querySelector('small').textContent = '已存入钱包';
    toast(`${formatMoney(result.amountFen)} 已存入钱包`);
  });

  screen.querySelector('[data-open-settings]').addEventListener('click', () => {
    openChatSettings({
      character,
      style: chatStyle,
      onStyleChange: (next) => {
        chatStyle = next;
        applyChatStyle(screen, chatStyle);
      },
    });
  });

  screen.querySelectorAll('[data-open-profile]').forEach((button) => {
    button.addEventListener('click', () => {
      openPartnerSheet({
        character: getCharacter(character.id),
        onChanged: refresh,
      });
    });
  });

  requestAnimationFrame(() => {
    scrollToBottom(true);
    const pending = takePendingPrompt();
    if (pending) {
      composer.setValue(pending);
      composer.focus();
    }
  });

  return {
    element: screen,
    cleanup() {
      unsubscribe();
      setActiveChat(null);
      composer.cleanup();
    },
  };
}
