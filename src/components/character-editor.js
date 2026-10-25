import {
  createCharacter,
  getTags,
  updateCharacter,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';
import { avatarField, setupAvatarField } from './avatar-field.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

export function openCharacterEditor({ character = null, onSaved = null } = {}) {
  const isEdit = Boolean(character);
  const tags = getTags();
  const options = [
    `<option value="">未分组</option>`,
    ...tags.map(
      (tag) =>
        `<option value="${escapeHTML(tag.id)}"${character?.tagId === tag.id ? ' selected' : ''}>${escapeHTML(tag.name)}</option>`,
    ),
  ].join('');

  openSheet({
    title: isEdit ? '编辑伙伴' : '新建伙伴',
    description: isEdit ? '改动会立刻出现在对话里。' : '先认识一下，再慢慢聊。',
    content: `<div class="character-editor">
      ${avatarField({
        mark: character?.mark || '新',
        name: character?.name || '新伙伴',
        tone: character?.tone || 'apricot',
      })}
      <label class="field">
        <span class="field__label">名字</span>
        <span class="field__control">
          <input class="field__input" name="name" maxlength="20" autocomplete="off" value="${escapeHTML(character?.name || '')}" placeholder="怎么称呼">
        </span>
      </label>
      <label class="field">
        <span class="field__label">标签</span>
        <span class="field__control field__control--select">
          <select class="field__input field__select" name="tagId">${options}</select>
        </span>
      </label>
      <label class="field">
        <span class="field__label">人设</span>
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea" name="persona" rows="6" placeholder="性格、说话方式、你们的相处方式，写多少都可以。">${escapeHTML(character?.persona || '')}</textarea>
        </span>
      </label>
      <label class="field">
        <span class="field__label">签名</span>
        <span class="field__control">
          <input class="field__input" name="tagline" maxlength="24" autocomplete="off" value="${escapeHTML(character?.tagline || '')}" placeholder="一句话介绍，会显示在对话里">
        </span>
      </label>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-save-character>${isEdit ? '保存' : '开始聊天'}</button>`,
    onMount: (sheet) => {
      const nameInput = sheet.querySelector('[name="name"]');
      const tagSelect = sheet.querySelector('[name="tagId"]');
      const personaInput = sheet.querySelector('[name="persona"]');
      const taglineInput = sheet.querySelector('[name="tagline"]');
      const field = setupAvatarField(sheet, {
        initial: character?.avatar || '',
        mark: character?.mark || '新',
        name: character?.name || '新伙伴',
        tone: character?.tone || 'apricot',
      });

      sheet.querySelector('[data-save-character]').addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
          toast('给这位伙伴一个名字', { tone: 'danger' });
          nameInput.focus();
          return;
        }
        const payload = {
          name,
          persona: personaInput.value.trim(),
          tagline: taglineInput.value.trim().slice(0, 24),
          avatar: field.getValue(),
          tagId: tagSelect.value,
        };
        const saved = isEdit
          ? updateCharacter(character.id, payload)
          : createCharacter(payload);
        if (!saved) {
          toast('没有保存成功，请再试一次', { tone: 'danger' });
          return;
        }
        closeActiveSheet();
        toast(isEdit ? '伙伴资料已更新' : '新伙伴已经在等你了');
        onSaved?.(saved, { created: !isEdit });
      });
    },
  });
}
