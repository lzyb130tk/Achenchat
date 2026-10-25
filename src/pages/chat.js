import { avatar, characterAvatar, profileAvatar } from '../components/avatar.js';
import { createChatComposer } from '../components/chat-composer.js';
import { applyChatStyle, openChatSettings } from '../components/chat-settings.js';
import {
  openComposerActions,
  openStickerPicker,
} from '../components/composer-actions.js';
import { bindLongPress } from '../components/conversation-actions.js';
import { icon } from '../components/icons.js';
import { dismissMessageBanner } from '../components/message-banner.js';
import {
  closeMessageMenu,
  openMessageMenu,
} from '../components/message-actions.js';
import { openPartnerSheet } from '../components/partner-sheet.js';
import { showRedPacketReveal } from '../components/red-packet-reveal.js';
import { openRedPacketSheet } from '../components/red-packet-sheet.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { getSparkSvg } from '../data/chat-options.js';
import { copyText } from '../services/clipboard.js';
import { messageAsText, messageLength } from '../services/message-format.js';
import {
  addMessage,
  claimRedPacket,
  deleteMessage,
  ensureConversation,
  getChatStyle,
  getCharacter,
  getConversation,
  getProfile,
  hasApiConfig,
  removeLastAssistantReply,
  setConversationStatus,
  updateChatStyle,
  updateMessage,
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
  chatStreakDays,
  escapeHTML,
  formatChatDay,
  isSameDay,
} from '../services/utils.js';

function sparkBadgeMarkup(style, streak) {
  if (!style.sparkEnabled || streak < 1) return '';
  return `<span class="chat-spark" title="连续聊天 ${streak} 天" aria-label="连续聊天 ${streak} 天">
    <span class="chat-spark__icon">${getSparkSvg(style)}</span>
    <span class="chat-spark__days">${streak} 天</span>
  </span>`;
}

function chatHeader(character, status, style, streak) {
  return `<header class="chat-header">
    <a class="icon-button chat-header__back" href="#/messages" aria-label="返回">${icon('arrow-left')}</a>
    <button class="chat-header__identity" type="button" data-open-profile>
      ${characterAvatar(character, 'sm')}
      <span class="chat-header__copy">
        <span class="chat-header__name-row">
          <span class="chat-header__name">${escapeHTML(character.name)}</span>
          <span class="chat-header__spark" data-chat-spark>${sparkBadgeMarkup(style, streak)}</span>
        </span>
        <span class="chat-header__status">
          <span class="status-dot status-dot--accent"></span>
          <span data-chat-status>${escapeHTML(status || '在你身边')}</span>
        </span>
      </span>
    </button>
    <button class="icon-button chat-header__action" type="button" aria-label="对话选项" data-open-brief>${icon('dots-three')}</button>
    <button class="icon-button chat-header__action" type="button" aria-label="聊天设置" data-open-settings>${icon('gear-six')}</button>
  </header>`;
}

function quoteMarkup(quote) {
  if (!quote?.content) return '';
  return `<span class="message-bubble__quote"><span class="message-bubble__quote-name">${escapeHTML(quote.name || '引用')}</span><span class="message-bubble__quote-text">${escapeHTML(quote.content)}</span></span>`;
}

function redPacketCard(message) {
  const claimable = message.role === 'assistant' && !message.claimed;
  const state =
    message.role === 'user'
      ? '已发出'
      : message.claimed
        ? '已存入零钱'
        : '领取红包';
  return `<button class="red-packet-card${message.claimed ? ' is-claimed' : ''}" type="button"
    ${claimable ? `data-claim-packet="${message.id}"` : 'disabled'}>
    <span class="red-packet-card__icon">${icon('envelope-simple', 'fill')}</span>
    <span class="red-packet-card__copy">
      <strong>${escapeHTML(message.note || '恭喜发财，大吉大利')}</strong>
      <small>${state}</small>
    </span>
    <span class="red-packet-card__amount">¥${(message.amountFen / 100).toFixed(2)}</span>
  </button>`;
}

function stickerMessage(message) {
  const label = message.name ? escapeHTML(message.name) : '表情';
  return `<span class="sticker-message">
    <span class="sticker-message__fallback">${icon('sticker')}</span>
    <img src="${escapeHTML(message.url)}" alt="${label}" title="${label}" loading="lazy">
  </span>`;
}

