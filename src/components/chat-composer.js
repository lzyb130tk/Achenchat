import { openChoiceSheet } from './choice-sheet.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';

export function createChatComposer({
  character,
  characterName,
  hasConfig,
  sendMode = 'single',
  sentCount = 0,
  onSend,
  onStop,
  onConfigure,
  onMore,
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
    <div class="chat-composer__pending" data-multi-banner hidden>
      ${characterAvatar(character, 'sm')}
      <span class="chat-composer__pending-copy"><strong data-sent-count>已发送 0 条</strong><small>多条消息模式</small></span>
      <button class="chat-composer__receive" type="button" data-receive aria-label="接收回复">${icon('arrow-down')}<span>接收回复</span></button>
    </div>
    <div class="chat-composer__quote" data-quote hidden>
      <span class="chat-composer__quote-icon">${icon('arrow-elbow-down-right')}</span>
      <span class="chat-composer__quote-copy">
        <strong data-quote-name></strong>
        <small data-quote-text></small>
      </span>
      <button class="chat-composer__quote-close" type="button" aria-label="取消引用" data-quote-clear>${icon('x')}</button>
    </div>
    <div class="chat-composer__bar">
      <div class="chat-composer__field">
        <button class="chat-composer__extra" type="button" aria-label="更多功能" data-composer-more>
          ${icon('plus')}
        </button>
        <textarea
          class="chat-composer__input"
          rows="1"
          maxlength="2000"
          placeholder="和${characterName}说点什么…"
          aria-label="消息内容"
          enterkeyhint="send"
        ></textarea>
        <button class="chat-composer__send" type="button" aria-label="发送，长按切换发送方式" data-send disabled>
          ${icon('paper-plane-tilt')}
        </button>
      </div>
    </div>`;

  const input = element.querySelector('.chat-composer__input');
  const sendButton = element.querySelector('[data-send]');
  const moreButton = element.querySelector('[data-composer-more]');
  const receiveButton = element.querySelector('[data-receive]');
  const pendingBanner = element.querySelector('[data-multi-banner]');
  const sentCountLabel = element.querySelector('[data-sent-count]');
  const quoteBar = element.querySelector('[data-quote]');
  const quoteName = element.querySelector('[data-quote-name]');
  const quoteText = element.querySelector('[data-quote-text]');

  let mode = sendMode === 'multi' ? 'multi' : 'single';
  let streaming = false;
  let receiving = false;
  let pendingCount = Math.max(0, Number(sentCount) || 0);
  let dismissed = false;
  let quote = null;

  const resize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  };

  const updateSendState = () => {
    if (streaming) return;
    sendButton.disabled = !input.value.trim();
  };

  const syncReceive = () => {
    const visible = mode === 'multi' && !dismissed && !receiving && !streaming
      && (pendingCount > 0 || Boolean(input.value.trim()));
    pendingBanner.hidden = !visible;
    sentCountLabel.textContent = `已发送 ${pendingCount} 条`;
    receiveButton.disabled = pendingCount === 0;
  };

  const setSentCount = (value) => {
    pendingCount = Math.max(0, Math.min(999, Number(value) || 0));
    if (pendingCount) dismissed = false;
    syncReceive();
  };

  const setMode = (value) => {
    mode = value === 'multi' ? 'multi' : 'single';
    syncReceive();
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
          meta: '先发送，再点「接收」请求回复',
          icon: 'stack',
        },
      ],
      onChoose: (value) => {
        setMode(value);
        onModeChange?.(value);
      },
    });
  };

  const send = () => {
    const text = input.value.trim();
    if (!text || streaming) return;
    const accepted = onSend(text, quote);
    if (accepted === false) return;
    input.value = '';
    resize();
    updateSendState();
    clearQuote();
  };

  input.addEventListener('input', () => {
    resize();
    updateSendState();
    if (input.value.trim()) dismissed = false;
    syncReceive();
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
    send();
  });

  receiveButton.addEventListener('click', () => {
    if (streaming || receiving || pendingCount === 0) return;
    const accepted = onReceive?.();
    if (accepted !== false) {
      receiving = true;
      pendingCount = 0;
      dismissed = true;
      syncReceive();
    }
  });

  quoteBar.querySelector('[data-quote-clear]').addEventListener('click', clearQuote);

  element.querySelector('[data-configure]')?.addEventListener('click', onConfigure);
  moreButton.addEventListener('click', () => {
    if (!streaming) onMore?.();
  });

  const setStreaming = (value) => {
    streaming = value;
    input.disabled = value;
    moreButton.disabled = value;
    sendButton.classList.toggle('is-stopping', value);
    sendButton.setAttribute(
      'aria-label',
      value ? '停止生成' : '发送，长按切换发送方式',
    );
    sendButton.innerHTML = value ? icon('stop', 'fill') : icon('paper-plane-tilt');
    sendButton.disabled = value ? false : !input.value.trim();
    syncReceive();
  };

  const setReceiving = (value) => {
    receiving = Boolean(value);
    syncReceive();
  };

  syncReceive();
  setMode(mode);

  return {
    element,
    setStreaming,
    setReceiving,
    setMode,
    setSentCount,
    setValue(value) {
      input.value = value;
      resize();
      updateSendState();
      if (input.value.trim()) dismissed = false;
      syncReceive();
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
