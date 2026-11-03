import {
  CHAT_BACKGROUNDS,
  DEFAULT_CHAT_STYLE,
  DEFAULT_ANIMATION_CSS,
  DEFAULT_BUBBLE_CSS,
  DEFAULT_PACKET_CSS,
  MESSAGE_ANIMATIONS,
  PACKET_PRESETS,
  SPARK_ICONS,
  getAnimationCss,
  getPacketCss,
  getSparkSvg,
} from '../data/chat-options.js';
import { copyText } from '../services/clipboard.js';
import { readImageFile } from '../services/image.js';
import {
  addBubblePreset,
  addChatPreference,
  deleteBubblePreset,
  deleteChatPreference,
  getBubblePresets,
  getChatMemory,
  getFavoriteCount,
  getRecentMessages,
  getStickerPacks,
  updateBubblePreset,
  updateChatPreference,
  updateChatStyle,
  updateMemorySettings,
  updateStickerPack,
} from '../services/store.js';
import { currentPeriodLabel } from '../services/time-awareness.js';
import {
  chatStreakDays,
  escapeHTML,
  sanitizeSvgIcon,
} from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { uiIcon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

const BACKGROUND_PREVIEWS = {
  default: '#f5f1e8',
  warm: 'linear-gradient(150deg, #f7e6cd, #efd0ad)',
  night: 'linear-gradient(150deg, #33302d, #1d1b19)',
  dawn: 'linear-gradient(150deg, #e8eeeb, #cfdcd7)',
};

const BUBBLE_PRESET_VISIBLE = 4;
const BUBBLE_PRESET_COLUMNS = 2;

const BUBBLE_PRESET_PREVIEW_CSS = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
    height: 100%;
  }

  .preset-preview {
    display: flex;
    height: 100%;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    overflow: hidden;
    padding: 10px;
    background:
      radial-gradient(120% 100% at 12% 8%, color-mix(in srgb, var(--color-accent-soft) 52%, transparent), transparent 68%),
      color-mix(in srgb, var(--color-ink) 4%, transparent);
  }

  .message-bubble {
    max-width: 86%;
    padding: 5px 9px;
    font-family: inherit;
    font-size: 11px;
    line-height: 1.35;
    letter-spacing: 0;
    overflow-wrap: anywhere;
    white-space: nowrap;
  }

  .message-bubble--assistant {
    align-self: flex-start;
    border-radius: 12px 12px 12px 4px;
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .message-bubble--user {
    align-self: flex-end;
    border-radius: 12px 12px 4px 12px;
    background: var(--color-action);
    color: var(--color-action-ink);
  }
`;

const VIEW_TITLES = {
  send: '发送方式',
  composer: '底栏样式',
  speed: '打字速度',
  animation: '消息动效',
  loading: '加载反馈',
  bubble: '气泡样式',
  background: '聊天背景',
  avatar: '头像',
  packet: '红包样式',
  stickers: '表情包',
  spark: '连续火花',
  reaction: '贴表情大小',
  about: '关于我',
};

export function applyChatStyle(screen, style) {
  screen.style.setProperty('--chat-avatar-size', `${style.avatarSize}px`);
  screen.style.setProperty('--chat-avatar-radius', `${style.avatarRadius}%`);
  screen.style.setProperty('--chat-message-gap', `${style.messageGap}px`);
  screen.style.setProperty('--chat-reaction-size', `${style.reactionSize || 20}px`);
  screen.dataset.chatBackground = style.background || 'default';
  if (style.bubbleCss) screen.dataset.customBubble = '';
  else delete screen.dataset.customBubble;
  screen.classList.toggle('is-hiding-user-avatar', !style.showUserAvatar);
  screen.classList.toggle('is-hiding-status', style.showStatus === false);

  const scroller = screen.querySelector('.chat-scroll');
  if (scroller) {
    if (style.backgroundImage) {
      scroller.style.backgroundImage = `linear-gradient(rgba(244, 241, 236, 0.2), rgba(244, 241, 236, 0.2)), url(${JSON.stringify(style.backgroundImage)})`;
      scroller.dataset.hasImage = 'true';
    } else {
      scroller.style.backgroundImage = '';
      delete scroller.dataset.hasImage;
    }
  }

  let styleElement = screen.querySelector('style[data-chat-css]');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.dataset.chatCss = '';
    screen.prepend(styleElement);
  }
  const css = [
    style.bubbleCss,
    getPacketCss(style),
    getAnimationCss(style),
  ]
    .filter(Boolean)
    .join('\n\n');
  if (styleElement.textContent !== css) styleElement.textContent = css;
}

function speedLabel(speed) {
  return `${speed.toFixed(3)} 秒 / 字`;
}

function preferenceDate(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '刚刚';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function preferenceCard(pref, index) {
  return `<button class="about-me-card" type="button" data-preference="${escapeHTML(pref.id)}" style="--card-index:${index}">
    <span class="about-me-card__mark" aria-hidden="true">“</span>
    <span class="about-me-card__text">${escapeHTML(pref.content)}</span>
    <span class="about-me-card__meta">
      <span class="about-me-card__source">${pref.source === 'auto' ? 'TA 悄悄记下的' : '你写下的'}</span>
      <span class="about-me-card__dot" aria-hidden="true"></span>
      <time>${preferenceDate(pref.updatedAt || pref.createdAt)}</time>
      <span class="about-me-card__edit" aria-hidden="true">${uiIcon('pencil', { size: 12 })}</span>
    </span>
  </button>`;
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
        <span class="background-swatch__color" data-background-preview${style.backgroundImage ? ` style="background-image:url(&quot;${escapeHTML(style.backgroundImage)}&quot;)"` : ''}>${style.backgroundImage ? '' : uiIcon('image', { size: 18 })}</span>
        <span class="background-swatch__name">我的图片</span>
      </button>
    </div>
    <button class="text-button${style.backgroundImage ? '' : ' is-hidden'}" type="button" data-background-clear>移除背景图片</button>
    <input type="file" accept="image/*" data-background-file hidden>`;
}

function presetListMarkup(style) {
  return getBubblePresets()
    .map(
      (preset) => `<article class="preset-card${style.presetId === preset.id ? ' is-active' : ''}" data-preset-row="${preset.id}">
        <button class="preset-card__apply" type="button" data-apply-preset="${preset.id}">
          <span class="preset-card__preview" data-preset-preview="${preset.id}" aria-hidden="true"></span>
          <span class="preset-card__name">
            <span class="preset-card__name-text">${escapeHTML(preset.name)}</span>
            ${style.presetId === preset.id ? `<span class="preset-card__current">${uiIcon('check', { size: 10 })}</span>` : ''}
          </span>
        </button>
        <span class="preset-card__actions">
          <button class="preset-card__action" type="button" aria-label="编辑预设" data-edit-preset="${preset.id}">${uiIcon('pencil', { size: 13 })}</button>
          <button class="preset-card__action" type="button" aria-label="删除预设" data-delete-preset="${preset.id}">${uiIcon('trash', { size: 13 })}</button>
        </span>
      </article>`,
    )
    .join('');
}

