import { CHAT_BACKGROUNDS } from '../data/chat-options.js';
import { readImageFile } from '../services/image.js';
import {
  addBubblePreset,
  deleteBubblePreset,
  getBubblePresets,
  getStickerPacks,
  updateBubblePreset,
  updateChatStyle,
  updateStickerPack,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';
import { icon } from './icons.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';

const BACKGROUND_PREVIEWS = {
  default: '#f4efe8',
  warm: 'linear-gradient(150deg, #f7e6cd, #efd0ad)',
  night: 'linear-gradient(150deg, #33302d, #1d1b19)',
  dawn: 'linear-gradient(150deg, #e8eeeb, #cfdcd7)',
};

export function styleBubble(element, bubbleCss) {
  if (!element) return;
  element.style.cssText = bubbleCss || '';
}

export function applyChatStyle(screen, style) {
  screen.style.setProperty('--chat-avatar-size', `${style.avatarSize}px`);
  screen.style.setProperty('--chat-avatar-radius', `${style.avatarRadius}%`);
  screen.dataset.chatBackground = style.background || 'default';
  screen.classList.toggle('is-hiding-user-avatar', !style.showUserAvatar);

  const scroller = screen.querySelector('.chat-scroll');
  if (scroller) {
    if (style.backgroundImage) {
      scroller.style.backgroundImage = `linear-gradient(rgba(244, 239, 232, 0.2), rgba(244, 239, 232, 0.2)), url(${JSON.stringify(style.backgroundImage)})`;
      scroller.dataset.hasImage = 'true';
    } else {
      scroller.style.backgroundImage = '';
      delete scroller.dataset.hasImage;
    }
  }

  screen.querySelectorAll('[data-bubble-text]').forEach((bubble) => {
    styleBubble(bubble, style.bubbleCss);
  });
}

function backgroundMarkup(style) {
  return `
    <div class="background-grid">
      ${CHAT_BACKGROUNDS.map(
        (background) => `<button class="background-swatch${style.background === background.id && !style.backgroundImage ? ' is-selected' : ''}" type="button" data-background="${background.id}">
          <span class="background-swatch__color" style="background:${BACKGROUND_PREVIEWS[background.id]}"></span>
          <span class="background-swatch__name">${escapeHTML(background.name)}</span>
        </button>`,
      ).join('')}
      <button class="background-swatch background-swatch--custom${style.backgroundImage ? ' is-selected' : ''}" type="button" data-background-upload>
        <span class="background-swatch__color" data-background-preview${style.backgroundImage ? ` style="background-image:url(&quot;${escapeHTML(style.backgroundImage)}&quot;)"` : ''}>${style.backgroundImage ? '' : icon('image')}</span>
        <span class="background-swatch__name">我的图片</span>
      </button>
    </div>
    <button class="text-button${style.backgroundImage ? '' : ' is-hidden'}" type="button" data-background-clear>移除背景图片</button>
    <input type="file" accept="image/*" data-background-file hidden>`;
}

function presetListMarkup(style) {
  return getBubblePresets()
    .map(
      (preset) => `<div class="preset-row${style.presetId === preset.id ? ' is-active' : ''}" data-preset-row="${preset.id}">
        <button class="preset-row__apply" type="button" data-apply-preset="${preset.id}">
          <span class="preset-row__swatch" data-preset-swatch="${preset.id}"></span>
          <span class="preset-row__name">${escapeHTML(preset.name)}</span>
          ${style.presetId === preset.id ? `<span class="preset-row__current">${icon('check')}</span>` : ''}
        </button>
        <button class="preset-row__action" type="button" aria-label="编辑预设" data-edit-preset="${preset.id}">${icon('pencil-simple')}</button>
        <button class="preset-row__action" type="button" aria-label="删除预设" data-delete-preset="${preset.id}">${icon('trash-simple')}</button>
      </div>`,
    )
    .join('');
}

function stickerListMarkup() {
  const packs = getStickerPacks();
  if (!packs.length) {
    return `<div class="settings-empty">
      <span class="settings-empty__icon">${icon('sticker')}</span>
      <p>还没有表情包。上传图片链接后，AI 偶尔会用它们回应。</p>
      <button class="button button--secondary settings-empty__button" type="button" data-open-stickers>去添加表情包</button>
    </div>`;
  }

  return `<div class="switch-list">
    ${packs
      .map(
        (pack) => `<div class="switch-list__row">
          <span class="switch-list__preview">
            ${pack.urls
              .slice(0, 3)
              .map((url) => `<img src="${escapeHTML(url)}" alt="" loading="lazy">`)
              .join('')}
          </span>
          <span class="switch-list__copy">
            <strong>${escapeHTML(pack.name)}</strong>
            <small>${pack.urls.length} 张</small>
          </span>
          <label class="switch">
            <input type="checkbox" data-sticker-pack="${pack.id}"${pack.enabled ? ' checked' : ''} aria-label="启用${escapeHTML(pack.name)}">
            <span class="switch__track"></span>
          </label>
        </div>`,
      )
      .join('')}
  </div>
  <button class="text-button" type="button" data-open-stickers>管理表情包</button>`;
}

export function openChatSettings({ character, style, onStyleChange }) {
  let current = { ...style };
  let editingPresetId = null;

  const generalMarkup = () => `<section class="settings-block">
      <div class="settings-block__head">
        <h3>气泡</h3>
        <span class="settings-block__hint">自定义 CSS</span>
      </div>
      <div class="bubble-preview"><span class="bubble-preview__bubble" data-bubble-preview>今晚见。</span></div>
      <label class="field">
        <span class="field__label">样式</span>
        <span class="field__control field__control--area">
          <textarea class="field__input field__textarea field__textarea--code" rows="3" spellcheck="false" data-bubble-css placeholder="background:#fdf5e9;color:#3a2b21;border-radius:18px;">${escapeHTML(current.bubbleCss)}</textarea>
        </span>
      </label>
      <div class="inline-buttons">
        <button class="small-button small-button--solid" type="button" data-apply-bubble>应用</button>
        <button class="small-button" type="button" data-reset-bubble>恢复默认</button>
      </div>
      <div class="subsection-head">
        <h4>预设</h4>
        <button class="text-button" type="button" data-add-preset>新增</button>
      </div>
      <div class="preset-list" data-preset-list>${presetListMarkup(current)}</div>
      <div class="preset-form" data-preset-form hidden>
        <label class="field">
          <span class="field__label">预设名称</span>
          <span class="field__control">
            <input class="field__input" name="presetName" maxlength="12" autocomplete="off" placeholder="给这个样式起个名字">
          </span>
        </label>
        <label class="field">
          <span class="field__label">CSS</span>
          <span class="field__control field__control--area">
            <textarea class="field__input field__textarea field__textarea--code" name="presetCss" rows="3" spellcheck="false"></textarea>
          </span>
        </label>
        <div class="inline-buttons">
          <button class="small-button small-button--solid" type="button" data-save-preset>保存</button>
          <button class="small-button" type="button" data-cancel-preset>取消</button>
        </div>
      </div>
    </section>
    <section class="settings-block">
      <div class="settings-block__head"><h3>聊天背景</h3></div>
      ${backgroundMarkup(current)}
    </section>
    <section class="settings-block">
      <div class="settings-block__head"><h3>头像</h3></div>
      <label class="range-row">
        <span class="range-row__top"><span>头像大小</span><output data-size-output>${current.avatarSize}px</output></span>
        <input class="range" type="range" min="20" max="48" step="1" value="${current.avatarSize}" data-avatar-size>
      </label>
      <label class="range-row">
        <span class="range-row__top"><span>头像圆角</span><output data-radius-output>${current.avatarRadius}%</output></span>
        <input class="range" type="range" min="0" max="50" step="1" value="${current.avatarRadius}" data-avatar-radius>
      </label>
      <label class="switch-row">
        <span class="switch-row__copy">
          <strong>显示我的头像</strong>
          <small>在每条消息旁显示当前面具头像</small>
        </span>
        <span class="switch">
          <input type="checkbox" data-show-user-avatar${current.showUserAvatar ? ' checked' : ''} aria-label="显示我的头像">
          <span class="switch__track"></span>
        </span>
      </label>
    </section>`;

  openSheet({
    title: '聊天设置',
    description: `只影响和${character.name}的这段对话。`,
    className: 'sheet--settings',
    content: `<div class="chat-settings">
      <div class="segmented chat-settings__tabs" role="tablist" aria-label="聊天设置分组">
        <button class="segmented__item is-selected" type="button" role="tab" aria-selected="true" data-tab="general">通用</button>
        <button class="segmented__item" type="button" role="tab" aria-selected="false" data-tab="fun">趣味</button>
      </div>
      <div data-panel="general">${generalMarkup()}</div>
      <div data-panel="fun" hidden>
        <section class="settings-block">
          <div class="settings-block__head">
            <h3>表情包</h3>
            <span class="settings-block__hint">开启后会偶尔发送</span>
          </div>
          <div data-sticker-list>${stickerListMarkup()}</div>
        </section>
      </div>
    </div>`,
    onMount: (sheet) => {
      const generalPanel = sheet.querySelector('[data-panel="general"]');
      const funPanel = sheet.querySelector('[data-panel="fun"]');
      const bubbleCssInput = sheet.querySelector('[data-bubble-css]');
      const preview = sheet.querySelector('[data-bubble-preview]');
      const presetForm = sheet.querySelector('[data-preset-form]');
      const presetNameInput = presetForm.querySelector('[name="presetName"]');
      const presetCssInput = presetForm.querySelector('[name="presetCss"]');

      const updatePreview = () => {
        styleBubble(preview, current.bubbleCss);
      };

      const paintPresetSwatches = () => {
        sheet.querySelectorAll('[data-preset-swatch]').forEach((swatch) => {
          const preset = getBubblePresets().find(
            (item) => item.id === swatch.dataset.presetSwatch,
          );
          if (preset) styleBubble(swatch, preset.css);
        });
      };

      const notify = (patch) => {
        current = updateChatStyle(character.id, patch);
        onStyleChange?.(current);
      };

      const applyLocal = (patch) => {
        current = { ...current, ...patch };
        onStyleChange?.(current);
      };

      updatePreview();
      paintPresetSwatches();

      sheet.querySelectorAll('[data-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
          sheet.querySelectorAll('[data-tab]').forEach((item) => {
            const selected = item === tab;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-selected', String(selected));
          });
          const fun = tab.dataset.tab === 'fun';
          generalPanel.hidden = fun;
          funPanel.hidden = !fun;
        });
      });

      sheet.querySelector('[data-apply-bubble]').addEventListener('click', () => {
        const css = bubbleCssInput.value.trim();
        notify({ bubbleCss: css, presetId: '' });
        current = { ...current };
        bubbleCssInput.value = css;
        updatePreview();
        sheet.querySelector('[data-preset-list]').innerHTML = presetListMarkup(current);
        paintPresetSwatches();
        toast(css ? '气泡样式已应用' : '已恢复默认气泡');
      });

      sheet.querySelector('[data-reset-bubble]').addEventListener('click', () => {
        notify({ bubbleCss: '', presetId: 'default' });
        bubbleCssInput.value = '';
        updatePreview();
        sheet.querySelector('[data-preset-list]').innerHTML = presetListMarkup(current);
        paintPresetSwatches();
      });

      sheet.querySelector('[data-add-preset]').addEventListener('click', () => {
        editingPresetId = null;
        presetNameInput.value = '';
        presetCssInput.value = current.bubbleCss;
        presetForm.hidden = false;
        presetNameInput.focus();
      });

      sheet.querySelector('[data-cancel-preset]').addEventListener('click', () => {
        presetForm.hidden = true;
        editingPresetId = null;
      });

      sheet.querySelector('[data-save-preset]').addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        const css = presetCssInput.value.trim();
        if (!name || !css) {
          toast('预设需要名称和 CSS', { tone: 'danger' });
          return;
        }
        if (editingPresetId) {
          const updated = updateBubblePreset(editingPresetId, { name, css });
          if (updated && current.presetId === updated.id) {
            notify({ bubbleCss: updated.css, presetId: updated.id });
            bubbleCssInput.value = updated.css;
          }
        } else {
          const created = addBubblePreset({ name, css });
          if (created) {
            notify({ bubbleCss: created.css, presetId: created.id });
            bubbleCssInput.value = created.css;
          }
        }
        presetForm.hidden = true;
        editingPresetId = null;
        sheet.querySelector('[data-preset-list]').innerHTML = presetListMarkup(current);
        paintPresetSwatches();
        updatePreview();
      });

      sheet.querySelector('[data-preset-list]').addEventListener('click', (event) => {
        const applyButton = event.target.closest('[data-apply-preset]');
        if (applyButton) {
          const preset = getBubblePresets().find(
            (item) => item.id === applyButton.dataset.applyPreset,
          );
          if (!preset) return;
          notify({ bubbleCss: preset.css, presetId: preset.id });
          bubbleCssInput.value = preset.css;
          updatePreview();
          sheet.querySelector('[data-preset-list]').innerHTML = presetListMarkup(current);
          paintPresetSwatches();
          return;
        }

        const editButton = event.target.closest('[data-edit-preset]');
        if (editButton) {
          const preset = getBubblePresets().find(
            (item) => item.id === editButton.dataset.editPreset,
          );
          if (!preset) return;
          editingPresetId = preset.id;
          presetNameInput.value = preset.name;
          presetCssInput.value = preset.css;
          presetForm.hidden = false;
          presetNameInput.focus();
          return;
        }

        const deleteButton = event.target.closest('[data-delete-preset]');
        if (deleteButton) {
          const id = deleteButton.dataset.deletePreset;
          deleteBubblePreset(id);
          if (current.presetId === id) notify({ presetId: '' });
          sheet.querySelector('[data-preset-list]').innerHTML = presetListMarkup(current);
          paintPresetSwatches();
        }
      });

      const bindBackground = () => {
        const panel = sheet.querySelector('[data-panel="general"]');
        const backgroundSection = panel.querySelectorAll('.settings-block')[1];
        const file = backgroundSection.querySelector('[data-background-file]');
        backgroundSection.querySelectorAll('[data-background]').forEach((button) => {
          button.addEventListener('click', () => {
            notify({ background: button.dataset.background, backgroundImage: '' });
            refreshBackground();
          });
        });
        backgroundSection.querySelector('[data-background-upload]').addEventListener('click', () => {
          file.click();
        });
        backgroundSection.querySelector('[data-background-clear]')?.addEventListener('click', () => {
          notify({ backgroundImage: '', background: 'default' });
          refreshBackground();
        });
        file.addEventListener('change', async () => {
          const image = file.files?.[0];
          if (!image) return;
          try {
            const dataUrl = await readImageFile(image, { maxSize: 1400, quality: 0.82 });
            notify({ backgroundImage: dataUrl });
            refreshBackground();
          } catch (error) {
            toast(error.message || '背景图片读取失败', { tone: 'danger' });
          } finally {
            file.value = '';
          }
        });
      };

      const refreshBackground = () => {
        const panel = sheet.querySelector('[data-panel="general"]');
        const backgroundSection = panel.querySelectorAll('.settings-block')[1];
        backgroundSection.innerHTML =
          `<div class="settings-block__head"><h3>聊天背景</h3></div>${backgroundMarkup(current)}`;
        bindBackground();
      };

      bindBackground();

      const sizeInput = sheet.querySelector('[data-avatar-size]');
      const radiusInput = sheet.querySelector('[data-avatar-radius]');
      const sizeOutput = sheet.querySelector('[data-size-output]');
      const radiusOutput = sheet.querySelector('[data-radius-output]');
      const userAvatarToggle = sheet.querySelector('[data-show-user-avatar]');

      sizeInput.addEventListener('input', () => {
        sizeOutput.textContent = `${sizeInput.value}px`;
        applyLocal({ avatarSize: Number(sizeInput.value) });
      });
      sizeInput.addEventListener('change', () => {
        notify({ avatarSize: Number(sizeInput.value) });
      });

      radiusInput.addEventListener('input', () => {
        radiusOutput.textContent = `${radiusInput.value}%`;
        applyLocal({ avatarRadius: Number(radiusInput.value) });
      });
      radiusInput.addEventListener('change', () => {
        notify({ avatarRadius: Number(radiusInput.value) });
      });

      userAvatarToggle.addEventListener('change', () => {
        notify({ showUserAvatar: userAvatarToggle.checked });
      });

      const bindStickerList = () => {
        const container = sheet.querySelector('[data-sticker-list]');
        container.innerHTML = stickerListMarkup();
        container.querySelectorAll('[data-sticker-pack]').forEach((checkbox) => {
          checkbox.addEventListener('change', () => {
            updateStickerPack(checkbox.dataset.stickerPack, {
              enabled: checkbox.checked,
            });
          });
        });
        container.querySelector('[data-open-stickers]')?.addEventListener('click', () => {
          window.location.hash = '#/stickers';
        });
      };

      bindStickerList();
    },
  });
}
