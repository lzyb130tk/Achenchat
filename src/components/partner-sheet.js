import {
  clearConversation,
  getCharacter,
  updateCharacter,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { openCharacterEditor } from './character-editor.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

export function openPartnerSheet({ character, onChanged }) {
  openSheet({
    title: character.name,
    description: `${character.relationship} · ${character.role}`,
    content: `<div class="partner-profile">
      ${characterAvatar(character, '2xl')}
      <p class="partner-profile__tagline">“${escapeHTML(character.tagline)}”</p>
      <p class="partner-profile__persona">${escapeHTML(character.persona || '还没有写下人设。')}</p>
    </div>
    <div class="action-list action-list--compact">
      <button class="action-row" type="button" data-edit-character>
        <span class="action-row__icon">${icon('pencil-simple')}</span>
        <span class="action-row__copy"><strong>修改资料</strong><small>头像、名字与人设</small></span>
        <span class="action-row__arrow">${icon('caret-right')}</span>
      </button>
      <button class="action-row" type="button" data-toggle-mute aria-pressed="${character.muted ? 'true' : 'false'}">
        <span class="action-row__icon">${icon(character.muted ? 'bell-slash' : 'bell')}</span>
        <span class="action-row__copy"><strong>免打扰</strong><small>在别处时，不再弹出消息横幅</small></span>
        <span class="action-row__state" data-mute-state>${character.muted ? '已开启' : '关闭'}</span>
      </button>
      <button class="action-row action-row--danger" type="button" data-clear-chat>
        <span class="action-row__icon">${icon('trash-simple')}</span>
        <span class="action-row__copy"><strong>清空这段对话</strong></span>
      </button>
    </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-edit-character]').addEventListener('click', () => {
        openCharacterEditor({
          character: getCharacter(character.id),
          onSaved: () => onChanged?.(),
        });
      });

      sheet.querySelector('[data-toggle-mute]').addEventListener('click', (event) => {
        const button = event.currentTarget;
        const current = getCharacter(character.id);
        const next = !current.muted;
        updateCharacter(character.id, { muted: next });
        button.setAttribute('aria-pressed', String(next));
        button.querySelector('.action-row__icon').innerHTML = icon(
          next ? 'bell-slash' : 'bell',
        );
        button.querySelector('[data-mute-state]').textContent = next ? '已开启' : '关闭';
        toast(next ? '已开启免打扰' : '已关闭免打扰');
      });

      sheet.querySelector('[data-clear-chat]').addEventListener('click', () => {
        openSheet({
          title: '清空这段对话',
          description: `和${character.name}的所有消息都会被删除，无法恢复。`,
          actions: `<div class="button-row">
            <button class="button button--secondary" type="button" data-cancel-clear>取消</button>
            <button class="button button--danger" type="button" data-confirm-clear>清空</button>
          </div>`,
          onMount: (confirmSheet) => {
            confirmSheet.querySelector('[data-cancel-clear]').addEventListener('click', () => {
              closeActiveSheet();
            });
            confirmSheet.querySelector('[data-confirm-clear]').addEventListener('click', () => {
              clearConversation(character.id);
              closeActiveSheet({ immediate: true });
              toast('对话已清空');
              onChanged?.();
            });
          },
        });
      });
    },
  });
}
