import {
  addTag,
  deleteTag,
  getAllCharacters,
  getTags,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';

export function openTagManager({ onDismiss } = {}) {
  openSheet({
    title: '标签',
    description: '给伙伴分分类，也可以只留下重要的几个。',
    content: `<div class="tag-manager">
      <div class="tag-manager__add">
        <span class="field__control">
          <input class="field__input" name="newTag" maxlength="12" autocomplete="off" placeholder="新标签，例如「工作搭子」" aria-label="新标签名称">
        </span>
        <button class="small-button small-button--solid" type="button" data-add-tag>新建</button>
      </div>
      <div class="tag-manager__list" data-tag-list></div>
    </div>`,
    onDismiss,
    onMount: (sheet) => {
      const input = sheet.querySelector('[name="newTag"]');
      const list = sheet.querySelector('[data-tag-list]');

      const render = () => {
        const characters = getAllCharacters();
        const tags = getTags();
        list.innerHTML = tags.length
          ? tags
              .map((tag) => {
                const count = characters.filter(
                  (character) => character.tagId === tag.id,
                ).length;
                return `<div class="tag-manager__row">
                  <span class="tag-manager__icon">${icon('tag')}</span>
                  <span class="tag-manager__copy">
                    <strong>${escapeHTML(tag.name)}</strong>
                    <small>${count} 位伙伴</small>
                  </span>
                  <button class="icon-button icon-button--small" type="button" aria-label="删除${escapeHTML(tag.name)}" data-delete-tag="${tag.id}">${icon('trash-simple')}</button>
                </div>`;
              })
              .join('')
          : `<p class="settings-empty__text">还没有标签。新建一个，就能在联系人里分组。</p>`;

        list.querySelectorAll('[data-delete-tag]').forEach((button) => {
          button.addEventListener('click', () => {
            deleteTag(button.dataset.deleteTag);
            render();
            toast('标签已删除');
          });
        });
      };

      const create = () => {
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }
        const tag = addTag(name);
        if (!tag) {
          toast('这个标签已经存在', { tone: 'danger' });
          return;
        }
        input.value = '';
        render();
        toast('标签已创建');
        input.focus();
      };

      sheet.querySelector('[data-add-tag]').addEventListener('click', create);
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        create();
      });

      render();
    },
  });
}
