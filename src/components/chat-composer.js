import { openChoiceSheet } from './choice-sheet.js';
import { uiIcon } from './icons.js';

export function createChatComposer({
  characterName,
  hasConfig,
  sendMode = 'single',
  sentCount = 0,
  composerStyle = 'default',
  onSend,
  onStop,
  onConfigure,
  onMore,
  onSticker,
  onRetry,
  onRedPacket,
  onReceive,
  onModeChange,
  onCompose,
}) {
  const element = document.createElement('div');
  element.className = 'chat-composer';
  element.innerHTML = `
    ${hasConfig ? '' : `<button class="chat-composer__hint" type="button" data-configure>
      <span class="status-dot status-dot--idle"></span>
      <span>尚未连接 AI</span>
      <span class="chat-composer__hint-action">去配置</span>
    </button>`}
    <div class="chat-composer__quote" data-quote hidden>
      <span class="chat-composer__quote-icon">${uiIcon('corner-down-right', { size: 17 })}</span>
      <span class="chat-composer__quote-copy">
        <strong data-quote-name></strong>
        <small data-quote-text></small>
      </span>
      <button class="chat-composer__quote-close" type="button" aria-label="取消引用" data-quote-clear>${uiIcon('x', { size: 16 })}</button>
    </div>
    <div class="chat-composer__bar">
      <div class="chat-composer__field">
        <div class="chat-composer__quick" data-quick hidden>
          <button class="chat-composer__quick-button" type="button" data-quick-redpacket aria-label="发红包">
            ${uiIcon('red-packet', { size: 17 })}
            <span>红包</span>
          </button>
          <button class="chat-composer__quick-button" type="button" data-quick-retry aria-label="重新生成上一条回复">
            ${uiIcon('retry', { size: 17 })}
            <span>重试</span>
          </button>
        </div>
        <button class="chat-composer__extra" type="button" aria-label="更多功能" data-composer-more>
          <span class="chat-composer__extra-icon" data-composer-extra-icon>${uiIcon('plus', { size: 22 })}</span>
        </button>
        <textarea
          class="chat-composer__input"
          rows="1"
          maxlength="2000"
          placeholder="和${characterName}说点什么…"
          aria-label="消息内容"
          enterkeyhint="send"
        ></textarea>
        <button class="chat-composer__send" type="button" aria-label="发送，双击接收回复" data-send disabled>
          <span class="chat-composer__send-icon" data-send-icon>${uiIcon('send', { size: 19, strokeWidth: 1.8 })}</span>
          <span class="chat-composer__send-badge" data-send-badge hidden></span>
        </button>
      </div>
    </div>`;

  const input = element.querySelector('.chat-composer__input');
  const sendButton = element.querySelector('[data-send]');
  const sendIcon = element.querySelector('[data-send-icon]');
  const sendBadge = element.querySelector('[data-send-badge]');
  const moreButton = element.querySelector('[data-composer-more]');
  const extraIcon = element.querySelector('[data-composer-extra-icon]');
  const quickRow = element.querySelector('[data-quick]');
  const quickRedPacket = element.querySelector('[data-quick-redpacket]');
  const quickRetry = element.querySelector('[data-quick-retry]');
  const quoteBar = element.querySelector('[data-quote]');
  const quoteName = element.querySelector('[data-quote-name]');
  const quoteText = element.querySelector('[data-quote-text]');

  let mode = sendMode === 'multi' ? 'multi' : 'single';
  let streaming = false;
  let receiving = false;
  let raised = false;
  let pendingCount = Math.max(0, Number(sentCount) || 0);
  let quote = null;
  let sendGuardUntil = 0;

  const resize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  };

  // In multi mode the send key doubles as the "receive" key once there is
  // something waiting: the field is empty and the queued count is above zero.
  const receiveReady = () =>
    mode === 'multi' &&
    pendingCount > 0 &&
    !streaming &&
    !receiving &&
    !input.value.trim();

  const syncSend = () => {
    const ready = receiveReady();
    sendButton.classList.toggle('is-receive', ready);
    sendButton.classList.toggle('is-stopping', streaming);

    if (streaming) {
      sendIcon.innerHTML = uiIcon('stop', { size: 18 });
      sendButton.disabled = false;
      sendButton.setAttribute('aria-label', '停止生成');
    } else {
      sendIcon.innerHTML = uiIcon(ready ? 'arrow-down' : 'send', { size: 19, strokeWidth: 1.8 });
      sendButton.disabled = ready ? false : !input.value.trim();
      sendButton.setAttribute(
        'aria-label',
        ready
          ? `接收回复，已发送 ${pendingCount} 条，双击发送键也可接收`
          : mode === 'multi'
            ? '发送，双击接收回复，长按切换发送方式'
            : '发送，长按切换发送方式',
      );
    }

    const showBadge = mode === 'multi' && pendingCount > 0 && !streaming && !receiving;
    sendBadge.hidden = !showBadge;
    sendBadge.textContent = pendingCount > 99 ? '99+' : String(pendingCount);

    input.disabled = streaming;
    moreButton.disabled = streaming;
    quickRedPacket.disabled = streaming;
    quickRetry.disabled = streaming;
  };

  const setSentCount = (value) => {
    pendingCount = Math.max(0, Math.min(999, Number(value) || 0));
    syncSend();
  };

  const setMode = (value) => {
    mode = value === 'multi' ? 'multi' : 'single';
    syncSend();
  };

  const setComposerStyle = (value) => {
    raised = value === 'raised';
    element.classList.toggle('chat-composer--raised', raised);
    quickRow.hidden = !raised;
    extraIcon.innerHTML = uiIcon(raised ? 'sticker' : 'plus', {
      size: raised ? 21 : 22,
    });
    moreButton.setAttribute('aria-label', raised ? '表情包' : '更多功能');
  };

  const setQuote = (value) => {
    quote = value && value.content ? { ...value } : null;
    quoteBar.hidden = !quote;
    if (quote) {
      quoteName.textContent = `回复 ${quote.name || '对方'}`;
      quoteText.textContent = quote.content;
    }
  };

  const clearQuote = () => setQuote(null);

  const openModeChooser = () => {
    openChoiceSheet({
      title: '发送方式',
      current: mode,
      options: [
        {
          value: 'single',
          label: '单条',
          meta: '发送后立刻请求回复',
          icon: 'paper-plane-tilt',
        },
        {
          value: 'multi',
          label: '多条',
          meta: '连续发送，双击发送键接收回复',
          icon: 'stack',
        },
      ],
      onChoose: (value) => {
        setMode(value);
        onModeChange?.(value);
      },
    });
  };

  const receive = () => {
    if (!receiveReady()) return false;
    const accepted = onReceive?.();
    if (accepted === false) return false;
    receiving = true;
    pendingCount = 0;
    syncSend();
    return true;
  };

  const send = () => {
    const text = input.value.trim();
    if (!text || streaming) return;
    const accepted = onSend(text, quote);
    if (accepted === false) return;
    // A double click should not turn "send draft" into "send + receive".
    sendGuardUntil = performance.now() + 360;
    input.value = '';
    resize();
    clearQuote();
    syncSend();
  };

  input.addEventListener('input', () => {
    resize();
    syncSend();
    onCompose?.();
  });

  input.addEventListener('focus', () => onCompose?.());

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    send();
  });

  let pressTimer = null;
  let suppressClick = false;
  let pressX = 0;
  let pressY = 0;

  const clearPress = () => {
    window.clearTimeout(pressTimer);
    pressTimer = null;
  };

  sendButton.addEventListener('pointerdown', (event) => {
    if (streaming) return;
    pressX = event.clientX;
    pressY = event.clientY;
    clearPress();
    pressTimer = window.setTimeout(() => {
      suppressClick = true;
      navigator.vibrate?.(8);
      openModeChooser();
    }, 460);
  });

  sendButton.addEventListener('pointermove', (event) => {
    if (!pressTimer) return;
    if (Math.abs(event.clientX - pressX) > 10 || Math.abs(event.clientY - pressY) > 10) {
      clearPress();
    }
  });
  sendButton.addEventListener('pointerup', clearPress);
  sendButton.addEventListener('pointercancel', clearPress);
  sendButton.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (!streaming) openModeChooser();
  });

  sendButton.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (streaming) {
      onStop?.();
      return;
    }
    if (performance.now() < sendGuardUntil) return;
    if (receiveReady()) {
      receive();
      return;
    }
    send();
  });

  // Double-clicking the send key receives the queued replies in multi mode.
  sendButton.addEventListener('dblclick', (event) => {
    event.preventDefault();
    if (streaming || performance.now() < sendGuardUntil) return;
    receive();
  });

  quoteBar.querySelector('[data-quote-clear]').addEventListener('click', clearQuote);

  element.querySelector('[data-configure]')?.addEventListener('click', onConfigure);
  moreButton.addEventListener('click', () => {
    if (streaming) return;
    if (raised) {
      onSticker?.();
      return;
    }
    moreButton.classList.remove('is-spinning');
    void moreButton.offsetWidth;
    moreButton.classList.add('is-spinning');
    onMore?.();
  });
  moreButton.addEventListener('animationend', () => {
    moreButton.classList.remove('is-spinning');
  });

  quickRedPacket.addEventListener('click', () => {
    if (streaming) return;
    onRedPacket?.();
  });

  quickRetry.addEventListener('click', () => {
    if (streaming) return;
    onRetry?.();
  });

  const setStreaming = (value) => {
    streaming = value;
    syncSend();
  };

  const setReceiving = (value) => {
    receiving = Boolean(value);
    syncSend();
  };

  syncSend();
  setMode(mode);
  setComposerStyle(composerStyle);

  return {
    element,
    setStreaming,
    setReceiving,
    setMode,
    setComposerStyle,
    setSentCount,
    setValue(value) {
      input.value = value;
      resize();
      syncSend();
    },
    setQuote,
    clearQuote,
    focus() {
      window.setTimeout(() => input.focus({ preventScroll: true }), 120);
    },
    cleanup() {
      clearPress();
    },
  };
}
