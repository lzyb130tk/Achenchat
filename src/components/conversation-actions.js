import {
  deleteConversation,
  pinConversation,
  updateCharacter,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

export function bindLongPress(container, selector, handler) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let pressedItem = null;
  let suppressedItem = null;

  const clear = () => {
    window.clearTimeout(timer);
    timer = null;
    pressedItem = null;
  };

  container.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const item = event.target.closest(selector);
    if (!item) return;
    pressedItem = item;
    startX = event.clientX;
    startY = event.clientY;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!pressedItem) return;
      const item = pressedItem;
      suppressedItem = item;
      navigator.vibrate?.(8);
      handler(item);
      window.setTimeout(() => {
        if (suppressedItem === item) suppressedItem = null;
      }, 900);
    }, 480);
  });

  container.addEventListener('pointermove', (event) => {
    if (!pressedItem) return;
    if (
      Math.abs(event.clientX - startX) > 10 ||
      Math.abs(event.clientY - startY) > 10
    ) {
      clear();
    }
  });

  container.addEventListener('pointerup', clear);
  container.addEventListener('pointercancel', clear);

  container.addEventListener(
    'click',
    (event) => {
      const item = event.target.closest(selector);
      if (item && item === suppressedItem) {
        event.preventDefault();
        event.stopPropagation();
        suppressedItem = null;
      }
    },
    true,
  );

  container.addEventListener('contextmenu', (event) => {
    const item = event.target.closest(selector);
    if (!item) return;
    event.preventDefault();
    handler(item);
  });
}

export function openConversationActions({ character, conversation, refresh }) {
  const pinned = Boolean(conversation.pinned);
  const muted = Boolean(character.muted);

  openSheet({
    title: character.name,
    description: '对话操作',
    content: `<div class="action-list">
      <button class="action-row" type="button" data-pin>
        <span class="action-row__icon">${icon('push-pin')}</span>
        <span class="action-row__copy"><strong>${pinned ? '取消置顶' : '置顶对话'}</strong><small>${pinned ? '回到时间顺序' : '把这段对话留在最上面'}</small></span>
      </button>
      <button class="action-row" type="button" data-mute>
        <span class="action-row__icon">${icon(muted ? 'bell' : 'bell-slash')}</span>
        <span class="action-row__copy"><strong>${muted ? '关闭免打扰' : '开启免打扰'}</strong><small>在别处时不再弹出消息横幅</small></span>
      </button>
      <button class="action-row action-row--danger" type="button" data-delete>
        <span class="action-row__icon">${icon('trash-simple')}</span>
        <span class="action-row__copy"><strong>删除对话</strong><small>只删除消息，伙伴还在联系人里</small></span>
      </button>
    </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-pin]').addEventListener('click', () => {
        pinConversation(character.id, !pinned);
        closeActiveSheet();
        toast(pinned ? '已取消置顶' : '已置顶');
        refresh();
      });

      sheet.querySelector('[data-mute]').addEventListener('click', () => {
        updateCharacter(character.id, { muted: !muted });
        closeActiveSheet();
        toast(muted ? '已关闭免打扰' : '已开启免打扰');
        refresh();
      });

      sheet.querySelector('[data-delete]').addEventListener('click', () => {
        openSheet({
          title: '删除对话',
          description: `和${escapeHTML(character.name)}的所有消息都会被删除。`,
          actions: `<div class="button-row">
            <button class="button button--secondary" type="button" data-cancel-delete>取消</button>
            <button class="button button--danger" type="button" data-confirm-delete>删除</button>
          </div>`,
          onMount: (confirmSheet) => {
            confirmSheet.querySelector('[data-cancel-delete]').addEventListener('click', () => {
              closeActiveSheet();
            });
            confirmSheet.querySelector('[data-confirm-delete]').addEventListener('click', () => {
              deleteConversation(character.id);
              closeActiveSheet({ immediate: true });
              toast('对话已删除');
              refresh();
            });
          },
        });
      });
    },
  });
}
