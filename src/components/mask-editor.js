import {
  addMask,
  deleteMask,
  getMasks,
  updateMask,
} from '../services/store.js';
import { escapeHTML, firstNameMark } from '../services/utils.js';
import { avatarField, setupAvatarField } from './avatar-field.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

export function openMaskEditor({ mask = null, onSaved = null } = {}) {
  const isEdit = Boolean(mask);
  const mark = firstNameMark(mask?.name || '你');

  openSheet({
    title: isEdit ? '编辑面具' : '新建面具',
    description: '换一个身份，换一种说话的方式。',
    content: `<div class="mask-editor">
      ${avatarField({ mark, name: mask?.name || '你', tone: 'ink' })}
      <label class="field">
        <span class="field__label">名字</span>
        <span class="field__control">
          <input class="field__input" name="maskName" maxlength="16" autocomplete="off" value="${escapeHTML(mask?.name || '')}" placeholder="这个面具叫什么">
        </span>
      </label>
      <label class="field">
        <span class="field__label">签名</span>
        <span class="field__control">
          <input class="field__input" name="maskSignature" maxlength="30" autocomplete="off" value="${escapeHTML(mask?.signature || '')}" placeholder="一句话介绍自己">
        </span>
      </label>
      <label class="field">
        <span class="field__label">人设</span>
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea" name="maskPersona" rows="5" placeholder="你希望 AI 把你当作怎样的人？可以写性格、身份和相处方式。">${escapeHTML(mask?.persona || '')}</textarea>
        </span>
      </label>
      ${isEdit && getMasks().length > 1 ? `<button class="text-button text-button--danger" type="button" data-delete-mask>${icon('trash-simple')}删除这个面具</button>` : ''}
    </div>`,
    actions: `<button class="button button--primary" type="button" data-save-mask>保存</button>`,
    onMount: (sheet) => {
      const nameInput = sheet.querySelector('[name="maskName"]');
      const signatureInput = sheet.querySelector('[name="maskSignature"]');
      const personaInput = sheet.querySelector('[name="maskPersona"]');
      const field = setupAvatarField(sheet, {
        initial: mask?.avatar || '',
        mark,
        name: mask?.name || '你',
        tone: 'ink',
      });

      sheet.querySelector('[data-save-mask]').addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
          toast('给这个面具一个名字', { tone: 'danger' });
          nameInput.focus();
          return;
        }
        const payload = {
          name,
          signature: signatureInput.value.trim(),
          persona: personaInput.value.trim(),
          avatar: field.getValue(),
        };
        const saved = isEdit ? updateMask(mask.id, payload) : addMask(payload);
        if (!saved) {
          toast('没有保存成功，请再试一次', { tone: 'danger' });
          return;
        }
        closeActiveSheet();
        toast(isEdit ? '面具已更新' : '新面具已戴上');
        onSaved?.(saved);
      });

      sheet.querySelector('[data-delete-mask]')?.addEventListener('click', () => {
        openSheet({
          title: '删除面具',
          description: `“${mask.name}”会被删除，之后可以用其他面具继续聊天。`,
          actions: `<div class="button-row">
            <button class="button button--secondary" type="button" data-cancel-mask-delete>取消</button>
            <button class="button button--danger" type="button" data-confirm-mask-delete>删除</button>
          </div>`,
          onMount: (confirmSheet) => {
            confirmSheet
              .querySelector('[data-cancel-mask-delete]')
              .addEventListener('click', () => closeActiveSheet());
            confirmSheet
              .querySelector('[data-confirm-mask-delete]')
              .addEventListener('click', () => {
                if (!deleteMask(mask.id)) {
                  toast('至少要留下一个面具', { tone: 'danger' });
                  return;
                }
                closeActiveSheet({ immediate: true });
                toast('面具已删除');
                onSaved?.(null);
              });
          },
        });
      });
    },
  });
}
