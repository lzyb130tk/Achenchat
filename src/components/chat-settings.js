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
  deleteBubblePreset,
  getBubblePresets,
  getChatMemory,
  getConversation,
  getStickerPacks,
  updateBubblePreset,
  updateChatStyle,
  updateStickerPack,
} from '../services/store.js';
import {
  chatStreakDays,
  escapeHTML,
  sanitizeSvgIcon,
} from '../services/utils.js';
import { characterAvatar } from './avatar.js';
import { icon } from './icons.js';
import { toast } from './toast.js';

const BACKGROUND_PREVIEWS = {
  default: '#f4efe8',
  warm: 'linear-gradient(150deg, #f7e6cd, #efd0ad)',
  night: 'linear-gradient(150deg, #33302d, #1d1b19)',
  dawn: 'linear-gradient(150deg, #e8eeeb, #cfdcd7)',
};

const VIEW_TITLES = {
  send: '发送方式',
  speed: '打字速度',
  animation: '消息动效',
  bubble: '气泡样式',
  background: '聊天背景',
  avatar: '头像',
  packet: '红包样式',
  stickers: '表情包',
  spark: '连续火花',
};

export function applyChatStyle(screen, style) {
  screen.style.setProperty('--chat-avatar-size', `${style.avatarSize}px`);
  screen.style.setProperty('--chat-avatar-radius', `${style.avatarRadius}%`);
  screen.style.setProperty('--chat-message-gap', `${style.messageGap}px`);
  screen.dataset.chatBackground = style.background || 'default';
  if (style.bubbleCss) screen.dataset.customBubble = '';
  else delete screen.dataset.customBubble;
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

export function createChatSettingsPage({ character, style }) {
  let current = { ...style };
  let tab = 'general';
  let view = 'root';
  let presetFormOpen = false;
  let editingPresetId = null;
  let presetDraft = { name: '', css: '' };

  const screen = document.createElement('section');
  screen.className = 'screen screen--chat-settings';
  screen.innerHTML = `
    <header class="chat-settings-page__header">
      <a class="icon-button" href="#/chat/${character.id}" aria-label="返回聊天">${icon('arrow-left')}</a>
      <h1>聊天设置</h1>
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
          return `<section class="chat-settings__group">
            <h3 class="chat-settings__group-label">互动</h3>
            <div class="chat-settings__list">
              <button class="chat-settings__row" type="button" data-open-view="stickers">
                <span class="chat-settings__row-icon">${icon('sticker')}</span>
                <span class="chat-settings__row-label">表情包</span>
                <span class="chat-settings__row-value">${enabled}/${packs.length} 组</span>
                <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
              </button>
              <button class="chat-settings__row" type="button" data-open-view="spark">
                <span class="chat-settings__row-icon">${icon('flame')}</span>
                <span class="chat-settings__row-label">连续火花</span>
                <span class="chat-settings__row-value">${sparkLabel(current)}</span>
                <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
              </button>
              <button class="chat-settings__row" type="button" data-open-view="packet">
                <span class="chat-settings__row-icon">${icon('envelope-simple')}</span>
                <span class="chat-settings__row-label">红包样式</span>
                <span class="chat-settings__row-value">${packetLabel(current)}</span>
                <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
              </button>
            </div>
          </section>
          <section class="chat-settings__group">
            <h3 class="chat-settings__group-label">记忆</h3>
            <div class="chat-settings__list">
              <button class="chat-settings__row" type="button" data-memory>
                <span class="chat-settings__row-icon">${icon('brain')}</span>
                <span class="chat-settings__row-label">聊天记忆</span>
                <span class="chat-settings__row-value">${memory.items.length} 条</span>
                <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
              </button>
            </div>
          </section>`;
        }

        return `<section class="chat-settings__group">
          <h3 class="chat-settings__group-label">发送</h3>
          <div class="chat-settings__list">
            <button class="chat-settings__row" type="button" data-open-view="send">
              <span class="chat-settings__row-icon">${icon('paper-plane-tilt')}</span>
              <span class="chat-settings__row-label">发送方式</span>
              <span class="chat-settings__row-value">${current.sendMode === 'multi' ? '多条' : '单条'}</span>
              <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="speed">
              <span class="chat-settings__row-icon">${icon('keyboard')}</span>
              <span class="chat-settings__row-label">打字速度</span>
              <span class="chat-settings__row-value">${speedLabel(current.typingSpeed)}</span>
              <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="animation">
              <span class="chat-settings__row-icon">${icon('sparkle')}</span>
              <span class="chat-settings__row-label">消息动效</span>
              <span class="chat-settings__row-value">${animationLabel(current)}</span>
              <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
            </button>
          </div>
        </section>
        <section class="chat-settings__group">
          <h3 class="chat-settings__group-label">外观</h3>
          <div class="chat-settings__list">
            <button class="chat-settings__row" type="button" data-open-view="bubble">
              <span class="chat-settings__row-icon">${icon('chat-circle-text')}</span>
              <span class="chat-settings__row-label">气泡样式</span>
              <span class="chat-settings__row-value">${bubbleLabel(current)}</span>
              <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="background">
              <span class="chat-settings__row-icon">${icon('image')}</span>
              <span class="chat-settings__row-label">聊天背景</span>
              <span class="chat-settings__row-value">${backgroundLabel(current)}</span>
              <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
            </button>
            <button class="chat-settings__row" type="button" data-open-view="avatar">
              <span class="chat-settings__row-icon">${icon('user-circle')}</span>
              <span class="chat-settings__row-label">头像</span>
              <span class="chat-settings__row-value">${current.avatarSize}px · ${current.avatarRadius}%</span>
              <span class="chat-settings__row-chevron">${icon('caret-right')}</span>
            </button>
          </div>
        </section>
        <button class="chat-settings-page__reset" type="button" data-reset-chat-settings>
          <span>${icon('arrow-counter-clockwise')}恢复默认设置</span>
          ${icon('caret-right')}
        </button>`;
      };

      const sendMarkup = () => `<p class="settings-note">长按输入框右侧的发送按钮，也可以随时切换。</p>
        <div class="choice-list">
          <button class="choice-card${current.sendMode === 'single' ? ' is-selected' : ''}" type="button" data-set-mode="single">
            <span class="choice-card__icon">${icon('paper-plane-tilt')}</span>
            <span class="choice-card__copy"><strong>单条</strong><small>发送后立刻请求回复</small></span>
            <span class="choice-card__check">${icon('check')}</span>
          </button>
          <button class="choice-card${current.sendMode === 'multi' ? ' is-selected' : ''}" type="button" data-set-mode="multi">
            <span class="choice-card__icon">${icon('stack')}</span>
            <span class="choice-card__copy"><strong>多条</strong><small>先把话说完，再点输入框左侧的「接收」</small></span>
            <span class="choice-card__check">${icon('check')}</span>
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
        <p class="settings-note">数字越小，消息出现得越快。多条消息之间也会按这个速度停顿。</p>`;

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
                  ${!custom && current.animationId === preset.id ? `<span class="preset-row__current">${icon('check')}</span>` : ''}
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
          <button class="text-button text-button--small" type="button" data-copy-animation>${icon('copy')}复制默认代码</button>`;
      };

      const bubbleMarkup = () => `<div class="subsection-head"><h4>消息形式</h4></div>
        <div class="choice-list">
          <button class="choice-card${current.messageGroup !== 'each' ? ' is-selected' : ''}" type="button" data-message-group="group">
            <span class="choice-card__icon">${icon('stack')}</span>
            <span class="choice-card__copy"><strong>连续气泡</strong><small>一个头像带几条消息，气泡连在一起</small></span>
            <span class="choice-card__check">${icon('check')}</span>
          </button>
          <button class="choice-card${current.messageGroup === 'each' ? ' is-selected' : ''}" type="button" data-message-group="each">
            <span class="choice-card__icon">${icon('chats-circle')}</span>
            <span class="choice-card__copy"><strong>逐条气泡</strong><small>每条消息单独一个气泡和一个头像</small></span>
            <span class="choice-card__check">${icon('check')}</span>
          </button>
        </div>
        <label class="range-row">
          <span class="range-row__top"><span>消息间隔</span><output data-gap-output>${current.messageGap}px</output></span>
          <input class="range" type="range" min="0" max="16" step="1" value="${current.messageGap}" data-message-gap>
        </label>
        <p class="settings-note">同一位连续消息之间的间距，越大越疏朗。</p>
        <p class="settings-note">同时替换你和${character.name}的气泡。类名：<span class="code-hint">.message-bubble--assistant</span> / <span class="code-hint">.message-bubble--user</span></p>
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
        </label>
        <div class="inline-buttons">
          <button class="small-button small-button--solid" type="button" data-apply-bubble>应用</button>
          <button class="small-button" type="button" data-reset-bubble>恢复默认</button>
        </div>
        <button class="text-button text-button--small" type="button" data-copy-bubble>${icon('copy')}复制默认 CSS</button>
        <div class="subsection-head">
          <h4>预设</h4>
          <button class="text-button" type="button" data-add-preset>新增</button>
        </div>
        <div class="preset-list" data-preset-list>${presetListMarkup(current)}</div>
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

      const packetMarkup = () => {
        const custom = Boolean(current.packetCss);
        return `<div class="packet-settings-preview">
            <div class="red-packet-card is-preview">
              <span class="red-packet-card__icon">${icon('envelope-simple', 'fill')}</span>
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
                  ${!custom && current.packetPresetId === preset.id ? `<span class="preset-row__current">${icon('check')}</span>` : ''}
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
          <button class="text-button text-button--small" type="button" data-copy-packet>${icon('copy')}复制默认代码</button>`;
      };

      const stickersMarkup = () => `<div data-sticker-list>${stickerListMarkup()}</div>`;

      const sparkMarkup = () => {
        const custom = current.sparkIcon === 'custom';
        const conversation = getConversation(character.id);
        const streak = chatStreakDays(conversation?.messages || []);
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
              ${icon('code')}<span>SVG</span>
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
        if (view === 'speed') return speedMarkup();
        if (view === 'animation') return animationMarkup();
        if (view === 'bubble') return bubbleMarkup();
        if (view === 'background') return backgroundMarkupView();
        if (view === 'avatar') return avatarMarkup();
        if (view === 'packet') return packetMarkup();
        if (view === 'stickers') return stickersMarkup();
        if (view === 'spark') return sparkMarkup();
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
        paintTabs();
        content.innerHTML =
          view === 'root'
            ? rootMarkup()
            : `<div class="settings-subnav">
                <button class="settings-subnav__back" type="button" data-settings-back>${icon('arrow-left')}返回</button>
                <h3>${VIEW_TITLES[view] || '聊天设置'}</h3>
              </div>${subviewMarkup()}`;
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
        const gap = content.querySelector('[data-message-gap]');
        const gapOutput = content.querySelector('[data-gap-output]');

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
        content.querySelector('[data-settings-back]')?.addEventListener('click', () => {
          view = 'root';
          presetFormOpen = false;
          paint();
          body.scrollTop = 0;
        });

        if (view === 'root') {
          content.querySelectorAll('[data-open-view]').forEach((button) => {
            button.addEventListener('click', () => openView(button.dataset.openView));
          });
          content.querySelector('[data-memory]')?.addEventListener('click', () => {
            window.location.hash = `#/memory/${character.id}`;
          });
          content.querySelector('[data-reset-chat-settings]')?.addEventListener('click', () => {
            notify({ ...DEFAULT_CHAT_STYLE });
            paint();
            toast('已恢复默认设置');
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

        if (view === 'spark') {
          bindSpark();
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

      paint();
  return { element: screen };
}
