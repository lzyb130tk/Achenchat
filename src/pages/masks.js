import { appHeader } from '../components/app-header.js';
import { profileAvatar } from '../components/avatar.js';
import { icon, iconButton } from '../components/icons.js';
import { openMaskEditor } from '../components/mask-editor.js';
import { toast } from '../components/toast.js';
import {
  getActiveMask,
  getMaskConversationCount,
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
        <section class="masks-intro">
          <span class="masks-intro__icon">${icon('mask-happy')}</span>
          <div><h2>换一种身份聊天</h2><p>面具会改变 AI 对你的称呼，也会进入对话设定。</p><span class="masks-intro__note">${icon('mask-happy')}仅影响之后使用该面具的对话</span></div>
        </section>
        <h2 class="masks-section-title">我的面具 · ${masks.length}</h2>
        <div class="mask-list">
          ${masks
            .map(
              (mask) => `<div class="mask-row${mask.id === active.id ? ' is-active' : ''}">
                <button class="mask-row__main" type="button" data-use-mask="${mask.id}">
                  ${profileAvatar(mask, 'lg')}
                  <span class="mask-row__copy">
                    <span class="mask-row__name">${escapeHTML(mask.name)}${mask.id === active.id ? '<span class="mask-row__badge">当前</span>' : ''}</span>
                    <span class="mask-row__meta">${escapeHTML(mask.signature || mask.persona || '还没有写下人设。')}</span>
                    <span class="mask-row__usage">${icon('chat-circle')}在 ${getMaskConversationCount(mask.id)} 段对话中使用</span>
                  </span>
                </button>
                <button class="icon-button icon-button--small" type="button" aria-label="编辑${escapeHTML(mask.name)}" data-edit-mask="${mask.id}">${icon('pencil-simple')}</button>
                <span class="mask-row__chevron">${icon('caret-right')}</span>
              </div>`,
            )
            .join('')}
        </div>
        <button class="masks-create" type="button" data-new-mask>
          <span class="masks-create__icon">${icon('plus')}</span>
          <span><strong>创建新面具</strong><small>为不同故事准备不同身份</small></span>
          ${icon('caret-right')}
        </button>
        <p class="masks-footnote">${icon('info')}切换面具不会修改已发送的消息内容</p>
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
