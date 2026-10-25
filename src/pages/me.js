import { appHeader } from '../components/app-header.js';
import { avatar } from '../components/avatar.js';
import { bottomNav } from '../components/bottom-nav.js';
import { openChoiceSheet } from '../components/choice-sheet.js';
import { icon, iconButton } from '../components/icons.js';
import { settingsRow } from '../components/settings-row.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { applyAppearance } from '../services/appearance.js';
import {
  COLOR_MODE_LABELS,
  COLOR_MODE_OPTIONS,
  FONT_SIZE_LABELS,
  FONT_SIZE_OPTIONS,
} from '../services/preferences.js';
import {
  getAppearance,
  getProfile,
  getStats,
  hasApiConfig,
  setAppearance,
  updateProfile,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function openProfileEditor(refresh) {
  const profile = getProfile();
  openSheet({
    title: '编辑资料',
    description: '只保存在这台设备。',
    content: `<div class="profile-editor">
      <label class="field">
        <span class="field__label">名字</span>
        <span class="field__control">
          <input class="field__input" name="name" maxlength="12" value="${escapeHTML(profile.name)}" autocomplete="off">
        </span>
      </label>
      <label class="field">
        <span class="field__label">签名</span>
        <span class="field__control">
          <input class="field__input" name="signature" maxlength="24" value="${escapeHTML(profile.signature || '')}" autocomplete="off">
        </span>
      </label>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-save-profile>保存</button>`,
    onMount: (sheet) => {
      const nameInput = sheet.querySelector('[name="name"]');
      sheet.querySelector('[data-save-profile]').addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
          toast('名字不能为空', { tone: 'danger' });
          nameInput.focus();
          return;
        }
        updateProfile({
          name,
          signature: sheet.querySelector('[name="signature"]').value.trim(),
        });
        closeActiveSheet();
        toast('资料已更新');
        refresh();
      });
    },
  });
}

export function renderMe({ refresh }) {
  const profile = getProfile();
  const stats = getStats();
  const appearance = getAppearance();
  const apiReady = hasApiConfig();
  const mark = Array.from(profile.name || '你').slice(-1)[0];

  const screen = document.createElement('section');
  screen.className = 'screen';
  screen.innerHTML = `
    ${appHeader({
      title: '我',
      action: iconButton({ name: 'gear-six', label: '设置', href: '#/settings' }),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--me">
        <section class="profile-card">
          <span class="profile-card__aura" aria-hidden="true"></span>
          <button class="profile-card__edit" type="button" data-action="edit-profile">
            ${icon('pencil-simple')}<span>编辑</span>
          </button>
          ${avatar({ mark, tone: 'ink', size: '2xl', label: profile.name })}
          <h2>${escapeHTML(profile.name)}</h2>
          ${profile.signature ? `<p>${escapeHTML(profile.signature)}</p>` : ''}
          <div class="profile-stats">
            <div><strong>${stats.partnerCount}</strong><span>位伙伴</span></div>
            <div><strong>${stats.conversationCount}</strong><span>段对话</span></div>
            <div><strong>${stats.days}</strong><span>天陪伴</span></div>
          </div>
        </section>
        <section class="preferences-block">
          <h2 class="settings-group__label">偏好</h2>
          <div class="settings-group__card">
            ${settingsRow({
              iconName: 'plugs',
              label: 'API 连接',
              value: apiReady ? '已保存' : '待配置',
              status: apiReady ? 'positive' : 'idle',
              action: 'api',
            })}
            ${settingsRow({
              iconName: 'monitor',
              label: '显示模式',
              value: COLOR_MODE_LABELS[appearance.colorMode],
              action: 'color-mode',
            })}
            ${settingsRow({
              iconName: 'text-aa',
              label: '字体大小',
              value: FONT_SIZE_LABELS[appearance.fontSize],
              action: 'font-size',
            })}
          </div>
        </section>
      </div>
    </main>
    ${bottomNav('me')}`;

  screen.querySelector('[data-action="edit-profile"]').addEventListener('click', () => {
    openProfileEditor(refresh);
  });

  screen.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-setting-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.settingAction;

    if (action === 'api') {
      window.location.hash = '#/settings/api';
      return;
    }

    if (action === 'color-mode') {
      openChoiceSheet({
        title: '显示模式',
        options: COLOR_MODE_OPTIONS,
        current: appearance.colorMode,
        onChoose: (value) => {
          setAppearance({ colorMode: value });
          applyAppearance(getAppearance());
          refresh();
        },
      });
      return;
    }

    if (action === 'font-size') {
      openChoiceSheet({
        title: '字体大小',
        options: FONT_SIZE_OPTIONS,
        current: appearance.fontSize,
        onChoose: (value) => {
          setAppearance({ fontSize: value });
          applyAppearance(getAppearance());
          refresh();
        },
      });
    }
  });

  return { element: screen };
}
