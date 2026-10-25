import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { addTag, deleteTag, getAllCharacters, getTags, updateTag } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

export function renderTags() {
  const screen = document.createElement('section');
  screen.className = 'screen screen--tags';
  screen.innerHTML = `
    ${appHeader({ title: '标签与分组', backTo: '#/contacts', action: '<button class="tags-manage" type="button" data-toggle-manage>管理</button>' })}
    <main class="page-scroll">
      <div class="page-content page-content--tags">
        <p class="tags-intro">给伙伴分类，也可以只留下重要的几个。</p>
        <div class="tags-create">
          <span class="tags-create__icon">${icon('tag')}</span>
          <input type="text" maxlength="12" autocomplete="off" placeholder="新标签，例如「工作搭子」" aria-label="新标签名称" data-tag-name>
          <button type="button" data-create-tag>新建</button>
        </div>
        <h2 class="tags-heading" data-tags-heading></h2>
        <div class="tags-list" data-tags-list></div>
        <p class="tags-footnote">删除标签不会删除伙伴</p>
      </div>
    </main>`;

  const input = screen.querySelector('[data-tag-name]');
  const list = screen.querySelector('[data-tags-list]');
  const manageButton = screen.querySelector('[data-toggle-manage]');
  let managing = false;

  const paint = () => {
    const tags = getTags();
    const characters = getAllCharacters();
    screen.querySelector('[data-tags-heading]').textContent = `我的标签 · ${tags.length}`;
    manageButton.textContent = managing ? '完成' : '管理';
    list.innerHTML = tags.length
      ? tags.map((tag) => {
          const count = characters.filter((item) => item.tagId === tag.id).length;
          const isLover = tag.id === 'lover' || tag.name === '恋人';
          const isFriend = tag.id === 'friend' || tag.name === '朋友';
          return `<button class="tags-row" type="button" data-tag-id="${escapeHTML(tag.id)}">
            <span class="tags-row__icon ${isLover ? 'is-lover' : isFriend ? 'is-friend' : ''}">${icon(isLover ? 'heart' : isFriend ? 'users' : 'tag')}</span>
            <span class="tags-row__copy"><strong>${escapeHTML(tag.name)}</strong><small>${count} 位伙伴</small></span>
            ${icon(managing ? 'pencil-simple' : 'caret-right')}
          </button>`;
        }).join('')
      : '<p class="tags-empty">还没有标签，新建一个给伙伴分组吧。</p>';
  };

  const create = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (!addTag(name)) { toast('这个标签已经存在', { tone: 'danger' }); return; }
    input.value = '';
    paint();
    toast('标签已创建');
  };

  const edit = (tag) => {
    openSheet({
      title: '管理标签',
      content: `<label class="field"><span class="field__label">标签名称</span><span class="field__control"><input class="field__input" maxlength="12" value="${escapeHTML(tag.name)}" data-edit-tag-name></span></label>
        <button class="text-button text-button--danger" type="button" data-delete-tag>${icon('trash-simple')}删除标签</button>`,
      actions: '<button class="button button--primary" type="button" data-save-tag>保存</button>',
      onMount: (sheet) => {
        const nameInput = sheet.querySelector('[data-edit-tag-name]');
        sheet.querySelector('[data-save-tag]').addEventListener('click', () => {
          if (!updateTag(tag.id, nameInput.value)) {
            toast('请输入不重复的标签名称', { tone: 'danger' });
            return;
          }
          closeActiveSheet();
          paint();
          toast('标签已更新');
        });
        sheet.querySelector('[data-delete-tag]').addEventListener('click', () => {
          openSheet({
            title: '删除标签？',
            description: `删除“${tag.name}”后，伙伴会变为未分组，伙伴和聊天不会被删除。`,
            actions: '<div class="button-row"><button class="button button--secondary" type="button" data-cancel-delete>取消</button><button class="button button--danger" type="button" data-confirm-delete>删除</button></div>',
            onMount: (confirm) => {
              confirm.querySelector('[data-cancel-delete]').addEventListener('click', closeActiveSheet);
              confirm.querySelector('[data-confirm-delete]').addEventListener('click', () => {
                deleteTag(tag.id);
                closeActiveSheet({ immediate: true });
                paint();
                toast('标签已删除');
              });
            },
          });
        });
      },
    });
  };

  screen.querySelector('[data-create-tag]').addEventListener('click', create);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    create();
  });
  manageButton.addEventListener('click', () => { managing = !managing; paint(); });
  list.addEventListener('click', (event) => {
    const row = event.target.closest('[data-tag-id]');
    if (!row) return;
    const tag = getTags().find((item) => item.id === row.dataset.tagId);
    if (!tag) return;
    if (managing) edit(tag);
    else window.location.hash = `#/contacts?tag=${encodeURIComponent(tag.id)}`;
  });
  paint();
  return { element: screen };
}
