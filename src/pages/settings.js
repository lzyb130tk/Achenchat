import { appHeader } from '../components/app-header.js';
import { openChoiceSheet } from '../components/choice-sheet.js';
import { icon, uiIcon } from '../components/icons.js';
import { settingsGroup, settingsRow } from '../components/settings-row.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { applyAppearance } from '../services/appearance.js';
import {
  COLOR_MODE_LABELS,
  COLOR_MODE_OPTIONS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  FONT_SIZE_LABELS,
  FONT_SIZE_OPTIONS,
  THEME_PRESETS,
  normalizeHexColor,
  parseColorInput,
  themePreset,
  themePresetSummary,
} from '../services/preferences.js';
import {
  clearAllData,
  exportBackupZip,
  getAppearance,
  getStats,
  getStorageSize,
  hasApiConfig,
  inspectBackupFile,
  restoreBackupFile,
  setAppearance,
} from '../services/store.js';
import { escapeHTML, formatFileSize } from '../services/utils.js';

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
    
    content: `<div class="action-list">
      <button class="action-row" type="button" data-export-backup>
        <span class="action-row__icon">${uiIcon('download', { size: 20 })}</span>
        <span class="action-row__copy"><strong>导出备份</strong></span>
        <span class="action-row__arrow">${uiIcon('chevron-right', { size: 16 })}</span>
      </button>
      <button class="action-row" type="button" data-import-backup>
        <span class="action-row__icon">${uiIcon('upload', { size: 20 })}</span>
        <span class="action-row__copy"><strong>导入备份</strong></span>
        <span class="action-row__arrow">${uiIcon('chevron-right', { size: 16 })}</span>
      </button>
    </div>
    <input type="file" accept=".zip,application/zip,.json,application/json" data-backup-file hidden>`,
    onMount: (sheet) => {
      const fileInput = sheet.querySelector('[data-backup-file]');
      const exportButton = sheet.querySelector('[data-export-backup]');

      exportButton.addEventListener('click', async () => {
        if (exportButton.disabled) return;
        exportButton.disabled = true;
        const label = exportButton.querySelector('small');
        const original = label.textContent;
        label.textContent = '正在打包…';
        try {
          const blob = await exportBackupZip();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const date = new Date().toISOString().slice(0, 10);
          link.href = url;
          link.download = `achat-backup-${date}.zip`;
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          closeActiveSheet();
          toast('备份已导出');
        } catch (error) {
          label.textContent = original;
          exportButton.disabled = false;
          toast(error.message || '导出失败', { tone: 'danger' });
        }
      });

      sheet.querySelector('[data-import-backup]').addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        let manifest;
        try {
          manifest = await inspectBackupFile(file);
        } catch {
          toast('无法读取这个备份文件', { tone: 'danger' });
          return;
        }
        const counts = manifest.counts || {};
        const summary = manifest.legacy
          ? '检测到旧版 JSON 备份，导入时会自动迁移消息。'
          : `ZIP 备份 · ${counts.conversations || 0} 段对话 · ${counts.messages || 0} 条消息 · ${counts.images || 0} 张图片。`;

        openSheet({
          title: '导入备份',
          description: '当前所有数据会被替换，API 密钥会保留。',
          content: `<div class="detail-list">
            <div class="detail-row"><span>备份格式</span><strong>${manifest.legacy ? 'JSON（旧版）' : 'ZIP'}</strong></div>
            <div class="detail-row"><span>对话</span><strong>${counts.conversations || 0} 段</strong></div>
            <div class="detail-row"><span>消息</span><strong>${counts.messages || 0} 条</strong></div>
            <div class="detail-row"><span>图片</span><strong>${counts.images || 0} 张</strong></div>
          </div>
          <p class="sheet-note">${summary}</p>`,
          actions: `<div class="button-row">
            <button class="button button--secondary" type="button" data-cancel-import>取消</button>
            <button class="button button--primary" type="button" data-confirm-import>导入</button>
          </div>`,
          onMount: (confirmSheet) => {
            confirmSheet.querySelector('[data-cancel-import]').addEventListener('click', () => {
              closeActiveSheet();
            });
            confirmSheet.querySelector('[data-confirm-import]').addEventListener('click', async () => {
              const button = confirmSheet.querySelector('[data-confirm-import]');
              button.disabled = true;
              button.textContent = '导入中…';
              try {
                await restoreBackupFile(file);
                applyAppearance(getAppearance());
                closeActiveSheet();
                toast('备份已恢复');
                refresh();
              } catch (error) {
                button.disabled = false;
                button.textContent = '导入';
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
      sheet.querySelector('[data-confirm-clear]').addEventListener('click', async () => {
        await clearAllData();
        applyAppearance(getAppearance());
        closeActiveSheet();
        toast('数据已清空');
        refresh();
      });
    },
  });
}

function openThemeSheet(refresh) {
  const appearance = getAppearance();
  const initialPrimary =
    normalizeHexColor(appearance.primaryColor) || DEFAULT_PRIMARY_COLOR;
  const initialAccent =
    normalizeHexColor(appearance.accentColor) || DEFAULT_ACCENT_COLOR;
  const basePreset = themePreset(appearance.themePreset) || THEME_PRESETS[0];
  let current = {
    preset: basePreset.id,
    primary: initialPrimary,
    accent: initialAccent,
  };

  const presetMarkup = () =>
    THEME_PRESETS.map(
      (preset) => `<button class="theme-preset${preset.id === current.preset ? ' is-selected' : ''}" type="button" data-theme-preset="${preset.id}" aria-pressed="${preset.id === current.preset}">
        <span class="theme-preset__swatches" aria-hidden="true">
          <span class="theme-preset__swatch" style="background:${preset.primary}"></span>
          <span class="theme-preset__swatch" style="background:${preset.accent}"></span>
        </span>
        <span class="theme-preset__copy">
          <strong>${escapeHTML(preset.name)}</strong>
          <small>${escapeHTML(preset.meta)}</small>
        </span>
        <span class="theme-preset__check">${icon('check', 'fill')}</span>
      </button>`,
    ).join('');

  const colorRow = (key, label, hint, value) => `<div class="theme-color-row">
    <div class="theme-color-row__head">
      <span class="theme-color-row__label">${label}</span>
      <span class="theme-color-row__hint">${hint}</span>
    </div>
    <div class="theme-color-row__controls">
      <label class="theme-color-swatch" style="--swatch:${value}" data-swatch="${key}">
        <input type="color" value="${value}" data-color-picker="${key}" aria-label="选择${label}">
      </label>
      <input class="theme-color-input" type="text" value="${value}" spellcheck="false" autocomplete="off" placeholder="#RRGGBB 或 rgb(r, g, b)" data-color-text="${key}" aria-label="${label}十六进制或 RGB">
    </div>
  </div>`;

  const preview = () => {
    applyAppearance({
      ...getAppearance(),
      themePreset: current.preset,
      primaryColor: current.primary,
      accentColor: current.accent,
    });
  };

  const commit = () => {
    setAppearance({
      themePreset: current.preset,
      primaryColor: current.primary,
      accentColor: current.accent,
    });
    applyAppearance(getAppearance());
  };

  openSheet({
    title: '主题颜色',
    description: '预设会一起更换底色、分隔线与主色；也可以只调主色和强调色，应用到整个 App。',
    content: `<div class="theme-section">
        <h3 class="theme-section__title">预设</h3>
        <div class="theme-presets">${presetMarkup()}</div>
      </div>
      <div class="theme-section">
        <h3 class="theme-section__title">自定义</h3>
        ${colorRow('primary', '主色调', '按钮 · 你的消息', current.primary)}
        ${colorRow('accent', '强调色', '发送键 · 高亮与链接', current.accent)}
      </div>
      <div class="theme-preview" aria-hidden="true">
        <div class="theme-preview__row theme-preview__row--user"><span class="theme-preview__bubble">今晚见？</span></div>
        <div class="theme-preview__row"><span class="theme-preview__bubble">好呀，等你。</span></div>
        <div class="theme-preview__footer">
          <span class="theme-preview__dot"></span><span>强调色</span>
          <span class="theme-preview__send">${icon('paper-plane-tilt', 'fill')}</span>
        </div>
      </div>`,
    actions: `<div class="theme-sheet-actions">
      <button class="button button--secondary" type="button" data-theme-reset>恢复默认</button>
      <button class="button button--primary" type="button" data-theme-done>完成</button>
    </div>`,
    onDismiss: () => {
      commit();
      refresh?.();
    },
    onMount: (sheet) => {
      const colorOf = (key) => (key === 'primary' ? current.primary : current.accent);
      const syncPresets = () => {
        sheet.querySelectorAll('[data-theme-preset]').forEach((button) => {
          const selected = button.dataset.themePreset === current.preset;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
      };
      const syncKey = (key, value, { text = true, picker = true } = {}) => {
        if (text) {
          const input = sheet.querySelector(`[data-color-text="${key}"]`);
          if (input) input.value = value;
        }
        if (picker) {
          const input = sheet.querySelector(`[data-color-picker="${key}"]`);
          if (input) input.value = value;
        }
        const swatch = sheet.querySelector(`[data-swatch="${key}"]`);
        if (swatch) swatch.style.setProperty('--swatch', value);
      };
      const syncAll = () => {
        sheet.querySelectorAll('[data-color-picker]').forEach((input) => {
          input.value = colorOf(input.dataset.colorPicker);
        });
        sheet.querySelectorAll('[data-color-text]').forEach((input) => {
          input.value = colorOf(input.dataset.colorText);
        });
        sheet.querySelectorAll('[data-swatch]').forEach((node) => {
          node.style.setProperty('--swatch', colorOf(node.dataset.swatch));
        });
        syncPresets();
      };

      sheet.querySelectorAll('[data-theme-preset]').forEach((button) => {
        button.addEventListener('click', () => {
          const preset = THEME_PRESETS.find(
            (item) => item.id === button.dataset.themePreset,
          );
          if (!preset) return;
          current = {
            preset: preset.id,
            primary: preset.primary,
            accent: preset.accent,
          };
          commit();
          syncAll();
        });
      });

      sheet.querySelectorAll('[data-color-picker]').forEach((input) => {
        input.addEventListener('input', () => {
          const key = input.dataset.colorPicker;
          const hex = normalizeHexColor(input.value);
          if (!hex) return;
          current = { ...current, [key]: hex };
          preview();
          syncKey(key, hex, { picker: false });
          syncPresets();
        });
        input.addEventListener('change', commit);
      });

      sheet.querySelectorAll('[data-color-text]').forEach((input) => {
        input.addEventListener('input', () => {
          const key = input.dataset.colorText;
          const hex = parseColorInput(input.value);
          if (!hex) return;
          current = { ...current, [key]: hex };
          preview();
          syncKey(key, hex, { text: false });
          syncPresets();
        });
        input.addEventListener('blur', () => {
          const key = input.dataset.colorText;
          const hex = parseColorInput(input.value);
          input.value = hex || colorOf(key);
          commit();
        });
      });

      sheet.querySelector('[data-theme-reset]').addEventListener('click', () => {
        current = {
          preset: 'default',
          primary: DEFAULT_PRIMARY_COLOR,
          accent: DEFAULT_ACCENT_COLOR,
        };
        commit();
        syncAll();
      });

      sheet.querySelector('[data-theme-done]').addEventListener('click', () => {
        closeActiveSheet();
      });
    },
  });
}

function glassSummary(appearance) {
  if (appearance.glassEnabled === false) return '关闭';
  const blur = Number.isFinite(Number(appearance.glassBlur))
    ? Math.min(30, Math.max(0, Math.round(Number(appearance.glassBlur))))
    : 18;
  return `开启 · ${blur}px`;
}

function openGlassSheet(refresh) {
  const appearance = getAppearance();
  let enabled = appearance.glassEnabled !== false;
  let blur = Number.isFinite(Number(appearance.glassBlur))
    ? Math.min(30, Math.max(0, Math.round(Number(appearance.glassBlur))))
    : 18;

  const preview = (persist) => {
    const patch = { glassEnabled: enabled, glassBlur: blur };
    if (persist) setAppearance(patch);
    applyAppearance({ ...getAppearance(), ...patch });
  };

  openSheet({
    title: '毛玻璃',
    
    content: `<label class="switch-row">
        <span class="switch-row__copy">
          <strong>开启毛玻璃</strong>
          
        </span>
        <span class="switch">
          <input type="checkbox" data-glass-toggle${enabled ? ' checked' : ''} aria-label="开启毛玻璃">
          <span class="switch__track"></span>
        </span>
      </label>
      <label class="range-row">
        <span class="range-row__top"><span>模糊程度</span><output data-glass-value>${blur}px</output></span>
        <input class="range" type="range" min="0" max="30" step="1" value="${blur}" data-glass-blur${enabled ? '' : ' disabled'}>
      </label>
      <div class="glass-demo" aria-hidden="true">
        <span class="glass-demo__bar">顶栏 / 底栏</span>
        <span class="glass-demo__copy">半透明 + 模糊</span>
      </div>`,
    actions: `<button class="button button--primary" type="button" data-glass-done>完成</button>`,
    onDismiss: () => {
      setAppearance({ glassEnabled: enabled, glassBlur: blur });
      applyAppearance(getAppearance());
      refresh?.();
    },
    onMount: (sheet) => {
      const toggle = sheet.querySelector('[data-glass-toggle]');
      const range = sheet.querySelector('[data-glass-blur]');
      const output = sheet.querySelector('[data-glass-value]');

      toggle.addEventListener('change', () => {
        enabled = toggle.checked;
        range.disabled = !enabled;
        preview(true);
      });

      range.addEventListener('input', () => {
        blur = Number(range.value);
        output.textContent = `${blur}px`;
        preview(false);
      });
      range.addEventListener('change', () => preview(true));

      sheet.querySelector('[data-glass-done]').addEventListener('click', () => {
        closeActiveSheet();
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
            settingsRow({
              iconName: 'palette',
              label: '主题颜色',
              value: themePresetSummary(appearance),
              action: 'theme',
            }),
            settingsRow({
              iconName: 'drop',
              label: '毛玻璃',
              value: glassSummary(appearance),
              action: 'glass',
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
    if (action === 'theme') openThemeSheet(refresh);
    if (action === 'glass') openGlassSheet(refresh);
  });

  return { element: screen };
}
