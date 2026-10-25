export const CHAT_BACKGROUNDS = [
  { id: 'default', name: '默认' },
  { id: 'warm', name: '暖光' },
  { id: 'night', name: '夜色' },
  { id: 'dawn', name: '晨雾' },
];

export const DEFAULT_BUBBLE_CSS = `.message-bubble--assistant {
  background: var(--color-surface);
  color: var(--color-ink);
  border-radius: 19px;
}

.message-bubble--user {
  background: var(--color-action);
  color: var(--color-action-ink);
  border-radius: 19px;
}`;

export const DEFAULT_BUBBLE_PRESETS = [
  {
    id: 'cream',
    name: '奶油',
    css: `.message-bubble--assistant {
  background: #fdf5e9;
  color: #3a2b21;
  border-radius: 18px 18px 18px 6px;
}

.message-bubble--user {
  background: #34271f;
  color: #fff6e9;
  border-radius: 18px 18px 6px 18px;
}`,
  },
  {
    id: 'dusk',
    name: '暮色',
    css: `.message-bubble--assistant {
  background: #2f2721;
  color: #f8efe3;
  border-radius: 18px 18px 18px 6px;
}

.message-bubble--user {
  background: #e9cdbb;
  color: #2f221a;
  border-radius: 18px 18px 6px 18px;
}`,
  },
  {
    id: 'paper',
    name: '纸笺',
    css: `.message-bubble--assistant {
  background: #fffdf9;
  color: #2b241e;
  border: 1px solid rgba(55, 42, 32, 0.12);
  border-radius: 18px 18px 18px 5px;
}

.message-bubble--user {
  background: #f2ded5;
  color: #422b21;
  border: 1px solid rgba(185, 84, 62, 0.16);
  border-radius: 18px 18px 5px 18px;
}`,
  },
];

export const DEFAULT_PACKET_CSS = `.red-packet-card {
  background: linear-gradient(145deg, #b7513d, #a24231);
  color: #fff6ec;
  border-radius: 15px;
}

.red-packet-card__icon {
  background: rgba(255, 246, 236, 0.15);
}

.red-packet-card__copy small {
  color: rgba(255, 246, 236, 0.7);
}

.red-packet-card.is-claimed {
  background: linear-gradient(145deg, #c69070, #b17d60);
}`;

export const PACKET_PRESETS = [
  {
    id: 'warm',
    name: '暖红',
    css: DEFAULT_PACKET_CSS,
  },
  {
    id: 'cream',
    name: '奶油',
    css: `.red-packet-card {
  background: #f3e3ce;
  color: #5b3a27;
  border-radius: 15px;
}

.red-packet-card__icon {
  background: rgba(123, 78, 49, 0.1);
  color: #8c5b3d;
}

.red-packet-card__copy small {
  color: rgba(91, 58, 39, 0.62);
}

.red-packet-card.is-claimed {
  background: #ead9c3;
}`,
  },
  {
    id: 'ink',
    name: '墨色',
    css: `.red-packet-card {
  background: #2c241e;
  color: #f7ead9;
  border-radius: 15px;
}

.red-packet-card__icon {
  background: rgba(247, 234, 217, 0.1);
}

.red-packet-card__copy small {
  color: rgba(247, 234, 217, 0.58);
}

.red-packet-card.is-claimed {
  background: #43362c;
}`,
  },
];

export const MESSAGE_ANIMATIONS = [
  {
    id: 'fade',
    name: '淡入',
    css: `@keyframes achat-message-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.message-row.is-new {
  animation: achat-message-fade 240ms var(--ease-out) both;
}`,
  },
  {
    id: 'rise',
    name: '上浮',
    css: `@keyframes achat-message-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-row.is-new {
  animation: achat-message-rise 320ms var(--ease-out) both;
}`,
  },
  {
    id: 'pop',
    name: '轻弹',
    css: `@keyframes achat-message-pop {
  from { opacity: 0; transform: translateY(5px) scale(0.965); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.message-row.is-new {
  animation: achat-message-pop 360ms var(--ease-out) both;
}`,
  },
  {
    id: 'slide',
    name: '侧滑',
    css: `@keyframes achat-message-slide {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: translateX(0); }
}

.message-row.is-new {
  animation: achat-message-slide 320ms var(--ease-out) both;
}`,
  },
  {
    id: 'soft',
    name: '舒展',
    css: `@keyframes achat-message-soft {
  from { opacity: 0; transform: translateY(3px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.message-row.is-new {
  animation: achat-message-soft 400ms var(--ease-out) both;
}`,
  },
];

export const DEFAULT_ANIMATION_CSS = MESSAGE_ANIMATIONS[0].css;

export const DEFAULT_MEMORY = {
  contextCount: 24,
  summaryEvery: 0,
  roundsSinceSummary: 0,
  categories: ['喜好', '日常', '约定'],
  items: [],
  lastSummaryAt: 0,
};

