export const CHAT_BACKGROUNDS = [
  { id: 'default', name: '默认' },
  { id: 'warm', name: '暖光' },
  { id: 'night', name: '夜色' },
  { id: 'dawn', name: '晨雾' },
];

export const DEFAULT_BUBBLE_CSS = `.message-bubble--assistant {
  background: var(--color-surface);
  color: var(--color-ink);
  border-radius: 19px 19px 19px 6px;
}

.message-bubble--user {
  background: var(--color-action);
  color: var(--color-action-ink);
  border-radius: 19px 19px 6px 19px;
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
  categories: ['喜好', '日常', '约定'],
  items: [],
  lastSummaryAt: 0,
};

export const DEFAULT_CHAT_STYLE = {
  bubbleCss: '',
  presetId: 'default',
  packetCss: '',
  packetPresetId: 'warm',
  animationId: 'fade',
  animationCss: '',
  typingSpeed: 0.035,
  sendMode: 'single',
  background: 'default',
  backgroundImage: '',
  avatarSize: 28,
  avatarRadius: 50,
  showUserAvatar: false,
};

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
