import { avatar, characterAvatar } from '../components/avatar.js';
import { createChatComposer } from '../components/chat-composer.js';
import { icon } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { getCharacter } from '../data/characters.js';
import { ApiRequestError, streamChat } from '../services/api.js';
import { takePendingPrompt } from '../services/prompt.js';
import {
  addMessage,
  clearConversation,
  getConversation,
  getProfile,
  hasApiConfig,
  markConversationRead,
} from '../services/store.js';
import { escapeHTML, formatChatDay, isSameDay } from '../services/utils.js';

function chatHeader(character) {
  return `<header class="chat-header">
    <a class="icon-button chat-header__back" href="#/messages" aria-label="返回">${icon('arrow-left')}</a>
    <button class="chat-header__identity" type="button" data-open-profile>
      ${characterAvatar(character, 'sm')}
      <span class="chat-header__copy">
        <span class="chat-header__name">${escapeHTML(character.name)}</span>
        <span class="chat-header__status"><span class="status-dot status-dot--accent"></span>在你的身边</span>
      </span>
    </button>
    <button class="icon-button" type="button" aria-label="对话选项" data-open-profile>${icon('dots-three')}</button>
  </header>`;
}

function messageRow(message, character, showAvatar) {
  if (message.role === 'user') {
    return `<div class="message-row message-row--user">
      <div class="message-bubble message-bubble--user">${escapeHTML(message.content)}</div>
    </div>`;
  }
  return `<div class="message-row message-row--assistant">
    <span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span>
    <div class="message-bubble message-bubble--assistant">${escapeHTML(message.content)}</div>
  </div>`;
}

function dayDivider(timestamp) {
  return `<div class="chat-day"><span>${formatChatDay(timestamp)}</span></div>`;
}

function emptyState(character) {
  return `<div class="chat-empty">
    ${avatar({ mark: character.mark, tone: character.tone, size: 'xl', label: character.name })}
    <h2>和${escapeHTML(character.name)}的第一句话</h2>
    <p>不用想好开场白。</p>
  </div>`;
}

function threadMarkup(messages, character) {
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
      const showAvatar = message.role === 'assistant' && previousRole !== 'assistant';
      markup += messageRow(message, character, showAvatar);
      previousTimestamp = message.createdAt;
      previousRole = message.role;
      return markup;
    })
    .join('');
}