function stickerListMarkup() {
  const packs = getStickerPacks();
  if (!packs.length) {
    return `<div class="settings-empty">
      <span class="settings-empty__icon">${uiIcon('sticker', { size: 28 })}</span>
      <p>还没有表情包。导入图片并起名后，AI 会按名字理解它们。</p>
      <button class="button button--secondary settings-empty__button" type="button" data-open-stickers>去添加表情包</button>
    </div>`;
  }

  return `<div class="switch-list">
    ${packs
      .map(
        (pack) => `<div class="switch-list__row">
          <span class="switch-list__preview">
            ${pack.items
              .slice(0, 3)
              .map((item) => `<img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.name)}" title="${escapeHTML(item.name)}" loading="lazy">`)
              .join('')}
          </span>
          <span class="switch-list__copy">
            <strong>${escapeHTML(pack.name)}</strong>
            <small>${pack.items.length} 张</small>
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

function bubbleLabel(current) {
  if (!current.bubbleCss) return '默认';
  const preset =
    getBubblePresets().find((item) => item.id === current.presetId) ||
    getBubblePresets().find((item) => item.css === current.bubbleCss);
  return preset?.name || '自定义';
}

function animationLabel(current) {
  if (current.animationCss) return '自定义';
  return (
    MESSAGE_ANIMATIONS.find((item) => item.id === current.animationId)?.name ||
    '淡入'
  );
}

function packetLabel(current) {
  if (current.packetCss) return '自定义';
  return (
    PACKET_PRESETS.find((item) => item.id === current.packetPresetId)?.name ||
    '暖红'
  );
}

function backgroundLabel(current) {
  if (current.backgroundImage) return '我的图片';
  return (
    CHAT_BACKGROUNDS.find((item) => item.id === current.background)?.name ||
    '默认'
  );
}

function sparkLabel(style) {
  if (!style.sparkEnabled) return '已关闭';
  if (style.sparkIcon === 'custom') return '自定义';
  return (
    SPARK_ICONS.find((item) => item.id === style.sparkIcon)?.name || '已开启'
  );
}

function composerLabel(current) {
  return current.composerStyle === 'raised' ? '加高 · 快捷按钮' : '默认';
}

function loadingLabel(current) {
  return current.loadingStyle === 'header' ? '顶栏「正在输入」' : '消息动画';
}

export function createChatSettingsPage({ character, style }) {
  let current = { ...style };
  let tab = 'general';
  let view = 'root';
  let presetFormOpen = false;
  let editingPresetId = null;
  let presetDraft = { name: '', css: '' };
  let presetListScrollTop = 0;
  let streakDays = 0;
  let streakLoaded = false;

  const screen = document.createElement('section');
  screen.className = 'screen screen--chat-settings';
  screen.innerHTML = `
    <header class="chat-settings-page__header">
      <a class="icon-button" href="#/chat/${character.id}" aria-label="返回聊天" data-settings-back>${uiIcon('chevron-left', { size: 20, strokeWidth: 1.9 })}</a>
      <h1 data-settings-title>聊天设置</h1>
      <span aria-hidden="true"></span>
    </header>
    <main class="page-scroll chat-settings-page__scroll">
      <div class="chat-settings-page__content">
        <div class="chat-settings-page__profile">
          ${characterAvatar(character, 'lg')}
          <span><strong>${escapeHTML(character.name)}</strong><small>仅影响和${escapeHTML(character.name)}的这段对话</small></span>
        </div>
        <div class="chat-settings">
      <div class="segmented chat-settings__tabs" data-chat-settings-tabs role="tablist" aria-label="聊天设置分组">
        <button class="segmented__item is-selected" type="button" role="tab" aria-selected="true" data-tab="general">通用</button>
        <button class="segmented__item" type="button" role="tab" aria-selected="false" data-tab="fun">趣味</button>
      </div>
      <div data-chat-settings-content></div>
        </div>
      </div>
    </main>`;
      const content = screen.querySelector('[data-chat-settings-content]');
      const tabs = screen.querySelector('[data-chat-settings-tabs]');
      const body = screen.querySelector('.chat-settings-page__scroll');

      const previewStyle = document.createElement('style');
      previewStyle.dataset.settingsPreview = '';
      screen.prepend(previewStyle);

      const setCurrent = (next) => {
        current = next;
      };

      const notify = (patch) => {
        setCurrent(updateChatStyle(character.id, patch));
        return current;
      };

      const applyLocal = (patch) => {
        setCurrent({ ...current, ...patch });
      };

      const copyDefault = async (text, label) => {
        const copied = await copyText(text);
        toast(copied ? `${label}已复制` : '复制失败，请手动选中代码', {
          tone: copied ? 'default' : 'danger',
        });
      };

      const rootMarkup = () => {
        if (tab === 'fun') {
          const packs = getStickerPacks();
          const enabled = packs.filter((pack) => pack.enabled).length;
          const memory = getChatMemory(character.id);
          const preferences = memory.preferences || [];
          return `<section class="chat-settings__group">
            <h3 class="chat-settings__group-label">感知</h3>
            <div class="chat-settings__list">
              <div class="chat-settings__row">
                <span class="chat-settings__row-icon">${uiIcon('clock', { size: 18 })}</span>
                <span class="chat-settings__row-label">时间感知</span>
                <span class="chat-settings__row-value">${current.timeAwareness ? currentPeriodLabel() : '已关闭'}</span>
                <label class="switch">
                  <input type="checkbox" data-time-awareness${current.timeAwareness ? ' checked' : ''} aria-label="时间感知">
                  <span class="switch__track"></span>
                </label>
              </div>
            </div>
          </section>
          <section class="chat-settings__group">
            <h3 class="chat-settings__group-label">互动</h3>
            <div class="chat-settings__list">
              <button class="chat-settings__row" type="button" data-open-view="stickers">
                <span class="chat-settings__row-icon">${uiIcon('sticker', { size: 18 })}</span>
                <span class="chat-settings__row-label">表情包</span>
                <span class="chat-settings__row-value">${enabled}/${packs.length} 组</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
              <button class="chat-settings__row" type="button" data-open-view="reaction">
                <span class="chat-settings__row-icon">${uiIcon('smiley', { size: 18 })}</span>
                <span class="chat-settings__row-label">贴表情大小</span>
                <span class="chat-settings__row-value">${current.reactionSize}px</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
              <button class="chat-settings__row" type="button" data-open-view="spark">
                <span class="chat-settings__row-icon">${uiIcon('flame', { size: 18 })}</span>
                <span class="chat-settings__row-label">连续火花</span>
                <span class="chat-settings__row-value">${sparkLabel(current)}</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
              <button class="chat-settings__row" type="button" data-open-view="packet">
                <span class="chat-settings__row-icon">${uiIcon('red-packet', { size: 18 })}</span>
                <span class="chat-settings__row-label">红包样式</span>
                <span class="chat-settings__row-value">${packetLabel(current)}</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
              <button class="chat-settings__row" type="button" data-open-favorites>
                <span class="chat-settings__row-icon">${uiIcon('bookmark', { size: 18 })}</span>
                <span class="chat-settings__row-label">收藏</span>
                <span class="chat-settings__row-value">${getFavoriteCount()} 条</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
            </div>
          </section>
          <section class="chat-settings__group">
            <h3 class="chat-settings__group-label">记忆</h3>
            <div class="chat-settings__list">
              <button class="chat-settings__row" type="button" data-open-view="about">
                <span class="chat-settings__row-icon">${uiIcon('heart', { size: 18 })}</span>
                <span class="chat-settings__row-label">关于我</span>
                <span class="chat-settings__row-value">${preferences.length ? `${preferences.length} 件小事` : '还没记住'}</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
              <button class="chat-settings__row" type="button" data-memory>
                <span class="chat-settings__row-icon">${uiIcon('archive', { size: 18 })}</span>
                <span class="chat-settings__row-label">聊天记忆</span>
                <span class="chat-settings__row-value">${memory.items.length} 条</span>
                <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
              </button>
            </div>
          </section>`;
        }

        return `<section class="chat-settings__group">
          <h3 class="chat-settings__group-label">发送</h3>
          <div class="chat-settings__list">
            <button class="chat-settings__row" type="button" data-open-view="send">
              <span class="chat-settings__row-icon">${uiIcon('send', { size: 18 })}</span>
              <span class="chat-settings__row-label">发送方式</span>
              <span class="chat-settings__row-value">${current.sendMode === 'multi' ? '多条' : '单条'}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="speed">
              <span class="chat-settings__row-icon">${uiIcon('keyboard', { size: 18 })}</span>
              <span class="chat-settings__row-label">打字速度</span>
              <span class="chat-settings__row-value">${speedLabel(current.typingSpeed)}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="animation">
              <span class="chat-settings__row-icon">${uiIcon('sparkle', { size: 18 })}</span>
              <span class="chat-settings__row-label">消息动效</span>
              <span class="chat-settings__row-value">${animationLabel(current)}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="loading">
              <span class="chat-settings__row-icon">${uiIcon('hourglass', { size: 18 })}</span>
              <span class="chat-settings__row-label">加载反馈</span>
              <span class="chat-settings__row-value">${loadingLabel(current)}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
          </div>
        </section>
        <section class="chat-settings__group">
          <h3 class="chat-settings__group-label">外观</h3>
          <div class="chat-settings__list">
            <button class="chat-settings__row" type="button" data-open-view="bubble">
              <span class="chat-settings__row-icon">${uiIcon('chat', { size: 18 })}</span>
              <span class="chat-settings__row-label">气泡样式</span>
              <span class="chat-settings__row-value">${bubbleLabel(current)}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="background">
              <span class="chat-settings__row-icon">${uiIcon('image', { size: 18 })}</span>
              <span class="chat-settings__row-label">聊天背景</span>
              <span class="chat-settings__row-value">${backgroundLabel(current)}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="avatar">
              <span class="chat-settings__row-icon">${uiIcon('user', { size: 18 })}</span>
              <span class="chat-settings__row-label">头像</span>
              <span class="chat-settings__row-value">${current.avatarSize}px · ${current.avatarRadius}%</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="composer">
              <span class="chat-settings__row-icon">${uiIcon('textbox', { size: 18 })}</span>
              <span class="chat-settings__row-label">底栏样式</span>
              <span class="chat-settings__row-value">${composerLabel(current)}</span>
              <span class="chat-settings__row-chevron">${uiIcon('chevron-right', { size: 15 })}</span>
            </button>
            <div class="chat-settings__row">
              <span class="chat-settings__row-icon">${uiIcon('broadcast', { size: 18 })}</span>
              <span class="chat-settings__row-label">显示状态</span>
              <label class="switch">
                <input type="checkbox" data-show-status${current.showStatus !== false ? ' checked' : ''} aria-label="在聊天顶部显示状态">
                <span class="switch__track"></span>
              </label>
            </div>
          </div>
        </section>
        <button class="chat-settings-page__reset" type="button" data-reset-chat-settings>
          <span>${uiIcon('retry', { size: 17 })}恢复默认设置</span>
          ${uiIcon('chevron-right', { size: 15 })}
        </button>`;
      };

      const sendMarkup = () => `<p class="settings-note">长按发送键切换发送方式；多条模式下，双击发送键接收回复。</p>
        <div class="choice-list">
          <button class="choice-card${current.sendMode === 'single' ? ' is-selected' : ''}" type="button" data-set-mode="single">
            <span class="choice-card__icon">${uiIcon('send', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>单条</strong><small>发送后立刻请求回复</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
          <button class="choice-card${current.sendMode === 'multi' ? ' is-selected' : ''}" type="button" data-set-mode="multi">
            <span class="choice-card__icon">${uiIcon('stack', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>多条</strong><small>先连续发送，再双击发送键接收回复</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
        </div>`;

      const composerMarkup = () => `
        <div class="choice-list">
          <button class="choice-card${current.composerStyle === 'raised' ? '' : ' is-selected'}" type="button" data-set-composer="default">
            <span class="choice-card__icon">${uiIcon('textbox', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>默认</strong><small>单行输入，左下角「+」展开更多</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
          <button class="choice-card${current.composerStyle === 'raised' ? ' is-selected' : ''}" type="button" data-set-composer="raised">
            <span class="choice-card__icon">${uiIcon('stack', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>加高 · 快捷按钮</strong><small>输入卡更高，红包与重试直接显示，左侧换成表情包</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
        </div>
        <div class="composer-preview composer-preview--${current.composerStyle === 'raised' ? 'raised' : 'default'}" aria-hidden="true">
          <span class="composer-preview__quick"><i></i><i></i></span>
          <span class="composer-preview__line"><i class="composer-preview__dot"></i><i class="composer-preview__text"></i><i class="composer-preview__send"></i></span>
        </div>`;

      const loadingMarkup = () => `
        <div class="choice-list">
          <button class="choice-card${current.loadingStyle === 'header' ? '' : ' is-selected'}" type="button" data-set-loading="bubble">
            <span class="choice-card__icon">${uiIcon('chat', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>消息动画</strong><small>对话里先出现一颗跳动的气泡，回复到了再消失</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
          <button class="choice-card${current.loadingStyle === 'header' ? ' is-selected' : ''}" type="button" data-set-loading="header">
            <span class="choice-card__icon">${uiIcon('hourglass', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>顶栏「正在输入」</strong><small>状态栏换成绿色动态提示，对话里不占位</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
        </div>`;

      const speedMarkup = () => `<div class="settings-figure">
          <strong data-speed-output>${current.typingSpeed.toFixed(3)}</strong>
          <span>秒 / 字</span>
        </div>
        <label class="range-row">
          <span class="range-row__top"><span>每个字的停顿</span><output>${current.typingSpeed.toFixed(3)}s</output></span>
          <input class="range" type="range" min="5" max="120" step="1" value="${Math.round(current.typingSpeed * 1000)}" data-speed>
        </label>
        `;

      const animationMarkup = () => {
        const custom = Boolean(current.animationCss);
        return `<div class="animation-demo">
            <div class="message-row message-row--assistant is-new" data-animation-demo>
              <span class="message-row__avatar">${characterAvatar(character, 'xs')}</span>
              <div class="message-bubble message-bubble--assistant">今晚见。</div>
            </div>
          </div>
          <div class="subsection-head"><h4>预设</h4><span class="code-hint">.message-row.is-new</span></div>
          <div class="preset-list">
            ${MESSAGE_ANIMATIONS.map(
              (preset) => `<div class="preset-row${!custom && current.animationId === preset.id ? ' is-active' : ''}">
                <button class="preset-row__apply" type="button" data-animation-preset="${preset.id}">
                  <span class="preset-row__name">${preset.name}</span>
                  ${!custom && current.animationId === preset.id ? `<span class="preset-row__current">${uiIcon('check', { size: 12 })}</span>` : ''}
                </button>
              </div>`,
            ).join('')}
          </div>
          <label class="field settings-code-field">
            <span class="field__label">自定义动画 CSS</span>
            <span class="field__control field__control--area">
              <textarea class="field__input field__textarea field__textarea--code" rows="6" spellcheck="false" data-animation-css>${escapeHTML(getAnimationCss(current))}</textarea>
            </span>
          </label>
          <div class="inline-buttons">
            <button class="small-button small-button--solid" type="button" data-apply-animation>应用</button>
            <button class="small-button" type="button" data-reset-animation>恢复默认</button>
          </div>
          <button class="text-button text-button--small" type="button" data-copy-animation>${uiIcon('copy', { size: 15 })}复制默认代码</button>`;
      };

      const bubbleMarkup = () => `<div class="subsection-head"><h4>消息形式</h4></div>
        <div class="choice-list">
          <button class="choice-card${current.messageGroup !== 'each' ? ' is-selected' : ''}" type="button" data-message-group="group">
            <span class="choice-card__icon">${uiIcon('stack', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>连续气泡</strong><small>一个头像带几条消息，气泡连在一起</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
          <button class="choice-card${current.messageGroup === 'each' ? ' is-selected' : ''}" type="button" data-message-group="each">
            <span class="choice-card__icon">${uiIcon('chat', { size: 18 })}</span>
            <span class="choice-card__copy"><strong>逐条气泡</strong><small>每条消息单独一个气泡和一个头像</small></span>
            <span class="choice-card__check">${uiIcon('check', { size: 12 })}</span>
          </button>
        </div>
        <label class="range-row">
          <span class="range-row__top"><span>消息间隔</span><output data-gap-output>${current.messageGap}px</output></span>
          <input class="range" type="range" min="0" max="16" step="1" value="${current.messageGap}" data-message-gap>
        </label>
        <div class="bubble-settings-preview">
          <div class="bubble-preview-line">
            <div class="message-bubble message-bubble--assistant">在呢，慢慢说。</div>
          </div>
          <div class="bubble-preview-line bubble-preview-line--user">
            <div class="message-bubble message-bubble--user">今天路过那家店了。</div>
          </div>
        </div>
        <label class="field settings-code-field">
          <span class="field__label">气泡 CSS</span>
          <span class="field__control field__control--area">
            <textarea class="field__input field__textarea field__textarea--code" rows="8" spellcheck="false" data-bubble-css>${escapeHTML(current.bubbleCss)}</textarea>
          </span>
          <span class="field__hint">同时应用到你和对方的气泡。可用 <span class="code-hint">.message-bubble--assistant</span> / <span class="code-hint">.message-bubble--user</span>。</span>
        </label>
        <div class="inline-buttons">
          <button class="small-button small-button--solid" type="button" data-apply-bubble>应用</button>
          <button class="small-button" type="button" data-reset-bubble>恢复默认</button>
        </div>
        <button class="text-button text-button--small" type="button" data-copy-bubble>${uiIcon('copy', { size: 15 })}复制默认 CSS</button>
        <div class="subsection-head">
          <h4>预设</h4>
          <button class="text-button" type="button" data-add-preset>新增</button>
        </div>
        <div class="preset-list preset-list--bubble" data-preset-list>${presetListMarkup(current)}</div>
        <div class="preset-form" data-preset-form${presetFormOpen ? '' : ' hidden'}>
          <label class="field">
            <span class="field__label">预设名称</span>
            <span class="field__control">
              <input class="field__input" name="presetName" maxlength="12" autocomplete="off" placeholder="给这个样式起个名字" value="${escapeHTML(presetDraft.name)}">
            </span>
          </label>
          <label class="field">
            <span class="field__label">CSS</span>
            <span class="field__control field__control--area">
              <textarea class="field__input field__textarea field__textarea--code" name="presetCss" rows="6" spellcheck="false">${escapeHTML(presetDraft.css)}</textarea>
            </span>
          </label>
          <div class="inline-buttons">
            <button class="small-button small-button--solid" type="button" data-save-preset>保存</button>
            <button class="small-button" type="button" data-cancel-preset>取消</button>
          </div>
        </div>`;

      const backgroundMarkupView = () => backgroundMarkup(current);

      const avatarMarkup = () => `<label class="range-row">
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
        </label>`;

      const reactionMarkup = () => `<div class="reaction-size-preview" data-reaction-preview style="--chat-reaction-size:${current.reactionSize}px">
          <span class="message-reaction">😂</span>
          <span class="message-reaction">👍</span>
          <span class="message-reaction">❤️</span>
        </div>
        
        <label class="range-row">
          <span class="range-row__top"><span>Emoji 大小</span><output data-reaction-size-output>${current.reactionSize}px</output></span>
          <input class="range" type="range" min="14" max="40" step="1" value="${current.reactionSize}" data-reaction-size>
        </label>`;

      const aboutMeMarkup = () => {
        const memory = getChatMemory(character.id);
        const preferences = memory.preferences || [];
        const auto = (memory.preferenceEvery || 0) > 0;
        const every = Math.min(50, Math.max(2, memory.preferenceEvery || 4));
        return `<label class="switch-row about-me__switch">
            <span class="switch-row__copy">
              <strong>让 TA 悄悄记住</strong>
            </span>
            <span class="switch">
              <input type="checkbox" data-preference-auto${auto ? ' checked' : ''} aria-label="让 AI 自动记住我的喜好">
              <span class="switch__track"></span>
            </span>
          </label>
          ${
            auto
              ? `<label class="range-row about-me__frequency">
                  <span class="range-row__top"><span>整理频率</span><output data-preference-output>每 ${every} 次回复</output></span>
                  <input class="range" type="range" min="2" max="50" step="1" value="${every}" data-preference-frequency aria-label="自动整理频率">
                </label>`
              : ''
          }
          <div class="about-me__head">
            <h4>TA 记得的你${preferences.length ? `<span>${preferences.length}</span>` : ''}</h4>
            <button class="text-button text-button--small" type="button" data-add-preference>${uiIcon('plus', { size: 14 })}添加</button>
          </div>
          ${
            preferences.length
              ? `<div class="about-me__cards">${preferences
                  .slice()
                  .reverse()
                  .map(preferenceCard)
                  .join('')}</div>`
              : `<div class="about-me__empty">
                  <span class="about-me__empty-icon">${uiIcon('heart', { size: 24 })}</span>
                  <strong>还没有关于你的小事</strong>
                  <p>再聊几句，${escapeHTML(character.name)}就会慢慢记住你喜欢什么、讨厌什么。</p>
                </div>`
          }`;
      };

      const openPreferenceSheet = (pref = null) => {
        openSheet({
          title: pref ? '关于我' : '添加一件小事',
          description: pref
            ? ''
            : `写一件希望${character.name}一直记得的事。`,
          content: `<label class="field">
            
            <span class="field__control field__control--area">
              <textarea class="field__input field__textarea" rows="4" maxlength="160" data-preference-text placeholder="例如：讨厌吃香菜，喜欢下雨天">${escapeHTML(pref?.content || '')}</textarea>
            </span>
           
          </label>`,
          actions: pref
            ? `<div class="button-row">
                <button class="button button--danger" type="button" data-delete-preference>删除</button>
                <button class="button button--primary" type="button" data-save-preference>保存</button>
              </div>`
            : `<button class="button button--primary" type="button" data-save-preference>添加</button>`,
          onMount: (sheet) => {
            const input = sheet.querySelector('[data-preference-text]');
            const save = () => {
              const value = input.value.trim();
              if (!value) {
                toast('写一点内容', { tone: 'danger' });
                input.focus();
                return;
              }
              if (pref) {
                if (!updateChatPreference(character.id, pref.id, value)) {
                  toast('这条已经记下了', { tone: 'danger' });
                  input.focus();
                  return;
                }
                toast('已经改好了');
              } else if (!addChatPreference(character.id, value)) {
                toast('这条已经记下了');
                closeActiveSheet();
                paint();
                return;
              } else {
                toast('已经记下了');
              }
              closeActiveSheet();
              paint();
            };
            input.addEventListener('keydown', (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            });
            sheet
              .querySelector('[data-save-preference]')
              .addEventListener('click', save);
            sheet
              .querySelector('[data-delete-preference]')
              ?.addEventListener('click', () => {
                deleteChatPreference(character.id, pref.id);
                closeActiveSheet();
                toast('已经忘掉了');
                paint();
              });
            if (!pref) window.setTimeout(() => input.focus(), 120);
          },
        });
      };

      const packetMarkup = () => {
        const custom = Boolean(current.packetCss);
        return `<div class="packet-settings-preview">
            <div class="red-packet-card is-preview">
              <span class="red-packet-card__icon">${uiIcon('red-packet', { size: 18 })}</span>
              <span class="red-packet-card__copy"><strong>生日快乐！</strong><small>领取红包</small></span>
              <span class="red-packet-card__amount">¥5.20</span>
            </div>
          </div>
          <div class="subsection-head"><h4>预设</h4><span class="code-hint">.red-packet-card</span></div>
          <div class="preset-list">
            ${PACKET_PRESETS.map(
              (preset) => `<div class="preset-row${!custom && current.packetPresetId === preset.id ? ' is-active' : ''}">
                <button class="preset-row__apply" type="button" data-packet-preset="${preset.id}">
                  <span class="preset-row__name">${preset.name}</span>
                  ${!custom && current.packetPresetId === preset.id ? `<span class="preset-row__current">${uiIcon('check', { size: 12 })}</span>` : ''}
                </button>
              </div>`,
            ).join('')}
          </div>
          <label class="field settings-code-field">
            <span class="field__label">红包 CSS</span>
            <span class="field__control field__control--area">
              <textarea class="field__input field__textarea field__textarea--code" rows="8" spellcheck="false" data-packet-css>${escapeHTML(getPacketCss(current))}</textarea>
            </span>
          </label>
          <div class="inline-buttons">
            <button class="small-button small-button--solid" type="button" data-apply-packet>应用</button>
            <button class="small-button" type="button" data-reset-packet>恢复默认</button>
          </div>
          <button class="text-button text-button--small" type="button" data-copy-packet>${uiIcon('copy', { size: 15 })}复制默认代码</button>`;
      };

      const stickersMarkup = () => `<div data-sticker-list>${stickerListMarkup()}</div>`;

      const sparkMarkup = () => {
        const custom = current.sparkIcon === 'custom';
        const streak = streakLoaded ? streakDays : 0;
        return `<div class="spark-preview">
            <span class="chat-spark">
              <span class="chat-spark__icon">${getSparkSvg(current)}</span>
              <span class="chat-spark__days">${streak > 0 ? `${streak} 天` : '7 天'}</span>
            </span>
            <small>${streak > 0 ? `已经连续聊了 ${streak} 天` : '开启后的样子'}</small>
          </div>
          <label class="switch-row">
            <span class="switch-row__copy">
              <strong>在聊天顶部显示</strong>
              <small>断签后从第 1 天重新开始</small>
            </span>
            <span class="switch">
              <input type="checkbox" data-spark-enabled${current.sparkEnabled ? ' checked' : ''} aria-label="显示连续火花">
              <span class="switch__track"></span>
            </span>
          </label>
          <div class="subsection-head"><h4>图标</h4><span class="code-hint">8 个预设</span></div>
          <div class="spark-icon-grid">
            ${SPARK_ICONS.map(
              (preset) => `<button class="spark-icon${current.sparkIcon === preset.id ? ' is-selected' : ''}" type="button" data-spark-icon="${preset.id}" aria-pressed="${current.sparkIcon === preset.id}" aria-label="${preset.name}" title="${preset.name}">${preset.svg}</button>`,
            ).join('')}
            <button class="spark-icon spark-icon--custom${custom ? ' is-selected' : ''}" type="button" data-spark-icon="custom" aria-pressed="${custom}" aria-label="自定义 SVG">
              ${uiIcon('file', { size: 15 })}<span>SVG</span>
            </button>
          </div>
          <div class="spark-custom" data-spark-custom${custom ? '' : ' hidden'}>
            <label class="field settings-code-field">
              <span class="field__label">自定义 SVG 代码</span>
              <span class="field__control field__control--area">
                <textarea class="field__input field__textarea field__textarea--code" rows="6" spellcheck="false" data-spark-svg placeholder="&lt;svg viewBox=&quot;0 0 24 24&quot;&gt;…&lt;/svg&gt;">${escapeHTML(current.sparkSvg || '')}</textarea>
              </span>
            </label>
            <div class="inline-buttons">
              <button class="small-button small-button--solid" type="button" data-apply-spark>应用 SVG</button>
            </div>
            <p class="field__hint">只保留基础图形与颜色，脚本和外部链接会被移除。</p>
          </div>
          <p class="settings-note">每天聊一句就会累积一天；今天或昨天有消息时火花才会保留。</p>`;
      };

      const subviewMarkup = () => {
        if (view === 'send') return sendMarkup();
        if (view === 'composer') return composerMarkup();
        if (view === 'speed') return speedMarkup();
        if (view === 'animation') return animationMarkup();
        if (view === 'loading') return loadingMarkup();
        if (view === 'bubble') return bubbleMarkup();
        if (view === 'background') return backgroundMarkupView();
        if (view === 'avatar') return avatarMarkup();
        if (view === 'packet') return packetMarkup();
        if (view === 'stickers') return stickersMarkup();
        if (view === 'spark') return sparkMarkup();
        if (view === 'reaction') return reactionMarkup();
        if (view === 'about') return aboutMeMarkup();
        return '';
      };

      const paintTabs = () => {
        tabs.hidden = view !== 'root';
        tabs.querySelectorAll('[data-tab]').forEach((button) => {
          const selected = button.dataset.tab === tab;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-selected', String(selected));
        });
      };

      const paint = () => {
        screen.classList.toggle('is-subview', view !== 'root');
        const titleNode = screen.querySelector('[data-settings-title]');
        const backNode = screen.querySelector('[data-settings-back]');
        if (titleNode) titleNode.textContent = view === 'root' ? '聊天设置' : VIEW_TITLES[view] || '聊天设置';
        if (backNode) {
          backNode.setAttribute(
            'aria-label',
            view === 'root' ? '返回聊天' : '返回聊天设置',
          );
        }
        paintTabs();
        if (view !== 'bubble') presetListScrollTop = 0;
        content.innerHTML = view === 'root' ? rootMarkup() : subviewMarkup();
        previewStyle.textContent =
          view === 'bubble'
            ? current.bubbleCss || DEFAULT_BUBBLE_CSS
            : view === 'packet'
              ? getPacketCss(current)
              : view === 'animation'
                ? getAnimationCss(current)
                : '';
        bind();
      };

      const openView = (next) => {
        view = next;
        presetFormOpen = false;
        paint();
        body.scrollTop = 0;
      };

      const replayAnimationDemo = () => {
        const demo = content.querySelector('[data-animation-demo]');
        if (!demo) return;
        demo.classList.remove('is-new');
        void demo.offsetWidth;
        demo.classList.add('is-new');
      };

      const bindBackground = () => {
        const file = content.querySelector('[data-background-file]');
        content.querySelectorAll('[data-background]').forEach((button) => {
          button.addEventListener('click', () => {
            notify({ background: button.dataset.background, backgroundImage: '' });
            paint();
          });
        });
        content.querySelector('[data-background-upload]')?.addEventListener('click', () => {
          file?.click();
        });
        content.querySelector('[data-background-clear]')?.addEventListener('click', () => {
          notify({ backgroundImage: '', background: 'default' });
          paint();
        });
        file?.addEventListener('change', async () => {
          const image = file.files?.[0];
          if (!image) return;
          try {
            const dataUrl = await readImageFile(image, { maxSize: 1400, quality: 0.82 });
            if (!screen.isConnected) return;
            notify({ backgroundImage: dataUrl });
            paint();
          } catch (error) {
            toast(error.message || '背景图片读取失败', { tone: 'danger' });
          } finally {
            file.value = '';
          }
        });
      };

      const bindBubble = () => {
        const input = content.querySelector('[data-bubble-css]');
        const presetForm = content.querySelector('[data-preset-form]');
        const presetList = content.querySelector('[data-preset-list]');
        const gap = content.querySelector('[data-message-gap]');
        const gapOutput = content.querySelector('[data-gap-output]');

        const renderPresetPreviews = () => {
          presetList.querySelectorAll('[data-preset-preview]').forEach((host) => {
            const preset = getBubblePresets().find(
              (item) => item.id === host.dataset.presetPreview,
            );
            if (!preset) return;
            const shadow = host.attachShadow({ mode: 'open' });
            const baseStyle = document.createElement('style');
            baseStyle.textContent = BUBBLE_PRESET_PREVIEW_CSS;
            const presetStyle = document.createElement('style');
            presetStyle.textContent = preset.css;
            const scene = document.createElement('div');
            scene.className = 'preset-preview';
            scene.innerHTML =
              '<span class="message-bubble message-bubble--assistant">在呢</span><span class="message-bubble message-bubble--user">晚安</span>';
            shadow.append(baseStyle, presetStyle, scene);
          });
        };

        const syncPresetEdge = () => {
          const atEnd =
            presetList.scrollTop + presetList.clientHeight >=
            presetList.scrollHeight - 1;
          presetList.classList.toggle('is-at-end', atEnd);
        };

        const fitPresetList = () => {
          const cards = presetList.querySelectorAll('.preset-card');
          if (cards.length <= BUBBLE_PRESET_VISIBLE) {
            presetList.style.removeProperty('max-height');
            presetList.classList.remove('is-scrollable');
            syncPresetEdge();
            return;
          }
          const styles = getComputedStyle(presetList);
          const gapSize = Number.parseFloat(styles.rowGap) || 0;
          const padding =
            (Number.parseFloat(styles.paddingTop) || 0) +
            (Number.parseFloat(styles.paddingBottom) || 0);
          const cardHeight = cards[0].getBoundingClientRect().height;
          const visibleRows = Math.ceil(
            BUBBLE_PRESET_VISIBLE / BUBBLE_PRESET_COLUMNS,
          );
          presetList.style.maxHeight = `${Math.ceil(
            cardHeight * visibleRows + gapSize * (visibleRows - 1) + padding,
          )}px`;
          presetList.classList.add('is-scrollable');
          syncPresetEdge();
        };

        renderPresetPreviews();
        fitPresetList();
        presetList.scrollTop = presetListScrollTop;
        syncPresetEdge();
        presetList.addEventListener(
          'scroll',
          () => {
            presetListScrollTop = presetList.scrollTop;
            syncPresetEdge();
          },
          { passive: true },
        );

        content.querySelectorAll('[data-message-group]').forEach((button) => {
          button.addEventListener('click', () => {
            notify({ messageGroup: button.dataset.messageGroup });
            paint();
          });
        });

        gap.addEventListener('input', () => {
          gapOutput.textContent = `${gap.value}px`;
          applyLocal({ messageGap: Number(gap.value) });
        });
        gap.addEventListener('change', () => {
          notify({ messageGap: Number(gap.value) });
        });

        const savePreset = () => {
          const name = presetForm.querySelector('[name="presetName"]').value.trim();
          const css = presetForm.querySelector('[name="presetCss"]').value.trim();
          if (!name || !css) {
            toast('预设需要名称和 CSS', { tone: 'danger' });
            return;
          }
          let preset = null;
          if (editingPresetId) {
            preset = updateBubblePreset(editingPresetId, { name, css });
          } else {
            preset = addBubblePreset({ name, css });
          }
          if (!preset) {
            toast('预设没有保存', { tone: 'danger' });
            return;
          }
          notify({ bubbleCss: preset.css, presetId: preset.id });
          presetFormOpen = false;
          editingPresetId = null;
          paint();
          toast('预设已保存并应用');
        };

        content.querySelector('[data-apply-bubble]').addEventListener('click', () => {
          notify({ bubbleCss: input.value.trim(), presetId: '' });
          paint();
          toast(input.value.trim() ? '气泡样式已应用' : '已恢复默认气泡');
        });

        content.querySelector('[data-reset-bubble]').addEventListener('click', () => {
          notify({ bubbleCss: '', presetId: 'default' });
          paint();
        });

        content.querySelector('[data-copy-bubble]').addEventListener('click', () => {
          copyDefault(DEFAULT_BUBBLE_CSS, '默认气泡 CSS ');
        });

        content.querySelector('[data-add-preset]').addEventListener('click', () => {
          editingPresetId = null;
          presetDraft = { name: '', css: current.bubbleCss || DEFAULT_BUBBLE_CSS };
          presetFormOpen = true;
          paint();
          content.querySelector('[name="presetName"]')?.focus();
        });

        content.querySelector('[data-cancel-preset]').addEventListener('click', () => {
          presetFormOpen = false;
          editingPresetId = null;
          paint();
        });

        content.querySelector('[data-save-preset]').addEventListener('click', savePreset);

        content.querySelector('[data-preset-list]').addEventListener('click', (event) => {
          const applyButton = event.target.closest('[data-apply-preset]');
          if (applyButton) {
            const preset = getBubblePresets().find(
              (item) => item.id === applyButton.dataset.applyPreset,
            );
            if (!preset) return;
            notify({ bubbleCss: preset.css, presetId: preset.id });
            paint();
            return;
          }

          const editButton = event.target.closest('[data-edit-preset]');
          if (editButton) {
            const preset = getBubblePresets().find(
              (item) => item.id === editButton.dataset.editPreset,
            );
            if (!preset) return;
            editingPresetId = preset.id;
            presetDraft = { name: preset.name, css: preset.css };
            presetFormOpen = true;
            paint();
            content.querySelector('[name="presetName"]')?.focus();
            return;
          }

          const deleteButton = event.target.closest('[data-delete-preset]');
          if (deleteButton) {
            const id = deleteButton.dataset.deletePreset;
            if (!deleteBubblePreset(id)) return;
            if (current.presetId === id) notify({ presetId: '' });
            paint();
          }
        });
      };

      const bindAnimation = () => {
        const input = content.querySelector('[data-animation-css]');
        content.querySelectorAll('[data-animation-preset]').forEach((button) => {
          button.addEventListener('click', () => {
            const preset = MESSAGE_ANIMATIONS.find(
              (item) => item.id === button.dataset.animationPreset,
            );
            if (!preset) return;
            notify({ animationId: preset.id, animationCss: '' });
            paint();
          });
        });
        content.querySelector('[data-apply-animation]').addEventListener('click', () => {
          notify({ animationCss: input.value.trim(), animationId: '' });
          paint();
          toast('消息动效已应用');
        });
        content.querySelector('[data-reset-animation]').addEventListener('click', () => {
          notify({ animationId: 'fade', animationCss: '' });
          paint();
        });
        content.querySelector('[data-copy-animation]').addEventListener('click', () => {
          copyDefault(DEFAULT_ANIMATION_CSS, '默认动画代码 ');
        });
        requestAnimationFrame(replayAnimationDemo);
      };

      const bindBackgroundView = () => bindBackground();

      const bindAvatar = () => {
        const sizeInput = content.querySelector('[data-avatar-size]');
        const radiusInput = content.querySelector('[data-avatar-radius]');
        const sizeOutput = content.querySelector('[data-size-output]');
        const radiusOutput = content.querySelector('[data-radius-output]');
        const userAvatarToggle = content.querySelector('[data-show-user-avatar]');

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
      };

      const bindPacket = () => {
        const input = content.querySelector('[data-packet-css]');
        content.querySelectorAll('[data-packet-preset]').forEach((button) => {
          button.addEventListener('click', () => {
            const preset = PACKET_PRESETS.find(
              (item) => item.id === button.dataset.packetPreset,
            );
            if (!preset) return;
            notify({ packetCss: '', packetPresetId: preset.id });
            paint();
          });
        });
        content.querySelector('[data-apply-packet]').addEventListener('click', () => {
          notify({ packetCss: input.value.trim(), packetPresetId: '' });
          paint();
          toast('红包样式已应用');
        });
        content.querySelector('[data-reset-packet]').addEventListener('click', () => {
          notify({ packetCss: '', packetPresetId: 'warm' });
          paint();
        });
        content.querySelector('[data-copy-packet]').addEventListener('click', () => {
          copyDefault(DEFAULT_PACKET_CSS, '默认红包 CSS ');
        });
      };

      const bindStickers = () => {
        const container = content.querySelector('[data-sticker-list]');
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

      const bindReaction = () => {
        const input = content.querySelector('[data-reaction-size]');
        const output = content.querySelector('[data-reaction-size-output]');
        const preview = content.querySelector('[data-reaction-preview]');
        input.addEventListener('input', () => {
          const size = Number(input.value);
          output.textContent = `${size}px`;
          preview?.style.setProperty('--chat-reaction-size', `${size}px`);
          applyLocal({ reactionSize: size });
        });
        input.addEventListener('change', () => {
          notify({ reactionSize: Number(input.value) });
        });
      };

      const bindSpark = () => {
        content.querySelector('[data-spark-enabled]').addEventListener('change', (event) => {
          notify({ sparkEnabled: event.target.checked });
          paint();
        });
        content.querySelectorAll('[data-spark-icon]').forEach((button) => {
          button.addEventListener('click', () => {
            notify({ sparkIcon: button.dataset.sparkIcon });
            paint();
            if (button.dataset.sparkIcon === 'custom') {
              content.querySelector('[data-spark-svg]')?.focus();
            }
          });
        });
        content.querySelector('[data-apply-spark]')?.addEventListener('click', () => {
          const input = content.querySelector('[data-spark-svg]');
          const raw = input.value.trim();
          if (!raw) {
            toast('粘贴一段 SVG 代码', { tone: 'danger' });
            input.focus();
            return;
          }
          const svg = sanitizeSvgIcon(raw);
          if (!svg) {
            toast('这段 SVG 无法识别', { tone: 'danger' });
            input.focus();
            return;
          }
          notify({ sparkEnabled: true, sparkIcon: 'custom', sparkSvg: svg });
          paint();
          toast('火花图标已更新');
        });
      };

      const bind = () => {
        if (view === 'root') {
          content.querySelectorAll('[data-open-view]').forEach((button) => {
            button.addEventListener('click', () => openView(button.dataset.openView));
          });
          content.querySelector('[data-open-favorites]')?.addEventListener('click', () => {
            window.location.hash = `#/favorites?from=${character.id}`;
          });
          content.querySelector('[data-memory]')?.addEventListener('click', () => {
            window.location.hash = `#/memory/${character.id}`;
          });
          content.querySelector('[data-reset-chat-settings]')?.addEventListener('click', () => {
            notify({ ...DEFAULT_CHAT_STYLE });
            paint();
            toast('已恢复默认设置');
          });
          content.querySelector('[data-show-status]')?.addEventListener('change', (event) => {
            notify({ showStatus: event.target.checked });
          });
          content.querySelector('[data-time-awareness]')?.addEventListener('change', (event) => {
            const enabled = event.target.checked;
            notify({ timeAwareness: enabled });
            paint();
            toast(enabled ? '时间感知已开启' : '时间感知已关闭');
          });
          return;
        }

        if (view === 'send') {
          content.querySelectorAll('[data-set-mode]').forEach((button) => {
            button.addEventListener('click', () => {
              notify({ sendMode: button.dataset.setMode });
              paint();
            });
          });
          return;
        }

        if (view === 'composer') {
          content.querySelectorAll('[data-set-composer]').forEach((button) => {
            button.addEventListener('click', () => {
              notify({ composerStyle: button.dataset.setComposer });
              paint();
            });
          });
          return;
        }

        if (view === 'loading') {
          content.querySelectorAll('[data-set-loading]').forEach((button) => {
            button.addEventListener('click', () => {
              notify({ loadingStyle: button.dataset.setLoading });
              paint();
            });
          });
          return;
        }

        if (view === 'speed') {
          const speed = content.querySelector('[data-speed]');
          const output = content.querySelector('[data-speed-output]');
          speed.addEventListener('input', () => {
            const seconds = Number(speed.value) / 1000;
            output.textContent = seconds.toFixed(3);
            speed.closest('.range-row').querySelector('output').textContent =
              `${seconds.toFixed(3)}s`;
            applyLocal({ typingSpeed: seconds });
          });
          speed.addEventListener('change', () => {
            notify({ typingSpeed: Number(speed.value) / 1000 });
          });
          return;
        }

        if (view === 'animation') {
          bindAnimation();
          return;
        }

        if (view === 'bubble') {
          bindBubble();
          return;
        }

        if (view === 'background') {
          bindBackgroundView();
          return;
        }

        if (view === 'avatar') {
          bindAvatar();
          return;
        }

        if (view === 'packet') {
          bindPacket();
          return;
        }

        if (view === 'stickers') {
          bindStickers();
          return;
        }

        if (view === 'reaction') {
          bindReaction();
          return;
        }

        if (view === 'spark') {
          bindSpark();
          return;
        }

        if (view === 'about') {
          content
            .querySelector('[data-preference-auto]')
            ?.addEventListener('change', (event) => {
              const enabled = event.target.checked;
              updateMemorySettings(character.id, {
                preferenceEvery: enabled ? 4 : 0,
              });
              paint();
              toast(
                enabled
                  ? `${character.name}会悄悄记住你说过的小事`
                  : '已停止自动整理',
              );
            });
          const frequency = content.querySelector('[data-preference-frequency]');
          const frequencyOutput = content.querySelector('[data-preference-output]');
          frequency?.addEventListener('input', () => {
            if (frequencyOutput) {
              frequencyOutput.textContent = `每 ${frequency.value} 次回复`;
            }
          });
          frequency?.addEventListener('change', () => {
            const every = Number(frequency.value);
            updateMemorySettings(character.id, { preferenceEvery: every });
            toast(`每 ${every} 次回复整理一次`);
          });
          content
            .querySelector('[data-add-preference]')
            ?.addEventListener('click', () => openPreferenceSheet());
          content.querySelectorAll('[data-preference]').forEach((button) => {
            button.addEventListener('click', () => {
              const pref = (getChatMemory(character.id).preferences || []).find(
                (item) => item.id === button.dataset.preference,
              );
              if (pref) openPreferenceSheet(pref);
            });
          });
        }
      };

      tabs.querySelectorAll('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          tab = button.dataset.tab;
          view = 'root';
          presetFormOpen = false;
          paint();
          body.scrollTop = 0;
        });
      });

      screen.querySelector('[data-settings-back]').addEventListener('click', (event) => {
        if (view === 'root') return;
        event.preventDefault();
        view = 'root';
        presetFormOpen = false;
        paint();
        body.scrollTop = 0;
      });

      paint();

      getRecentMessages(character.id, 200)
        .then((messages) => {
          streakDays = chatStreakDays(messages);
          streakLoaded = true;
          if (view === 'spark') paint();
        })
        .catch(() => {});

  return { element: screen };
}
