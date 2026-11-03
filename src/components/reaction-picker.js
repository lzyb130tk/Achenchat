import { uiIcon } from './icons.js';

// Fifteen taps that cover most chat moods; anything else can be typed with the
// phone's own emoji keyboard.
export const PRESET_REACTIONS = [
  '❤️',
  '👍',
  '😂',
  '😮',
  '😢',
  '🎉',
  '🔥',
  '😍',
  '🙏',
  '😭',
  '🤣',
  '😅',
  '😎',
  '🥰',
  '🤔',
];

let activePicker = null;

function removeLayer(layer) {
  layer.classList.remove('is-open');
  document.body.classList.remove('is-reaction-picker-open');
  window.setTimeout(() => layer.remove(), 220);
}

export function closeReactionPicker() {
  if (!activePicker) return;
  const { layer, cleanup } = activePicker;
  activePicker = null;
  cleanup();
  removeLayer(layer);
}

export function openReactionPicker({ anchor, onPick }) {
  closeReactionPicker();

  const layer = document.createElement('div');
  layer.className = 'reaction-picker-layer';
  layer.innerHTML = `
    <button class="reaction-picker__scrim" type="button" data-reaction-close aria-label="关闭表情选择"></button>
    <div class="reaction-picker" role="dialog" aria-label="给这条消息贴表情">
      <div class="reaction-picker__grid">
        ${PRESET_REACTIONS.map(
          (emoji) => `<button class="reaction-picker__emoji" type="button" data-reaction-emoji="${emoji}" aria-label="贴 ${emoji}"><span>${emoji}</span></button>`,
        ).join('')}
      </div>
      <form class="reaction-picker__custom" data-reaction-form>
        <input class="reaction-picker__input" type="text" autocomplete="off" spellcheck="false"
          enterkeyhint="send" maxlength="16" placeholder="用输入法输入任意表情…" aria-label="自定义表情" data-reaction-input>
        <button class="reaction-picker__send" type="submit" aria-label="贴上这个表情" disabled>
          ${uiIcon('arrow-up', { size: 16, strokeWidth: 2 })}
        </button>
      </form>
    </div>`;
  document.body.appendChild(layer);

  const panel = layer.querySelector('.reaction-picker');
  const input = layer.querySelector('[data-reaction-input]');
  const send = layer.querySelector('.reaction-picker__send');
  const form = layer.querySelector('[data-reaction-form]');

  // Keep the panel next to the tapped bubble, above it when there is room and
  // below otherwise, always inside the viewport.
  const position = () => {
    if (!anchor.isConnected) {
      closeReactionPicker();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const margin = 12;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = rect.top - height - 12;
    if (top < margin) {
      top = rect.bottom + 12;
    }
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - height - margin);
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };
  position();

  const pick = (value) => {
    const emoji = String(value || '').trim().slice(0, 16);
    if (!emoji) return;
    closeReactionPicker();
    onPick?.(emoji);
  };

  const syncSend = () => {
    send.disabled = !input.value.trim();
  };

  const returnFocus = document.activeElement;
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeReactionPicker();
    }
  };
  const onScroll = () => closeReactionPicker();
  const onResize = () => {
    if (anchor.isConnected) position();
    else closeReactionPicker();
  };

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  };
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);
  activePicker = { layer, cleanup };

  layer
    .querySelector('[data-reaction-close]')
    .addEventListener('click', closeReactionPicker);
  layer.querySelectorAll('[data-reaction-emoji]').forEach((button) => {
    button.addEventListener('click', () => pick(button.dataset.reactionEmoji));
  });

  input.addEventListener('input', syncSend);
  input.addEventListener('compositionend', syncSend);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    pick(input.value);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    pick(input.value);
  });

  document.body.classList.add('is-reaction-picker-open');
  requestAnimationFrame(() => {
    position();
    layer.classList.add('is-open');
  });
}