export const SPARK_ICONS = [
  {
    id: 'flame',
    name: '火苗',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.2 21c3.9 0 6.3-2.6 6.3-6.1 0-2.8-1.6-5-3.8-7.2-.4 2.1-1.3 3.3-2.4 4.1.3-3.4-1.1-6.2-3.5-8.3.2 4-2.8 6.2-2.8 10.3 0 4 2.6 7.2 6.2 7.2Z" fill="currentColor"/><path d="M12.1 18.5c1.5 0 2.4-1 2.4-2.4 0-1.2-.8-2.1-1.7-2.9-.1 1-.6 1.6-1.1 1.9-.1-1.4-.7-2.3-1.4-2.9-.1 1.6-.7 2.5-.7 4-.1 1.4.9 2.3 2.5 2.3Z" fill="var(--color-surface)"/></svg>`,
  },
  {
    id: 'heart',
    name: '心跳',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 20.2c-.4 0-.8-.2-1.1-.4C7.2 16.7 3.5 13.5 3.5 9.4c0-2.6 1.9-4.6 4.4-4.6 1.7 0 3.1.9 4.1 2.3 1-1.4 2.4-2.3 4.1-2.3 2.5 0 4.4 2 4.4 4.6 0 4.1-3.7 7.3-7.4 10.4-.3.2-.7.4-1.1.4Z" fill="currentColor"/></svg>`,
  },
  {
    id: 'spark',
    name: '星芒',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.8c.5 4.5 2.8 6.8 7.2 7.2-4.4.5-6.7 2.8-7.2 7.2-.5-4.4-2.8-6.7-7.2-7.2 4.4-.4 6.7-2.7 7.2-7.2Z" fill="currentColor"/><path d="M18.4 15.2c.2 1.8 1.1 2.7 2.9 2.9-1.8.2-2.7 1.1-2.9 2.9-.2-1.8-1.1-2.7-2.9-2.9 1.8-.2 2.7-1.1 2.9-2.9Z" fill="currentColor" opacity=".55"/></svg>`,
  },
  {
    id: 'moon',
    name: '月牙',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.7 15.1A8.5 8.5 0 0 1 8.9 4.3 8.5 8.5 0 1 0 19.7 15.1Z" fill="currentColor"/><path d="M17.8 4.3c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3Z" fill="currentColor" opacity=".55"/></svg>`,
  },
  {
    id: 'clover',
    name: '四叶',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 11.1C10.8 9.8 8 9.4 6.7 8.1 5.1 6.5 6 3.6 8.1 3.1c2.1-.5 3.7 1.2 3.9 3.4.2-2.2 1.8-3.9 3.9-3.4 2.1.5 3 3.4 1.4 5-1.3 1.3-4.1 1.7-5.3 3Z" fill="currentColor" opacity=".82"/><path d="M12.9 11.9c1.3-1.2 1.7-4 3-5.3 1.6-1.6 4.5-.7 5 .4.5 2.1-1.2 3.7-3.4 3.9 2.2.2 3.9 1.8 3.4 3.9-.5 2.1-3.4 3-5 1.4-1.3-1.3-1.7-4.1-3-5.3Z" fill="currentColor" opacity=".66"/><path d="M11.9 12.9c1.2 1.3 1.6 4.1 2.9 5.4 1.6 1.6.7 4.5-1.4 5-2.1.5-3.7-1.2-3.9-3.4-.2 2.2-1.8 3.9-3.9 3.4-2.1-.5-3-3.4-1.4-5 1.3-1.3 4.1-1.7 5.4-2.9Z" fill="currentColor" opacity=".5"/><path d="M11.1 11.9c-1.3 1.2-4.1 1.6-5.4 2.9-1.6 1.6-4.5.7-5-1.4-.5-2.1 1.2-3.7 3.4-3.9-2.2-.2-3.9-1.8-3.4-3.9.5-2.1 3.4-3 5-1.4 1.3 1.3 1.7 4.1 3 5.3Z" fill="currentColor" opacity=".34"/></svg>`,
  },
  {
    id: 'drop',
    name: '水滴',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.9c3.4 4.6 6.2 7.9 6.2 11.4a6.2 6.2 0 0 1-12.4 0c0-3.5 2.8-6.8 6.2-11.4Z" fill="currentColor"/><path d="M9.1 13.2c0 2 1.1 3.4 2.9 4" fill="none" stroke="var(--color-surface)" stroke-width="1.5" stroke-linecap="round" opacity=".6"/></svg>`,
  },
  {
    id: 'sun',
    name: '暖阳',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.3v2.4M12 19.3v2.4M2.3 12h2.4M19.3 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M18.9 5.1l-1.7 1.7M6.8 17.2l-1.7 1.7"/></g></svg>`,
  },
  {
    id: 'diamond',
    name: '棱光',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.1 3.5h9.8L21 9l-9 11.5L3 9l4.1-5.5Z" fill="currentColor" opacity=".28"/><path d="M7.1 3.5h9.8L21 9l-9 11.5L3 9l4.1-5.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3.4 9h17.2M7.4 3.7 9 9l3 11.2L15 9l1.6-5.3M9 9h6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" opacity=".8"/></svg>`,
  },
];

export const DEFAULT_CHAT_STYLE = {
  bubbleCss: '',
  presetId: 'default',
  packetCss: '',
  packetPresetId: 'warm',
  animationId: 'fade',
  animationCss: '',
  typingSpeed: 0.035,
  sendMode: 'single',
  messageGroup: 'group',
  messageGap: 4,
  background: 'default',
  backgroundImage: '',
  avatarSize: 28,
  avatarRadius: 50,
  showUserAvatar: false,
  sparkEnabled: false,
  sparkIcon: 'flame',
  sparkSvg: '',
};

export function getSparkSvg(style) {
  if (style?.sparkIcon === 'custom' && style.sparkSvg?.trim()) {
    return style.sparkSvg.trim();
  }
  return (
    SPARK_ICONS.find((item) => item.id === style?.sparkIcon)?.svg ||
    SPARK_ICONS[0].svg
  );
}

export function getAnimationCss(style) {
  if (style?.animationCss?.trim()) return style.animationCss.trim();
  return (
    MESSAGE_ANIMATIONS.find((item) => item.id === style?.animationId)?.css ||
    DEFAULT_ANIMATION_CSS
  );
}

export function getPacketCss(style) {
  if (style?.packetCss?.trim()) return style.packetCss.trim();
  return (
    PACKET_PRESETS.find((item) => item.id === style?.packetPresetId)?.css ||
    DEFAULT_PACKET_CSS
  );
}