function messageBody(message) {
  if (message.type === 'redpacket') return redPacketCard(message);
  if (message.type === 'sticker') return stickerMessage(message);
  return `<div class="message-bubble message-bubble--${message.role === 'user' ? 'user' : 'assistant'}">${quoteMarkup(message.quote)}<span class="message-bubble__text">${escapeHTML(message.content || '')}</span></div>`;
}

function messageRow(
  message,
  character,
  profile,
  showAvatar,
  animate = false,
  position = 'single',
) {
  const isUser = message.role === 'user';
  const avatarMarkup = isUser
    ? `<span class="message-row__avatar message-row__avatar--user">${profileAvatar(profile, 'xs')}</span>`
    : `<span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span>`;

  return `<div class="message-row message-row--${isUser ? 'user' : 'assistant'} message-row--${position}${message.type !== 'text' ? ' message-row--rich' : ''}${animate ? ' is-new' : ''}" data-message-id="${message.id}">
    ${isUser ? '' : avatarMarkup}
    ${messageBody(message)}
    ${isUser ? avatarMarkup : ''}
  </div>`;
}

function setRowPosition(row, position) {
  row.classList.remove(
    'message-row--first',
    'message-row--middle',
    'message-row--last',
    'message-row--single',
  );
  row.classList.add(`message-row--${position}`);
}

