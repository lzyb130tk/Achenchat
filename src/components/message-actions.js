import { icon } from './icons.js';

let activeMenu = null;

function closeMenu() {
  if (!activeMenu) return;
  const { layer, cleanup, returnFocus } = activeMenu;
  activeMenu = null;
  cleanup();
  layer.classList.remove('is-open');
  window.setTimeout(() => {
    layer.remove();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }, 140);
}

export function closeMessageMenu() {
  closeMenu();
}

export function openMessageMenu({ anchor, onCopy, onQuote, onDelete, onEdit, onRaw }) {
  closeMenu();
  const layer = document.createElement('div');
  layer.className = 'message-menu-layer';
  layer.innerHTML = `
    <button class="message-menu__scrim" type="button" data-menu-close aria-label="关闭菜单"></button>
    <div class="message-menu" role="menu" aria-label="消息操作">
      <button class="message-menu__item" type="button" role="menuitem" data-menu-action="copy">
        ${icon('copy')}<span>复制</span>
      </button>
      <button class="message-menu__item" type="button" role="menuitem" data-menu-action="quote">
        ${icon('arrow-elbow-down-right')}<span>引用</span>
      </button>
      ${onEdit ? `<button class="message-menu__item" type="button" role="menuitem" data-menu-action="edit">
        ${icon('pencil-simple')}<span>修改</span>
      </button>` : ''}
      ${onRaw ? `<button class="message-menu__item" type="button" role="menuitem" data-menu-action="raw">
        ${icon('file-text')}<span>查看原始输出</span>
      </button>` : ''}
      <button class="message-menu__item message-menu__item--danger" type="button" role="menuitem" data-menu-action="delete">
        ${icon('trash-simple')}<span>删除</span>
      </button>
    </div>`;
  document.body.appendChild(layer);
  const panel = layer.querySelector('.message-menu');
  const margin = 12;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;

  // Keep the menu attached to its message while the thread scrolls, including
  // the automatic scroll that follows a reply. Close only when the anchor
  // leaves the viewport entirely.
  const position = () => {
    if (!anchor.isConnected) {
      closeMenu();
      return false;
    }
    const current = anchor.getBoundingClientRect();
    if (current.bottom <= margin || current.top >= window.innerHeight - margin) {
      closeMenu();
      return false;
    }
    let left = current.left + current.width / 2 - width / 2;
    left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
    let top = current.top - height - 8;
    if (top < margin) {
      top = Math.min(current.bottom + 8, window.innerHeight - height - margin);
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    return true;
  };
  position();

  const returnFocus = document.activeElement;
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };
  let scrollFrame = 0;
  let closed = false;
  const stop = () => {
    closed = true;
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  };
  const onScroll = () => {
    if (closed || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!closed) position();
    });
  };
  const onResize = () => {
    if (!closed) position();
  };
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, true);
  activeMenu = {
    layer,
    returnFocus,
    cleanup: () => {
      stop();
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    },
  };

  layer.querySelector('[data-menu-close]').addEventListener('click', closeMenu);
  layer.querySelectorAll('[data-menu-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.menuAction;
      closeMenu();
      if (action === 'copy') onCopy?.();
      else if (action === 'quote') onQuote?.();
      else if (action === 'edit') onEdit?.();
      else if (action === 'raw') onRaw?.();
      else if (action === 'delete') onDelete?.();
    });
  });

  requestAnimationFrame(() => {
    layer.classList.add('is-open');
    panel.querySelector('[data-menu-action]')?.focus({ preventScroll: true });
  });
}