function openPartnerSheet(character, refresh) {
  openSheet({
    title: character.name,
    description: `${character.relationship} · ${character.role}`,
    content: `<div class="partner-profile">
      ${characterAvatar(character, '2xl')}
      <p class="partner-profile__tagline">“${escapeHTML(character.tagline)}”</p>
      <p class="partner-profile__persona">${escapeHTML(character.persona)}</p>
    </div>
    <div class="action-list action-list--compact">
      <button class="action-row action-row--danger" type="button" data-clear-chat>
        <span class="action-row__icon">${icon('trash-simple')}</span>
        <span class="action-row__copy"><strong>清空这段对话</strong></span>
      </button>
    </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-clear-chat]').addEventListener('click', () => {
        clearConversation(character.id);
        closeActiveSheet();
        toast('对话已清空');
        refresh();
      });
    },
  });
}

export function renderChat({ characterId, refresh }) {
  const character = getCharacter(characterId);
  if (!character) return null;

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
  const conversation = getConversation(character.id);
  markConversationRead(character.id);

  let previousTimestamp = null;
  let previousRole = null;

  if (conversation?.messages.length) {
    thread.innerHTML = threadMarkup(conversation.messages, character);
    previousTimestamp = conversation.messages.at(-1).createdAt;
    previousRole = conversation.messages.at(-1).role;
  } else {
    thread.innerHTML = emptyState(character);
  }

  let stickToBottom = true;
  let scrollQueued = false;
  let generating = false;
  let abortController = null;
  let pendingRow = null;
  let pendingBubble = null;
  let pendingText = '';

  const isNearBottom = () =>
    scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;

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
    const showAvatar = message.role === 'assistant' && previousRole !== 'assistant';
    markup += messageRow(message, character, showAvatar);

    thread.insertAdjacentHTML('beforeend', markup);
    previousTimestamp = message.createdAt;
    previousRole = message.role;
    scrollToBottom(true);
  };

  const appendPendingRow = () => {
    thread.querySelector('.chat-empty')?.remove();
    if (!previousTimestamp || !isSameDay(previousTimestamp, Date.now())) {
      thread.insertAdjacentHTML('beforeend', dayDivider(Date.now()));
      previousRole = null;
    }
    const showAvatar = previousRole !== 'assistant';
    pendingRow = document.createElement('div');
    pendingRow.className = 'message-row message-row--assistant message-row--pending';
    pendingRow.innerHTML = `<span class="message-row__avatar">${showAvatar ? characterAvatar(character, 'xs') : ''}</span>
      <div class="message-bubble message-bubble--assistant is-thinking">
        <span class="typing-dots" aria-label="正在输入"><i></i><i></i><i></i></span>
      </div>`;
    thread.appendChild(pendingRow);
    pendingBubble = pendingRow.querySelector('.message-bubble');
    previousTimestamp = Date.now();
    previousRole = 'assistant';
    scrollToBottom(true);
  };

  const finalizePendingRow = (content) => {
    if (!pendingBubble) return;
    pendingRow.classList.remove('message-row--pending');
    pendingBubble.classList.remove('is-thinking', 'is-streaming');
    pendingBubble.textContent = content;
    pendingRow = null;
    pendingBubble = null;
    pendingText = '';
  };

  const removePendingRow = () => {
    pendingRow?.remove();
    pendingRow = null;
    pendingBubble = null;
    pendingText = '';
    const latest = getConversation(character.id)?.messages.at(-1);
    previousTimestamp = latest?.createdAt || null;
    previousRole = latest?.role || null;
  };

  const composer = createChatComposer({
    characterName: character.name,
    hasConfig: hasApiConfig(),
    onConfigure: () => {
      window.location.hash = '#/settings/api';
    },
    onStop: () => {
      abortController?.abort();
    },
    onSend: (text) => {
      if (!hasApiConfig()) {
        toast('先配置 API，才能收到回复', { tone: 'danger' });
        return false;
      }
      if (generating) return false;

      const userMessage = addMessage(character.id, 'user', text);
      appendMessage(userMessage);
      const controller = new AbortController();
      abortController = controller;
      generating = true;
      composer.setStreaming(true);
      generate(controller);
      return true;
    },
  });

  screen.querySelector('[data-composer-slot]').appendChild(composer.element);

  const generate = async (controller) => {
    appendPendingRow();
    const history = getConversation(character.id).messages.slice();

    try {
      const fullText = await streamChat({
        character,
        profile: getProfile(),
        messages: history,
        signal: controller.signal,
        onDelta: (delta) => {
          if (!pendingBubble) return;
          if (pendingBubble.classList.contains('is-thinking')) {
            pendingBubble.classList.remove('is-thinking');
            pendingBubble.classList.add('is-streaming');
            pendingBubble.textContent = '';
          }
          pendingText += delta;
          pendingBubble.textContent = pendingText;
          scrollToBottom();
        },
      });

      const content = fullText.trim();
      if (content) {
        addMessage(character.id, 'assistant', content);
        finalizePendingRow(content);
      } else {
        removePendingRow();
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        const content = pendingText.trim();
        if (content) {
          addMessage(character.id, 'assistant', content);
          finalizePendingRow(content);
        } else {
          removePendingRow();
        }
      } else {
        removePendingRow();
        const message =
          error instanceof ApiRequestError || error?.message
            ? error.message
            : '回复失败，请稍后再试';
        toast(message, { tone: 'danger' });
      }
    } finally {
      if (abortController === controller) abortController = null;
      generating = false;
      composer.setStreaming(false);
      composer.focus();
      scrollToBottom();
    }
  };

  screen.querySelectorAll('[data-open-profile]').forEach((button) => {
    button.addEventListener('click', () => openPartnerSheet(character, refresh));
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
      abortController?.abort();
    },
  };
}
