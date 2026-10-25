import { appHeader } from '../components/app-header.js';
import { openChoiceSheet } from '../components/choice-sheet.js';
import { icon } from '../components/icons.js';
import { settingsGroup, settingsRow } from '../components/settings-row.js';
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
  clearAllData,
  createBackup,
  getAppearance,
  getStats,
  getStorageSize,
  hasApiConfig,
  restoreBackup,
  setAppearance,
} from '../services/store.js';
import { formatFileSize } from '../services/utils.js';

function openStorageSheet() {
  const stats = getStats();
  openSheet({
    title: '存储空间',
    content: `<div class="storage-figure">
      <strong>${formatFileSize(getStorageSize())}</strong>
      <span>当前占用</span>
    </div>
    <div class="detail-list">
      <div class="detail-row"><span>对话</span><strong>${stats.conversationCount} 段 · ${stats.messageCount} 条</strong></div>
      <div class="detail-row"><span>伙伴</span><strong>${stats.partnerCount} 位</strong></div>
      <div class="detail-row"><span>存储方式</span><strong>IndexedDB · 本机</strong></div>
    </div>
    <p class="sheet-note">聊天记录保存在本机；发送的内容会交给你配置的 AI 服务处理。</p>`,
  });
}

function openAboutSheet() {
  openSheet({
    title: '关于 Achat',
    content: `<div class="about-card">
      <span class="about-card__mark" aria-hidden="true">a</span>
      <h3>Achat</h3>
      <p>和喜欢的人，慢慢聊天。</p>
      <span class="about-card__version">版本 1.0.0</span>
    </div>
    <div class="detail-list">
      <div class="detail-row"><span>数据</span><strong>仅保存在本机</strong></div>
      <div class="detail-row"><span>图标</span><strong>Phosphor Icons</strong></div>
    </div>`,
  });
}

function openBackupSheet(refresh) {
  openSheet({
    title: '数据备份与导入',
    description: '备份包含对话、面具、钱包与偏好，不包含 API 密钥。',
    content: `<div class="action-list">
      <button class="action-row" type="button" data-export-backup>
        <span class="action-row__icon">${icon('download-simple')}</span>
        <span class="action-row__copy"><strong>导出备份</strong><small>保存为 JSON 文件</small></span>
        <span class="action-row__arrow">${icon('caret-right')}</span>
      </button>
      <button class="action-row" type="button" data-import-backup>
        <span class="action-row__icon">${icon('upload-simple')}</span>
        <span class="action-row__copy"><strong>导入备份</strong><small>用备份替换当前数据</small></span>
        <span class="action-row__arrow">${icon('caret-right')}</span>
      </button>
    </div>
    <input type="file" accept="application/json,.json" data-backup-file hidden>`,
    onMount: (sheet) => {
      const fileInput = sheet.querySelector('[data-backup-file]');

      sheet.querySelector('[data-export-backup]').addEventListener('click', () => {
        const blob = new Blob([createBackup()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `achat-backup-${date}.json`;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        closeActiveSheet();
        toast('备份已导出');
      });

      sheet.querySelector('[data-import-backup]').addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        let raw = '';
        try {
          raw = await file.text();
          JSON.parse(raw);
        } catch {
          toast('无法读取这个备份文件', { tone: 'danger' });
          return;
        }

        openSheet({
          title: '导入备份',
          description: '当前所有数据会被替换，API 密钥会保留。',
          actions: `<div class="button-row">
            <button class="button button--secondary" type="button" data-cancel-import>取消</button>
            <button class="button button--primary" type="button" data-confirm-import>导入</button>
          </div>`,
          onMount: (confirmSheet) => {
            confirmSheet.querySelector('[data-cancel-import]').addEventListener('click', () => {
              closeActiveSheet();
            });
            confirmSheet.querySelector('[data-confirm-import]').addEventListener('click', () => {
              try {
                restoreBackup(raw);
                applyAppearance(getAppearance());
                closeActiveSheet();
                toast('备份已恢复');
                refresh();
              } catch (error) {
                toast(error.message || '导入失败', { tone: 'danger' });
              }
            });
          },
        });
      });
    },
  });
}

function openClearSheet(refresh) {
  openSheet({
    title: '清空数据',
    description: '所有对话、面具、钱包余额与本机 API 密钥都会被删除，且无法恢复。',
    actions: `<div class="button-row">
      <button class="button button--secondary" type="button" data-cancel-clear>取消</button>
      <button class="button button--danger" type="button" data-confirm-clear>清空</button>
    </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-cancel-clear]').addEventListener('click', closeActiveSheet);
      sheet.querySelector('[data-confirm-clear]').addEventListener('click', () => {
        clearAllData();
        applyAppearance(getAppearance());
        closeActiveSheet();
        toast('数据已清空');
        refresh();
      });
    },
  });
}

export function renderSettings({ refresh }) {
  const appearance = getAppearance();
  const apiReady = hasApiConfig();
  const size = formatFileSize(getStorageSize());
  const screen = document.createElement('section');
  screen.className = 'screen screen--settings';

  screen.innerHTML = `
    ${appHeader({ title: '设置', backTo: '#/me' })}
    <main class="page-scroll">
      <div class="page-content page-content--settings">
        ${settingsGroup({
          label: '通用',
          rows: [
            settingsRow({
              iconName: 'plugs',
              label: 'API 配置',
              value: apiReady ? '已保存' : '待配置',
              status: apiReady ? 'positive' : 'idle',
              action: 'api',
            }),
            settingsRow({
              iconName: 'text-aa',
              label: '字体大小',
              value: FONT_SIZE_LABELS[appearance.fontSize],
              action: 'font-size',
            }),
            settingsRow({
              iconName: 'monitor',
              label: '显示模式',
              value: COLOR_MODE_LABELS[appearance.colorMode],
              action: 'color-mode',
            }),
          ].join(''),
        })}
        ${settingsGroup({
          label: '数据',
          rows: [
            settingsRow({
              iconName: 'hard-drive',
              label: '存储空间',
              value: size,
              action: 'storage',
            }),
            settingsRow({
              iconName: 'cloud-arrow-up',
              label: '数据备份与导入',
              action: 'backup',
            }),
            settingsRow({
              iconName: 'trash-simple',
              label: '清空数据',
              action: 'clear',
              tone: 'danger',
            }),
          ].join(''),
          extra: `<p class="settings-privacy-note">${icon('info')}聊天记录保存在本机，回复由你配置的 AI 服务处理</p>`,
        })}
        ${settingsGroup({
          label: '关于',
          rows: [
            settingsRow({
              iconName: 'info',
              label: '关于 Achat',
              value: '1.0.0',
              action: 'about',
            }),
          ].join(''),
        })}
      </div>
    </main>`;

  screen.addEventListener('click', (event) => {
    const row = event.target.closest('[data-setting-action]');
    if (!row) return;
    const action = row.dataset.settingAction;

    if (action === 'api') {
      window.location.hash = '#/settings/api';
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
    }

    if (action === 'storage') openStorageSheet();
    if (action === 'backup') openBackupSheet(refresh);
    if (action === 'clear') openClearSheet(refresh);
    if (action === 'about') openAboutSheet();
  });

  return { element: screen };
}
