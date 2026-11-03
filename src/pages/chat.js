import { avatar, characterAvatar, profileAvatar } from '../components/avatar.js';
import { createChatComposer } from '../components/chat-composer.js';
import { applyChatStyle } from '../components/chat-settings.js';
import {
  openComposerActions,
  openStickerPicker,
} from '../components/composer-actions.js';
import { bindLongPress } from '../components/conversation-actions.js';
import { icon, uiIcon } from '../components/icons.js';
import { dismissMessageBanner } from '../components/message-banner.js';
import {
  closeMessageMenu,
  openMessageMenu,
} from '../components/message-actions.js';
import { openPartnerSheet } from '../components/partner-sheet.js';
import { showRedPacketReveal } from '../components/red-packet-reveal.js';
import { openRedPacketSheet } from '../components/red-packet-sheet.js';
import {
  closeReactionPicker,
  openReactionPicker,
} from '../components/reaction-picker.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { getSparkSvg } from '../data/chat-options.js';
import { copyText } from '../services/clipboard.js';
import { createInertialScroll } from '../services/inertial-scroll.js';
import { messageAsText, messageLength } from '../services/message-format.js';
import {
  addFavorite,
  addMessage,
  claimRedPacket,
  clearMultiSentCount,
  countPendingUserMessages,
  deleteMessage,
  ensureConversation,
  flushMessageWrites,
  getChatStyle,
  getCharacter,
  getConversation,
  getImageRecord,
  getMessagePage,
  getProfile,
  hasApiConfig,
  incrementMultiSentCount,
  recountMultiSentCount,
  reactToMessage,
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
    <a class="icon-button chat-header__back" href="#/messages" aria-label="返回">${uiIcon('chevron-left', { size: 21, strokeWidth: 1.9 })}</a>
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
          <span class="chat-header__typing" data-chat-typing>
            <span class="chat-header__typing-label">正在输入</span>
            <span class="chat-header__typing-dots"><i></i><i></i><i></i></span>
          </span>
        </span>
      </span>
    </button>
    <button class="icon-button chat-header__action" type="button" aria-label="更多会话操作" data-open-chat-menu>${uiIcon('more', { size: 20 })}</button>
    <div class="chat-select-bar" data-select-bar>
      <button class="chat-select-bar__btn" type="button" data-select-cancel>取消</button>
      <span class="chat-select-bar__count" data-select-count>选择消息</span>
      <span class="chat-select-bar__spacer"></span>
      <button class="chat-select-bar__btn chat-select-bar__btn--danger" type="button" data-select-delete disabled>删除</button>
      <button class="chat-select-bar__btn chat-select-bar__btn--primary" type="button" data-select-favorite disabled>收藏</button>
    </div>
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

const imageUrlCache = new Map();

async function imageObjectUrl(imageId) {
  if (!imageId) return '';
  if (imageUrlCache.has(imageId)) return imageUrlCache.get(imageId);
  try {
    const record = await getImageRecord(imageId);
    if (!record?.blob) return '';
    const url = URL.createObjectURL(record.blob);
    imageUrlCache.set(imageId, url);
    return url;
  } catch {
    return '';
  }
}

export function revokeChatImageUrls() {
  for (const url of imageUrlCache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Data-URL previews are not revocable; nothing to release.
    }
  }
  imageUrlCache.clear();
}

async function hydrateImages(root) {
  const nodes = [...root.querySelectorAll('img[data-image-id]')];
  await Promise.all(
    nodes.map(async (img) => {
      if (img.dataset.loaded) return;
      img.dataset.loaded = '1';
      const url = await imageObjectUrl(img.dataset.imageId);
      if (url) {
        img.src = url;
      } else {
        img.closest('[data-image-message]')?.classList.add('is-missing');
      }
    }),
  );
}

function imageStackMarkup(message) {
  const images = Array.isArray(message.images) ? message.images : [];
  if (!images.length) return '';
  const id = escapeHTML(message.id);
  const caption = message.content?.trim()
    ? `<span class="chat-image__caption">${escapeHTML(message.content.trim().slice(0, 200))}</span>`
    : '';
  if (images.length === 1) {
    return `<button class="chat-image chat-image--single" type="button" data-image-message="${id}" data-image-index="0" aria-label="查看图片">
      <img data-image-id="${escapeHTML(images[0].id)}" alt="图片" loading="lazy">${caption}
    </button>`;
  }
  const layers = images
    .slice(0, 3)
    .map(
      (image, index) =>
        `<span class="chat-image-layer" data-image-index="${index}"><img data-image-id="${escapeHTML(image.id)}" alt="图片 ${index + 1}" loading="lazy"></span>`,
    )
    .join('');
  return `<button class="chat-image-stack" type="button" data-image-message="${id}" aria-label="查看 ${images.length} 张图片">
    ${layers}
    <span class="chat-image-stack__count">${images.length > 3 ? `+${images.length - 3}` : ''}</span>
    ${caption}
  </button>`;
}

