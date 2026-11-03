import { appHeader } from '../components/app-header.js';
import { profileAvatar } from '../components/avatar.js';
import { iconButton, uiIcon } from '../components/icons.js';
import { openMaskEditor } from '../components/mask-editor.js';
import { toast } from '../components/toast.js';
import {
  getActiveMask,
  getMasks,
  setActiveMask,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

export function renderMasks({ refresh }) {
  const screen = document.createElement('section');
  screen.className = 'screen screen--masks';
  const masks = getMasks();
  const active = getActiveMask();

  screen.innerHTML = `
    ${appHeader({
      title: '面具',
      backTo: '#/me',
      action: iconButton({
        name: 'plus',
        label: '新建面具',
        action: 'data-new-mask',
      }),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--masks">
        <div class="mask-list">
          ${masks
            .map(
              (mask) => `<div class="mask-row${mask.id === active.id ? ' is-active' : ''}">
                <button class="mask-row__main" type="button" data-use-mask="${mask.id}">
                  ${profileAvatar(mask, 'lg')}
                  <span class="mask-row__copy">
                    <span class="mask-row__name">${escapeHTML(mask.name)}${mask.id === active.id ? '<span class="mask-row__badge">当前</span>' : ''}</span>
                    <span class="mask-row__meta">${escapeHTML(mask.signature || mask.persona || '还没有写下人设。')}</span>
                  </span>
                </button>
                <button class="icon-button icon-button--small" type="button" aria-label="编辑${escapeHTML(mask.name)}" data-edit-mask="${mask.id}">${uiIcon('pencil', { size: 15 })}</button>
              </div>`,
            )
            .join('')}
        </div>
        <button class="masks-create" type="button" data-new-mask>
          ${uiIcon('plus', { size: 15 })}
          <span>新建面具</span>
        </button>
      </div>
    </main>`;

  screen.querySelectorAll('[data-use-mask]').forEach((button) => {
    button.addEventListener('click', () => {
      const mask = masks.find((item) => item.id === button.dataset.useMask);
      if (!mask || mask.id === active.id) return;
      setActiveMask(mask.id);
      toast(`已切换为${mask.name}`);
      refresh();
    });
  });

  screen.querySelectorAll('[data-edit-mask]').forEach((button) => {
    button.addEventListener('click', () => {
      const mask = masks.find((item) => item.id === button.dataset.editMask);
      if (!mask) return;
      openMaskEditor({ mask, onSaved: () => refresh() });
    });
  });

  screen.querySelectorAll('[data-new-mask]').forEach((button) => button.addEventListener('click', () => {
    window.location.hash = '#/masks/new';
  }));

  return { element: screen };
}