function groupPositions(messages) {
  return messages.map((message, index) => {
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const sameAsPrev =
      prev &&
      prev.role === message.role &&
      isSameDay(prev.createdAt, message.createdAt);
    const sameAsNext =
      next &&
      next.role === message.role &&
      isSameDay(message.createdAt, next.createdAt);
    if (sameAsPrev && sameAsNext) return 'middle';
    if (sameAsPrev) return 'last';
    if (sameAsNext) return 'first';
    return 'single';
  });
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

function threadMarkup(messages, character, profile) {
  if (!messages.length) return emptyState(character);
  const positions = groupPositions(messages);
  let previousTimestamp = null;
  let previousRole = null;
  return messages
    .map((message, index) => {
      let markup = '';
      if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
        markup += dayDivider(message.createdAt);
        previousRole = null;
      }
      const showAvatar =
        message.role === 'user' ? false : previousRole !== message.role;
      markup += messageRow(
        message,
        character,
        profile,
        showAvatar,
        false,
        positions[index],
      );
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
  const initialStatus = conversation.status?.text || '';
  const initialStreak = chatStreakDays(conversation.messages);

  const screen = document.createElement('section');
  screen.className = 'screen screen--chat';
  screen.innerHTML = `
    ${chatHeader(character, initialStatus, initialStyle, initialStreak)}
    <div class="chat-tagline-flash" data-tagline-flash role="status">对方更新了签名</div>
    <main class="chat-scroll" data-chat-scroll>
      <div class="chat-thread" data-chat-thread role="log" aria-label="和${escapeHTML(character.name)}的对话"></div>
    </main>
    <div class="chat-composer-slot" data-composer-slot></div>`;

  const scroller = screen.querySelector('[data-chat-scroll]');
  const thread = screen.querySelector('[data-chat-thread]');
  const statusNode = screen.querySelector('[data-chat-status]');
  let chatStyle = { ...initialStyle };
  let disposed = false;
  let revealPending = [];
  let revealTimer = null;
  const deletedIds = new Set();

  const setHeaderStatus = (value) => {
    if (!value || disposed) return;
    statusNode.textContent = value;
  };

  const updateSparkBadge = () => {
    if (disposed) return;
    const slot = screen.querySelector('[data-chat-spark]');
    if (!slot) return;
    const messages = getConversation(character.id)?.messages || [];
    slot.innerHTML = sparkBadgeMarkup(chatStyle, chatStreakDays(messages));
  };

  setActiveChat(character.id);
  dismissMessageBanner();

  let previousTimestamp = conversation.messages.at(-1)?.createdAt || null;
  let previousRole = conversation.messages.at(-1)?.role || null;

  const paintStatic = () => {
    thread.innerHTML = threadMarkup(conversation.messages, character, profile);
    applyChatStyle(screen, chatStyle);
  };
  paintStatic();

  let stickToBottom = true;
  let scrollQueued = false;
  let pendingRow = null;

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

  const appendMessage = (
    message,
    { animate = true, forceScroll = false } = {},
  ) => {
    if (disposed || deletedIds.has(message.id)) return;
    thread.querySelector('.chat-empty')?.remove();
    let markup = '';
    if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
      markup += dayDivider(message.createdAt);
      previousRole = null;
    }
    const sameGroup = message.role === previousRole;
    const showAvatar =
      message.role === 'user' ? false : previousRole !== message.role;
    const position = sameGroup ? 'last' : 'single';
    if (sameGroup) {
      const rows = thread.querySelectorAll('.message-row[data-message-id]');
      const prevRow = rows[rows.length - 1];
      if (prevRow) {
        setRowPosition(
          prevRow,
          prevRow.classList.contains('message-row--single') ? 'first' : 'middle',
        );
      }
    }
    markup += messageRow(message, character, profile, showAvatar, animate, position);
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    while (holder.firstChild) thread.appendChild(holder.firstChild);
    previousTimestamp = message.createdAt;
    previousRole = message.role;
    updateSparkBadge();
    scrollToBottom(forceScroll);
  };

  const appendPendingRow = () => {
    if (pendingRow || disposed) return;
    thread.querySelector('.chat-empty')?.remove();
    let markup = '';
    if (!previousTimestamp || !isSameDay(previousTimestamp, Date.now())) {
      markup += dayDivider(Date.now());
      previousTimestamp = Date.now();
      previousRole = null;
    }
    const showAvatar = previousRole !== 'assistant';
    markup += `<div class="message-row message-row--assistant message-row--pending"><span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span><div class="message-bubble message-bubble--assistant is-thinking"><span class="typing-dots" aria-label="正在输入"><i></i><i></i><i></i></span></div></div>`;
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    while (holder.firstChild) thread.appendChild(holder.firstChild);
    pendingRow = thread.querySelector('.message-row--pending');
    scrollToBottom(true);
  };

  const removePendingRow = () => {
    pendingRow?.remove();
    pendingRow = null;
  };

  const syncRowPositions = () => {
    if (revealPending.length) return;
    const messages = getConversation(character.id)?.messages || [];
    const positions = groupPositions(messages);
    thread.querySelectorAll('.message-row[data-message-id]').forEach((row, index) => {
      if (positions[index]) setRowPosition(row, positions[index]);
    });
  };

  const revealGap = (message) => {
    const length = Math.max(1, messageLength(message));
    return Math.max(
      180,
      Math.min(4200, 110 + length * (chatStyle.typingSpeed || 0.035) * 1000),
    );
  };

  const clearRevealTimer = () => {
    if (revealTimer) window.clearTimeout(revealTimer);
    revealTimer = null;
  };

  const finishReveal = () => {
    clearRevealTimer();
    revealPending = [];
    if (!disposed) composer.setReceiving(false);
  };

  const flushReveal = () => {
    const rest = revealPending;
    finishReveal();
    rest.forEach((message) => appendMessage(message, { animate: false }));
  };

  const revealStep = () => {
    revealTimer = null;
    if (disposed) return;
    const message = revealPending.shift();
    if (!message) {
      composer.setReceiving(false);
      return;
    }
    appendMessage(message, { animate: true });
    composer.setReceiving(false);
    if (revealPending.length) {
      revealTimer = window.setTimeout(revealStep, revealGap(message));
    }
  };

  const queueReveal = (messages) => {
    if (!messages?.length) {
      composer.setReceiving(false);
      return;
    }
    finishReveal();
    revealPending = messages.slice();
    revealStep();
  };

  const sendSticker = (sticker) => {
    const message = addMessage(character.id, 'user', '', {
      type: 'sticker',
      url: sticker.url,
      name: sticker.name,
      packName: sticker.packName,
    });
    appendMessage(message, { animate: true, forceScroll: true });
    if (chatStyle.sendMode === 'single' && hasApiConfig() && !isReplying(character.id)) {
      startReply(character.id);
    }
  };

  const sendPacket = () => {
    openRedPacketSheet({
      character,
      onSent: (message) => {
        if (revealPending.length) flushReveal();
        appendMessage(message, { animate: true, forceScroll: true });
        if (
          chatStyle.sendMode === 'single' &&
          hasApiConfig() &&
          !isReplying(character.id)
        ) {
          startReply(character.id);
        }
      },
    });
  };

  let taglineTimer = null;
  const flashTagline = () => {
    const node = screen.querySelector('[data-tagline-flash]');
    if (!node) return;
    node.classList.add('is-visible');
    if (taglineTimer) window.clearTimeout(taglineTimer);
    taglineTimer = window.setTimeout(() => node.classList.remove('is-visible'), 1800);
  };

  const openRawSheet = (message) => {
    const raw = message.raw?.trim() || messageAsText(message);
    openSheet({
      title: '原始输出',
      description: 'AI 本次返回的完整内容，方便排查格式问题。',
      content: `<pre class="raw-output" data-raw-output>${escapeHTML(raw)}</pre>`,
      actions: `<button class="button button--primary" type="button" data-copy-raw>复制</button>`,
      onMount: (sheet) => {
        sheet.querySelector('[data-copy-raw]').addEventListener('click', async () => {
          const copied = await copyText(raw);
          toast(copied ? '已复制' : '复制失败', {
            tone: copied ? 'default' : 'danger',
          });
        });
      },
    });
  };

  const openEditSheet = (message) => {
    openSheet({
      title: '修改回复',
      description: '改动会存入记录，也会影响之后的上下文。',
      content: `<label class="field">
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea" rows="5" data-edit-content>${escapeHTML(message.content || '')}</textarea>
        </span>
      </label>`,
      actions: `<div class="button-row">
        <button class="button button--secondary" type="button" data-cancel-edit>取消</button>
        <button class="button button--primary" type="button" data-save-edit>保存</button>
      </div>`,
      onMount: (sheet) => {
        const textarea = sheet.querySelector('[data-edit-content]');
        textarea.focus();
        sheet.querySelector('[data-cancel-edit]').addEventListener('click', closeActiveSheet);
        sheet.querySelector('[data-save-edit]').addEventListener('click', () => {
          const value = textarea.value.trim();
          if (!value) {
            toast('回复内容不能为空', { tone: 'danger' });
            textarea.focus();
            return;
          }
          updateMessage(character.id, message.id, { content: value });
          const text = thread.querySelector(
            `[data-message-id="${message.id}"] .message-bubble__text`,
          );
          if (text) text.textContent = value;
          closeActiveSheet();
          toast('回复已修改');
        });
      },
    });
  };

  const retryReply = () => {
    if (isReplying(character.id)) {
      toast('对方正在回复，稍等一下');
      return;
    }
    if (revealPending.length) flushReveal();
    const result = removeLastAssistantReply(character.id);
    if (!result.removed.length) {
      toast('还没有可以重试的回复');
      return;
    }
    const removedIds = new Set(result.removed.map((message) => message.id));
    thread.querySelectorAll('.message-row[data-message-id]').forEach((row) => {
      if (removedIds.has(row.dataset.messageId)) row.remove();
    });
    let lastChild = thread.lastElementChild;
    while (lastChild && lastChild.classList.contains('chat-day')) {
      lastChild.remove();
      lastChild = thread.lastElementChild;
    }
    const latest = getConversation(character.id)?.messages.at(-1);
    previousTimestamp = latest?.createdAt || null;
    previousRole = latest?.role || null;
    if (!hasApiConfig()) {
      toast('先配置 API，才能重新生成', { tone: 'danger' });
      return;
    }
    startReply(character.id);
  };

  const composer = createChatComposer({
    characterName: character.name,
    hasConfig: hasApiConfig(),
    sendMode: chatStyle.sendMode,
    onCompose: () => scrollToBottom(true),
    onConfigure: () => {
      window.location.hash = '#/settings/api';
    },
    onStop: () => {
      stopReply(character.id);
    },
    onRedPacket: sendPacket,
    onMore: () => {
      openComposerActions({
        onRedPacket: sendPacket,
        onSticker: () => {
          openStickerPicker({ onPick: sendSticker });
        },
        onRetry: retryReply,
      });
    },
    onReceive: () => {
      if (!hasApiConfig()) {
        toast('先配置 API，才能收到回复', { tone: 'danger' });
        return false;
      }
      if (isReplying(character.id)) return false;
      if (revealPending.length) flushReveal();
      return startReply(character.id);
    },
    onModeChange: (mode) => {
      chatStyle = updateChatStyle(character.id, { sendMode: mode });
    },
    onSend: (text, quote) => {
      const isMulti = chatStyle.sendMode === 'multi';
      if (!isMulti && !hasApiConfig()) {
        toast('先配置 API，才能收到回复', { tone: 'danger' });
        return false;
      }
      if (!isMulti && isReplying(character.id)) return false;
      if (revealPending.length) flushReveal();
      const message = addMessage(character.id, 'user', text, { quote });
      appendMessage(message, { animate: true, forceScroll: true });
      if (!isMulti) startReply(character.id);
      return true;
    },
  });

  screen.querySelector('[data-composer-slot]').appendChild(composer.element);

  const handleReplyEvent = (event) => {
    if (event.type === 'start') {
      appendPendingRow();
      composer.setStreaming(true);
      composer.setReceiving(true);
      return;
    }
    if (event.type === 'status') {
      setHeaderStatus(event.status);
      setConversationStatus(character.id, event.status);
      return;
    }
    if (event.type === 'delta') {
      return;
    }
    if (event.type === 'done') {
      removePendingRow();
      composer.setStreaming(false);
      if (event.status) setHeaderStatus(event.status);
      queueReveal(event.messages || []);
      return;
    }
    if (event.type === 'message') {
      if (revealPending.length) revealPending.push(event.message);
      else appendMessage(event.message, { animate: true });
      return;
    }
    if (event.type === 'tagline') {
      flashTagline();
      return;
    }
    if (event.type === 'cancelled') {
      removePendingRow();
      composer.setStreaming(false);
      composer.setReceiving(false);
      return;
    }
    if (event.type === 'error') {
      removePendingRow();
      composer.setStreaming(false);
      composer.setReceiving(false);
      composer.focus();
    }
  };

  const unsubscribe = subscribeReply(character.id, handleReplyEvent);
  const running = getReplyState(character.id);
  if (running.running) {
    appendPendingRow();
    composer.setStreaming(true);
    composer.setReceiving(true);
    if (running.status) setHeaderStatus(running.status);
  }

  bindLongPress(thread, '.message-row[data-message-id]', (row) => {
    const message = getConversation(character.id)?.messages.find(
      (item) => item.id === row.dataset.messageId,
    );
    if (!message) return;
    openMessageMenu({
      anchor: row,
      onCopy: async () => {
        const copied = await copyText(messageAsText(message));
        toast(copied ? '已复制' : '复制失败', {
          tone: copied ? 'default' : 'danger',
        });
      },
      onEdit:
        message.role === 'assistant' ? () => openEditSheet(message) : undefined,
      onRaw:
        message.role === 'assistant' ? () => openRawSheet(message) : undefined,
      onQuote: () => {
        composer.setQuote({
          messageId: message.id,
          role: message.role,
          name:
            message.role === 'user' ? profile.name || '你' : character.name,
          content: messageAsText(message),
        });
        composer.focus();
      },
      onDelete: () => {
        if (!deleteMessage(character.id, message.id)) return;
        deletedIds.add(message.id);
        row.remove();
        const remaining = thread.querySelectorAll(
          '.message-row[data-message-id]',
        ).length;
        const latest = getConversation(character.id)?.messages.at(-1);
        previousTimestamp = latest?.createdAt || null;
        previousRole = latest?.role || null;
        if (!remaining && !pendingRow) {
          thread.innerHTML = emptyState(character);
          previousTimestamp = null;
          previousRole = null;
        } else {
          syncRowPositions();
        }
        toast('消息已删除');
      },
    });
  });

  thread.addEventListener('click', (event) => {
    const card = event.target.closest('[data-claim-packet]');
    if (!card || card.disabled) return;
    const messageId = card.dataset.claimPacket;
    const message = getConversation(character.id)?.messages.find(
      (item) => item.id === messageId,
    );
    const result = claimRedPacket(character.id, messageId);
    if (!result.ok) {
      toast(result.message || '红包暂时不能领取', { tone: 'danger' });
      return;
    }
    card.classList.add('is-claimed');
    card.disabled = true;
    card.querySelector('small').textContent = '已存入零钱';
    showRedPacketReveal({
      from: character.name,
      amountFen: result.amountFen,
      note: message?.note || '恭喜发财，大吉大利',
    });
  });

  screen.querySelector('[data-open-settings]').addEventListener('click', () => {
    openChatSettings({
      character,
      style: chatStyle,
      onStyleChange: (next) => {
        chatStyle = next;
        applyChatStyle(screen, chatStyle);
        updateSparkBadge();
        composer.setMode(chatStyle.sendMode);
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

  screen.querySelector('[data-open-brief]').addEventListener('click', () => {
    openPartnerSheet({
      character: getCharacter(character.id),
      compact: true,
      onChanged: refresh,
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
      disposed = true;
      clearRevealTimer();
      revealPending = [];
      if (taglineTimer) window.clearTimeout(taglineTimer);
      closeMessageMenu();
      unsubscribe();
      setActiveChat(null);
      composer.cleanup();
    },
  };
}