function openImageViewer(message, startIndex = 0) {
  const images = Array.isArray(message.images) ? message.images : [];
  if (!images.length) return;
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer';
  overlay.innerHTML = `
    <div class="image-viewer__top">
      <span class="image-viewer__count" data-viewer-count></span>
      <button class="icon-button image-viewer__close" type="button" data-viewer-close aria-label="关闭">${uiIcon('x', { size: 22 })}</button>
    </div>
    <div class="image-viewer__stage"><img data-viewer-image alt="图片"></div>
    <div class="image-viewer__nav">
      <button class="icon-button" type="button" data-viewer-prev aria-label="上一张">${uiIcon('chevron-left', { size: 24 })}</button>
      <button class="icon-button" type="button" data-viewer-next aria-label="下一张">${uiIcon('chevron-right', { size: 24 })}</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('has-image-viewer');
  let index = Math.max(0, Math.min(images.length - 1, startIndex));
  const imageNode = overlay.querySelector('[data-viewer-image]');
  const countNode = overlay.querySelector('[data-viewer-count]');
  const prev = overlay.querySelector('[data-viewer-prev]');
  const next = overlay.querySelector('[data-viewer-next]');
  prev.hidden = images.length < 2;
  next.hidden = images.length < 2;

  const show = async () => {
    countNode.textContent = `${index + 1} / ${images.length}`;
    imageNode.removeAttribute('src');
    const url = await imageObjectUrl(images[index].id);
    if (url) imageNode.src = url;
  };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.classList.remove('has-image-viewer');
  };
  const move = (step) => {
    index = (index + step + images.length) % images.length;
    show();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  };

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-viewer-image]')) return;
    if (event.target.closest('[data-viewer-prev]')) return move(-1);
    if (event.target.closest('[data-viewer-next]')) return move(1);
    close();
  });
  overlay.querySelector('[data-viewer-close]').addEventListener('click', close);
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  document.addEventListener('keydown', onKey);
  show();
}

function messageBody(message) {
  if (message.type === 'redpacket') return redPacketCard(message);
  if (message.type === 'sticker') return stickerMessage(message);
  if (message.type === 'image') return imageStackMarkup(message);
  return `<div class="message-bubble message-bubble--${message.role === 'user' ? 'user' : 'assistant'}">${quoteMarkup(message.quote)}<span class="message-bubble__text">${escapeHTML(message.content || '')}</span></div>`;
}

function reactionChipMarkup(reaction, animate = false) {
  const emoji = escapeHTML(reaction?.emoji || '');
  const by = reaction?.by === 'assistant' ? 'assistant' : 'user';
  return `<span class="message-reaction${animate ? ' is-new' : ''}" data-reaction-emoji="${emoji}" data-reaction-by="${by}"><span class="message-reaction__emoji">${emoji}</span></span>`;
}

function reactionsMarkup(message, animateEmoji = '') {
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  return `<span class="message-reactions" data-reactions>${reactions
    .map((reaction) =>
      reactionChipMarkup(reaction, Boolean(animateEmoji) && reaction.emoji === animateEmoji),
    )
    .join('')}</span>`;
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
  const hasReactions = Array.isArray(message.reactions) && message.reactions.length > 0;
  const avatarMarkup = isUser
    ? `<span class="message-row__avatar message-row__avatar--user">${showAvatar ? profileAvatar(profile, 'xs') : ''}</span>`
    : `<span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span>`;

  return `<div class="message-row message-row--${isUser ? 'user' : 'assistant'} message-row--${position}${message.type !== 'text' ? ' message-row--rich' : ''}${animate ? ' is-new' : ''}${hasReactions ? ' has-reactions' : ''}" data-message-id="${message.id}">
    ${isUser ? '' : avatarMarkup}
    <div class="message-bubble-wrap">
      ${messageBody(message)}
      ${reactionsMarkup(message)}
    </div>
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

function groupPositions(messages, mode = 'group') {
  if (mode === 'each') return messages.map(() => 'single');
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

function showsAvatar(mode, role, previousRole) {
  return mode === 'each' || previousRole !== role;
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

function threadMarkup(messages, character, profile, messageGroup = 'group') {
  if (!messages.length) return emptyState(character);
  const positions = groupPositions(messages, messageGroup);
  let previousTimestamp = null;
  let previousRole = null;
  return messages
    .map((message, index) => {
      let markup = '';
      if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
        markup += dayDivider(message.createdAt);
        previousRole = null;
      }
      const showAvatar = showsAvatar(messageGroup, message.role, previousRole);
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
  const root = document.documentElement;
  const initialStatus = conversation.status?.text || '';
  const initialStreak = 0;

  const screen = document.createElement('section');
  screen.className = 'screen screen--chat';
  screen.innerHTML = `
    ${chatHeader(character, initialStatus, initialStyle, initialStreak)}
    <div class="chat-tagline-flash" data-tagline-flash role="status">对方更新了签名</div>
    <main class="chat-scroll" data-chat-scroll>
      <div class="chat-thread" data-chat-thread role="log" aria-label="和${escapeHTML(character.name)}的对话"><div class="chat-loading"><span class="typing-dots"><i></i><i></i><i></i></span></div></div>
    </main>
    <div class="chat-composer-slot" data-composer-slot></div>`;

  const scroller = screen.querySelector('[data-chat-scroll]');
  const thread = screen.querySelector('[data-chat-thread]');
  const inertia = createInertialScroll(scroller, { content: thread });
  const statusNode = screen.querySelector('[data-chat-status]');
  let chatStyle = { ...initialStyle };
  let disposed = false;
  let revealPending = [];
  let revealTimer = null;
  let pendingGroupSync = false;
  let loadedMessages = [];
  let hasMore = false;
  let loadingOlder = false;
  let ready = false;
  const earlyEvents = [];
  const deletedIds = new Set();

  const setHeaderStatus = (value) => {
    if (!value || disposed) return;
    statusNode.textContent = value;
  };

  const updateSparkBadge = () => {
    if (disposed) return;
    const slot = screen.querySelector('[data-chat-spark]');
    if (!slot) return;
    slot.innerHTML = sparkBadgeMarkup(chatStyle, chatStreakDays(loadedMessages));
  };

  setActiveChat(character.id);
  dismissMessageBanner();

  let previousTimestamp = null;
  let previousRole = null;

  const loadMoreButton = () =>
    hasMore
      ? `<div class="chat-load-more-wrap"><button class="chat-load-more" type="button" data-load-more>加载更早的消息</button></div>`
      : '';

  const renderThread = () => {
    thread.innerHTML = `${loadMoreButton()}${
      loadedMessages.length
        ? threadMarkup(loadedMessages, character, profile, chatStyle.messageGroup)
        : emptyState(character)
    }`;
    applyChatStyle(screen, chatStyle);
    hydrateImages(thread);
  };

  thread.innerHTML = `<div class="chat-loading" role="status"><span class="typing-dots"><i></i><i></i><i></i></span></div>`;
  applyChatStyle(screen, chatStyle);

  // Loading feedback: either the thinking bubble (default) or a green
  // "正在输入" line in the header, shown until the first message renders.
  const setTyping = (active) => {
    const header = screen.querySelector('.chat-header');
    if (!header) return;
    header.classList.toggle(
      'is-typing',
      Boolean(active) && chatStyle.loadingStyle === 'header',
    );
  };

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
      inertia.scrollTo(scroller.scrollHeight, { immediate: true });
      stickToBottom = true;
    });
  };

  scroller.addEventListener('scroll', () => {
    stickToBottom = isNearBottom();
  });

  const loadOlder = async () => {
    if (loadingOlder || !hasMore || !loadedMessages.length || disposed) return;
    loadingOlder = true;
    const button = thread.querySelector('[data-load-more]');
    if (button) {
      button.disabled = true;
      button.textContent = '加载中…';
    }
    const beforeSeq = loadedMessages[0]?.seq || 0;
    const previousHeight = scroller.scrollHeight;
    try {
      const page = await getMessagePage(character.id, { beforeSeq, limit: 50 });
      if (disposed) return;
      loadedMessages = [...page.messages, ...loadedMessages];
      hasMore = page.hasMore;
      renderThread();
      inertia.scrollTo(
        scroller.scrollTop + (scroller.scrollHeight - previousHeight),
        { immediate: true },
      );
      updateSparkBadge();
    } catch {
      if (button) {
        button.disabled = false;
        button.textContent = '加载更早的消息';
      }
      toast('加载聊天记录失败，请重试', { tone: 'danger' });
    } finally {
      loadingOlder = false;
    }
  };

  const appendMessage = (
    message,
    { animate = true, forceScroll = false } = {},
  ) => {
    if (disposed || deletedIds.has(message.id)) return;
    if (loadedMessages.some((item) => item.id === message.id)) return;
    loadedMessages.push(message);
    thread.querySelector('.chat-empty')?.remove();
    let markup = '';
    if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
      markup += dayDivider(message.createdAt);
      previousRole = null;
    }
    const sameGroup =
      chatStyle.messageGroup === 'group' && message.role === previousRole;
    const showAvatar = showsAvatar(
      chatStyle.messageGroup,
      message.role,
      previousRole,
    );
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
    hydrateImages(thread);
    previousTimestamp = message.createdAt;
    previousRole = message.role;
    updateSparkBadge();
    scrollToBottom(forceScroll);
  };

  const appendPendingRow = () => {
    if (disposed) return;
    if (chatStyle.loadingStyle === 'header') {
      setTyping(true);
      return;
    }
    if (pendingRow) return;
    thread.querySelector('.chat-empty')?.remove();
    let markup = '';
    if (!previousTimestamp || !isSameDay(previousTimestamp, Date.now())) {
      markup += dayDivider(Date.now());
      previousTimestamp = Date.now();
      previousRole = null;
    }
    const showAvatar = showsAvatar(
      chatStyle.messageGroup,
      'assistant',
      previousRole,
    );
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

  const syncRowAppearance = () => {
    if (revealPending.length) return;
    const messages = loadedMessages;
    const positions = groupPositions(messages, chatStyle.messageGroup);
    let previousRole = null;
    let previousTimestamp = null;
    thread
      .querySelectorAll('.message-row[data-message-id]')
      .forEach((row, index) => {
        const message = messages[index];
        if (!message) return;
        if (positions[index]) setRowPosition(row, positions[index]);
        if (!previousTimestamp || !isSameDay(previousTimestamp, message.createdAt)) {
          previousRole = null;
        }
        const slot = row.querySelector('.message-row__avatar');
        if (slot) {
          const show = showsAvatar(
            chatStyle.messageGroup,
            message.role,
            previousRole,
          );
          const inner = show
            ? message.role === 'user'
              ? profileAvatar(profile, 'xs')
              : characterAvatar(character, 'xs')
            : '';
          slot.innerHTML = inner;
        }
        previousTimestamp = message.createdAt;
        previousRole = message.role;
      });
  };

  /* ------------------------------------------------------------------ *
   * 贴表情：长按消息 → 菜单 → 选 emoji。AI 也会在回复里偶尔贴回来。
   * ------------------------------------------------------------------ */

  const setRowReactions = (row, reactions, animateEmoji = '') => {
    if (!row) return;
    const wrap = row.querySelector('.message-bubble-wrap');
    if (!wrap) return;
    let layer = wrap.querySelector('[data-reactions]');
    if (!layer) {
      layer = document.createElement('span');
      layer.className = 'message-reactions';
      layer.dataset.reactions = '';
      wrap.appendChild(layer);
    }
    layer.innerHTML = (reactions || [])
      .map((reaction) =>
        reactionChipMarkup(reaction, Boolean(animateEmoji) && reaction.emoji === animateEmoji),
      )
      .join('');
    row.classList.toggle('has-reactions', Boolean(reactions?.length));
  };

  const applyReactionsToMessage = (messageId, reactions, animateEmoji = '') => {
    const message = loadedMessages.find((item) => item.id === messageId);
    if (message) message.reactions = reactions;
    const row = thread.querySelector(
      `.message-row[data-message-id="${messageId}"]`,
    );
    setRowReactions(row, reactions, animateEmoji);
    if (message) scrollToBottom();
  };

  const reactTo = async (message, emoji) => {
    const value = String(emoji || '').trim().slice(0, 16);
    if (!value || !message) return;
    const reactions = await reactToMessage(
      character.id,
      message.id,
      value,
      'user',
    );
    if (!reactions) {
      toast('贴表情失败，请重试', { tone: 'danger' });
      return;
    }
    applyReactionsToMessage(message.id, reactions, value);
    navigator.vibrate?.(8);
  };

  /* ------------------------------------------------------------------ *
   * 多选：从长按菜单进入，顶栏换成 取消 / 删除 / 收藏
   * ------------------------------------------------------------------ */

  let selecting = false;
  const picked = new Set();
  const headerNode = screen.querySelector('.chat-header');
  const selectBar = screen.querySelector('[data-select-bar]');
  const selectCount = screen.querySelector('[data-select-count]');
  const selectDelete = screen.querySelector('[data-select-delete]');
  const selectFavorite = screen.querySelector('[data-select-favorite]');

  const messageRows = () =>
    [...thread.querySelectorAll('.message-row[data-message-id]')];

  const syncSelectBar = () => {
    if (selectCount) {
      selectCount.textContent = picked.size
        ? `已选择 ${picked.size} 条`
        : '选择消息';
    }
    if (selectDelete) selectDelete.disabled = !picked.size;
    if (selectFavorite) selectFavorite.disabled = !picked.size;
  };

  const togglePicked = (row) => {
    if (!row) return;
    const id = row.dataset.messageId;
    if (!id) return;
    if (picked.has(id)) {
      picked.delete(id);
      row.classList.remove('is-picked');
    } else {
      picked.add(id);
      row.classList.add('is-picked');
    }
    syncSelectBar();
  };

  const enterSelectMode = (seedRow) => {
    if (selecting) return;
    selecting = true;
    screen.classList.add('is-selecting');
    headerNode?.classList.add('is-selecting');
    if (seedRow) togglePicked(seedRow);
    syncSelectBar();
    navigator.vibrate?.(10);
  };

  const exitSelectMode = () => {
    if (!selecting) return;
    selecting = false;
    picked.clear();
    screen.classList.remove('is-selecting');
    headerNode?.classList.remove('is-selecting');
    messageRows().forEach((row) => row.classList.remove('is-picked'));
    syncSelectBar();
  };

  const pickedMessages = () =>
    [...picked]
      .map((id) => loadedMessages.find((item) => item.id === id))
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt);

  const deletePicked = async () => {
    const ids = [...picked];
    if (!ids.length) return;
    for (const id of ids) {
      const removed = await deleteMessage(character.id, id);
      if (removed) deletedIds.add(id);
    }
    loadedMessages = loadedMessages.filter((message) => !picked.has(message.id));
    messageRows().forEach((row) => {
      if (picked.has(row.dataset.messageId)) row.remove();
    });
    const remaining = thread.querySelectorAll('.message-row[data-message-id]').length;
    const latest = loadedMessages.at(-1);
    previousTimestamp = latest?.createdAt || null;
    previousRole = latest?.role || null;
    if (!remaining && !pendingRow) {
      thread.innerHTML = emptyState(character);
      previousTimestamp = null;
      previousRole = null;
    } else {
      syncRowAppearance();
    }
    composer.setSentCount(await recountMultiSentCount(character.id));
    exitSelectMode();
    toast(ids.length > 1 ? `已删除 ${ids.length} 条消息` : '消息已删除');
  };

  const promptFavorite = () => {
    const items = pickedMessages();
    if (!items.length) return;
    const first = items.find((item) => messageAsText(item).trim());
    const suggested = first
      ? messageAsText(first).replace(/\s+/g, ' ').trim().slice(0, 18)
      : '';
    openSheet({
      title: '收藏这段对话',
      description: `已选 ${items.length} 条消息，起个名字方便以后找。`,
      content: `<label class="field">
        <span class="field__label">标题</span>
        <span class="field__control">
          <input class="field__input" data-favorite-title maxlength="40" autocomplete="off" placeholder="例如：关于秋天的开场白" value="${escapeHTML(suggested)}">
        </span>
      </label>`,
      actions: `<div class="button-row">
        <button class="button button--secondary" type="button" data-favorite-cancel>取消</button>
        <button class="button button--primary" type="button" data-favorite-save>收藏</button>
      </div>`,
      onMount: (sheet) => {
        const input = sheet.querySelector('[data-favorite-title]');
        const save = () => {
          const favorite = addFavorite({
            title: input.value.trim() || suggested || '未命名收藏',
            characterId: character.id,
            characterName: character.name,
            messages: items,
          });
          if (!favorite) {
            toast('收藏失败，请重试', { tone: 'danger' });
            return;
          }
          closeActiveSheet();
          exitSelectMode();
          toast('已收藏');
        };
        sheet.querySelector('[data-favorite-cancel]').addEventListener('click', () => {
          closeActiveSheet();
        });
        sheet.querySelector('[data-favorite-save]').addEventListener('click', save);
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' || event.isComposing) return;
          event.preventDefault();
          save();
        });
        window.setTimeout(() => input.focus({ preventScroll: true }), 120);
      },
    });
  };

  selectBar?.querySelector('[data-select-cancel]')?.addEventListener('click', exitSelectMode);
  selectDelete?.addEventListener('click', deletePicked);
  selectFavorite?.addEventListener('click', promptFavorite);
  syncSelectBar();

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
    setTyping(false);
    if (!disposed) composer.setReceiving(false);
  };

  const itemMessage = (item) =>
    item?.kind === 'message' ? item.message : item?.message || item;

  const revealItem = (item, animate) => {
    if (item?.kind === 'reaction') {
      applyReactionsToMessage(
        item.messageId,
        item.reactions || [],
        animate ? item.emoji : '',
      );
      return;
    }
    const message = itemMessage(item);
    if (message) appendMessage(message, { animate });
  };

  const flushReveal = () => {
    const rest = revealPending;
    finishReveal();
    rest.forEach((item) => revealItem(item, false));
    if (pendingGroupSync) {
      pendingGroupSync = false;
      syncRowAppearance();
    }
  };

  const revealStep = () => {
    revealTimer = null;
    if (disposed) return;
    const item = revealPending.shift();
    if (!item) {
      composer.setReceiving(false);
      setTyping(false);
      return;
    }
    // A tapback animates on its own beat, then the next message follows. This
    // keeps the reveal in the exact order the AI wrote its tags.
    if (item.kind === 'reaction') {
      revealItem(item, true);
      setTyping(false);
      composer.setReceiving(false);
      if (revealPending.length) {
        revealTimer = window.setTimeout(revealStep, 420);
        return;
      }
    } else {
      const message = itemMessage(item);
      if (!message) {
        revealStep();
        return;
      }
      appendMessage(message, { animate: true });
      setTyping(false);
      composer.setReceiving(false);
      if (revealPending.length) {
        revealTimer = window.setTimeout(revealStep, revealGap(message));
        return;
      }
    }
    if (pendingGroupSync) {
      pendingGroupSync = false;
      syncRowAppearance();
    }
  };

  const queueReveal = (items) => {
    if (!items?.length) {
      setTyping(false);
      composer.setReceiving(false);
      return;
    }
    finishReveal();
    revealPending = items.slice();
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
    if (chatStyle.sendMode === 'multi') composer.setSentCount(incrementMultiSentCount(character.id));
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
        if (chatStyle.sendMode === 'multi') composer.setSentCount(incrementMultiSentCount(character.id));
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
    const hasRaw = Boolean(message.raw?.trim());
    const raw = hasRaw ? message.raw.trim() : messageAsText(message);
    openSheet({
      title: '原始输出',
      description: hasRaw
        ? '本轮 AI 返回的完整原始内容，含 [status]、[msg] 等标签，方便排查格式问题。'
        : '这条消息没有保存原始输出（较早的消息或种子对话），下面显示解析后的文字。',
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
        sheet.querySelector('[data-save-edit]').addEventListener('click', async () => {
          const value = textarea.value.trim();
          if (!value) {
            toast('回复内容不能为空', { tone: 'danger' });
            textarea.focus();
            return;
          }
          const updated = await updateMessage(character.id, message.id, { content: value });
          if (!updated) {
            toast('修改失败，请重试', { tone: 'danger' });
            return;
          }
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

  const retryReply = async () => {
    if (isReplying(character.id)) {
      toast('对方正在回复，稍等一下');
      return;
    }
    if (revealPending.length) flushReveal();
    const result = await removeLastAssistantReply(character.id);
    if (!result.removed.length) {
      toast('还没有可以重试的回复');
      return;
    }
    const removedIds = new Set(result.removed.map((message) => message.id));
    loadedMessages = loadedMessages.filter((message) => !removedIds.has(message.id));
    thread.querySelectorAll('.message-row[data-message-id]').forEach((row) => {
      if (removedIds.has(row.dataset.messageId)) row.remove();
    });
    let lastChild = thread.lastElementChild;
    while (lastChild && lastChild.classList.contains('chat-day')) {
      lastChild.remove();
      lastChild = thread.lastElementChild;
    }
    const latest = loadedMessages.at(-1);
    previousTimestamp = latest?.createdAt || null;
    previousRole = latest?.role || null;
    syncRowAppearance();
    if (!hasApiConfig()) {
      toast('先配置 API，才能重新生成', { tone: 'danger' });
      return;
    }
    startReply(character.id);
    clearMultiSentCount(character.id);
    composer.setSentCount(0);
  };

  const composer = createChatComposer({
    character,
    characterName: character.name,
    hasConfig: hasApiConfig(),
    sendMode: chatStyle.sendMode,
    composerStyle: chatStyle.composerStyle,
    sentCount: 0,
    onCompose: () => scrollToBottom(true),
    onConfigure: () => {
      window.location.hash = '#/settings/api';
    },
    onStop: () => {
      stopReply(character.id);
    },
    onRedPacket: sendPacket,
    onSticker: () => {
      openStickerPicker({ onPick: sendSticker });
    },
    onRetry: retryReply,
    onMore: () => {
      openComposerActions({
        onImage: () => composer.pickImage(),
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
      const started = startReply(character.id);
      if (started) {
        clearMultiSentCount(character.id);
        composer.setSentCount(0);
      }
      return started;
    },
    onModeChange: (mode) => {
      chatStyle = updateChatStyle(character.id, { sendMode: mode });
      if (mode === 'single') {
        clearMultiSentCount(character.id);
        composer.setSentCount(0);
      }
      toast(mode === 'multi' ? '多条模式 · 双击发送键接收回复' : '单条模式 · 发送后自动回复');
    },
    onSend: (text, quote, images) => {
      const isMulti = chatStyle.sendMode === 'multi';
      const attachments = Array.isArray(images) ? images : [];
      if (!text.trim() && !attachments.length) return false;
      if (!isMulti && !hasApiConfig()) {
        toast('先配置 API，才能收到回复', { tone: 'danger' });
        return false;
      }
      if (!isMulti && isReplying(character.id)) return false;
      if (revealPending.length) flushReveal();
      const message = attachments.length
        ? addMessage(character.id, 'user', text, {
            type: 'image',
            images: attachments,
            quote,
          })
        : addMessage(character.id, 'user', text, { quote });
      if (!message) return false;
      if (message.type === 'image') {
        // The blob write is asynchronous; seed the render cache with the local
        // preview so the bubble does not flash "missing" while IndexedDB saves.
        message.images?.forEach((ref, index) => {
          const attachment = attachments[index];
          if (attachment?.dataUrl) imageUrlCache.set(ref.id, attachment.dataUrl);
        });
      }
      appendMessage(message, { animate: true, forceScroll: true });
      if (isMulti) composer.setSentCount(incrementMultiSentCount(character.id));
      else startReply(character.id);
      return true;
    },
  });

  const composerSlot = screen.querySelector('[data-composer-slot]');
  composerSlot.appendChild(composer.element);

  let chromeObserver = null;
  const syncChatChrome = () => {
    const composerHeight = Math.ceil(composerSlot.getBoundingClientRect().height);
    if (composerHeight > 0) {
      root.style.setProperty('--chat-composer-space', `${composerHeight}px`);
    }
    const headerHeight = Math.ceil(headerNode.getBoundingClientRect().height);
    if (headerHeight > 0) {
      root.style.setProperty('--chat-header-space', `${headerHeight}px`);
    }
  };
  if (typeof ResizeObserver === 'function') {
    chromeObserver = new ResizeObserver(() => {
      syncChatChrome();
      if (stickToBottom) scrollToBottom(true);
    });
    chromeObserver.observe(composerSlot);
    chromeObserver.observe(headerNode);
  }
  requestAnimationFrame(syncChatChrome);

  const handleReplyEvent = (event) => {
    if (!ready) {
      earlyEvents.push(event);
      return;
    }
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
      queueReveal(
        Array.isArray(event.items) ? event.items : event.messages || [],
      );
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
      setTyping(false);
      composer.setStreaming(false);
      composer.setReceiving(false);
      return;
    }
    if (event.type === 'error') {
      removePendingRow();
      setTyping(false);
      composer.setStreaming(false);
      composer.setReceiving(false);
      composer.focus();
    }
  };

  const unsubscribe = subscribeReply(character.id, handleReplyEvent);

  const loadInitial = async () => {
    try {
      await flushMessageWrites();
      const page = await getMessagePage(character.id, { limit: 50 });
      if (disposed) return;
      loadedMessages = page.messages;
      hasMore = page.hasMore;
      previousTimestamp = loadedMessages.at(-1)?.createdAt || null;
      previousRole = loadedMessages.at(-1)?.role || null;
      renderThread();
      updateSparkBadge();
      const pending = await countPendingUserMessages(character.id);
      if (!disposed) composer.setSentCount(pending);
    } catch {
      if (!disposed) {
        renderThread();
        toast('加载聊天记录失败，请重试', { tone: 'danger' });
      }
    } finally {
      if (disposed) return;
      ready = true;
      const running = getReplyState(character.id);
      if (running.running) {
        appendPendingRow();
        composer.setStreaming(true);
        composer.setReceiving(true);
        if (running.status) setHeaderStatus(running.status);
      }
      for (const event of earlyEvents.splice(0)) handleReplyEvent(event);
      requestAnimationFrame(() => scrollToBottom(true));
    }
  };
  loadInitial();

  bindLongPress(thread, '.message-row[data-message-id]', (row) => {
    if (selecting) return;
    const message = loadedMessages.find(
      (item) => item.id === row.dataset.messageId,
    );
    if (!message) return;
    openMessageMenu({
      anchor: row,
      onSelect: () => enterSelectMode(row),
      onReact: () => {
        openReactionPicker({
          anchor: row,
          onPick: (emoji) => {
            reactTo(message, emoji);
          },
        });
      },
      onCopy: async () => {
        const copied = await copyText(messageAsText(message));
        toast(copied ? '已复制' : '复制失败', {
          tone: copied ? 'default' : 'danger',
        });
      },
      onEdit:
        message.role === 'assistant' && message.type === 'text'
          ? () => openEditSheet(message)
          : undefined,
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
      onDelete: async () => {
        if (!(await deleteMessage(character.id, message.id))) return;
        deletedIds.add(message.id);
        loadedMessages = loadedMessages.filter((item) => item.id !== message.id);
        row.remove();
        composer.setSentCount(await recountMultiSentCount(character.id));
        const remaining = thread.querySelectorAll(
          '.message-row[data-message-id]',
        ).length;
        const latest = loadedMessages.at(-1);
        previousTimestamp = latest?.createdAt || null;
        previousRole = latest?.role || null;
        if (!remaining && !pendingRow) {
          thread.innerHTML = emptyState(character);
          previousTimestamp = null;
          previousRole = null;
        } else {
          syncRowAppearance();
        }
        toast('消息已删除');
      },
    });
  });

  thread.addEventListener('click', async (event) => {
    const more = event.target.closest('[data-load-more]');
    if (more) {
      loadOlder();
      return;
    }
    if (selecting) {
      const row = event.target.closest('.message-row[data-message-id]');
      if (row) {
        event.preventDefault();
        event.stopPropagation();
        togglePicked(row);
      }
      return;
    }
    const imageTarget = event.target.closest('[data-image-message]');
    if (imageTarget) {
      const message = loadedMessages.find(
        (item) => item.id === imageTarget.dataset.imageMessage,
      );
      if (message) {
        const layer = event.target.closest('[data-image-index]');
        openImageViewer(message, Number(layer?.dataset.imageIndex || 0));
      }
      return;
    }
    const card = event.target.closest('[data-claim-packet]');
    if (!card || card.disabled) return;
    const messageId = card.dataset.claimPacket;
    const message = loadedMessages.find((item) => item.id === messageId);
    const result = await claimRedPacket(character.id, messageId);
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

  screen.querySelectorAll('[data-open-profile]').forEach((button) => {
    button.addEventListener('click', () => {
      openPartnerSheet({
        character: getCharacter(character.id),
        onChanged: refresh,
      });
    });
  });

  screen.querySelector('[data-open-chat-menu]').addEventListener('click', () => {
    openSheet({
      title: '会话',
      className: 'chat-action-sheet chat-action-sheet--menu',
      content: `<div class="composer-action-grid">
        <button class="composer-action" type="button" data-chat-profile>
          <span class="composer-action__icon">${uiIcon('user', { size: 22 })}</span>
          <span>对话资料</span>
        </button>
        <button class="composer-action" type="button" data-chat-settings>
          <span class="composer-action__icon">${uiIcon('settings', { size: 22 })}</span>
          <span>聊天设置</span>
        </button>
      </div>`,
      onMount: (sheet) => {
        sheet.querySelector('[data-chat-profile]').addEventListener('click', () => {
          closeActiveSheet({ immediate: true, reason: 'replace' });
          openPartnerSheet({
            character: getCharacter(character.id),
            compact: true,
            onChanged: refresh,
          });
        });
        sheet.querySelector('[data-chat-settings]').addEventListener('click', () => {
          closeActiveSheet({ immediate: true, reason: 'navigate' });
          window.location.hash = `#/chat/${character.id}/settings`;
        });
      },
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
      chromeObserver?.disconnect();
      document.querySelector('.image-viewer')?.remove();
      document.body.classList.remove('has-image-viewer');
      revokeChatImageUrls();
      root.style.removeProperty('--chat-composer-space');
      root.style.removeProperty('--chat-header-space');
      if (taglineTimer) window.clearTimeout(taglineTimer);
      closeMessageMenu();
      closeReactionPicker();
      inertia.destroy();
      unsubscribe();
      setActiveChat(null);
      composer.cleanup();
    },
  };
}
