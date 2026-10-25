import { icon } from './icons.js';

export function createChatComposer({ characterName, hasConfig, onSend, onStop, onConfigure }) {
  const element = document.createElement('div');
  element.className = 'chat-composer';
  element.innerHTML = `
    ${hasConfig ? '' : `<button class="chat-composer__hint" type="button" data-configure>
      <span class="status-dot status-dot--idle"></span>
      <span>尚未连接 AI</span>
      <span class="chat-composer__hint-action">去配置</span>
    </button>`}
    <div class="chat-composer__bar">
      <div class="chat-composer__field">
        <textarea
          class="chat-composer__input"
          rows="1"
          maxlength="2000"
          placeholder="和${characterName}说点什么…"
          aria-label="消息内容"
          enterkeyhint="send"
        ></textarea>
        <button class="chat-composer__send" type="button" aria-label="发送" data-send disabled>
          ${icon('paper-plane-tilt', 'fill')}
        </button>
      </div>
    </div>`;

  const input = element.querySelector('.chat-composer__input');
  const sendButton = element.querySelector('[data-send]');
  let streaming = false;

  const resize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  };

  const updateSendState = () => {
    if (streaming) return;
    sendButton.disabled = !input.value.trim();
  };

  const send = () => {
    const text = input.value.trim();
    if (!text || streaming) return;
    const accepted = onSend(text);
    if (accepted === false) return;
    input.value = '';
    resize();
    updateSendState();
  };

  input.addEventListener('input', () => {
    resize();
    updateSendState();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    send();
  });

  sendButton.addEventListener('click', () => {
    if (streaming) {
      onStop?.();
      return;
    }
    send();
  });

  element.querySelector('[data-configure]')?.addEventListener('click', onConfigure);

  const setStreaming = (value) => {
    streaming = value;
    input.disabled = value;
    sendButton.classList.toggle('is-stopping', value);
    sendButton.setAttribute('aria-label', value ? '停止生成' : '发送');
    sendButton.innerHTML = value ? icon('stop', 'fill') : icon('paper-plane-tilt', 'fill');
    sendButton.disabled = value ? false : !input.value.trim();
  };

  return {
    element,
    setStreaming,
    setValue(value) {
      input.value = value;
      resize();
      updateSendState();
    },
    focus() {
      window.setTimeout(() => input.focus({ preventScroll: true }), 120);
    },
    cleanup() {},
  };
}
