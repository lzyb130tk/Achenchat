export const DEFAULT_CHAT_STYLE = {
  bubbleCss: '',
  presetId: 'default',
  background: 'default',
  backgroundImage: '',
  avatarSize: 28,
  avatarRadius: 50,
  showUserAvatar: false,
};

export const CHAT_BACKGROUNDS = [
  { id: 'default', name: '默认' },
  { id: 'warm', name: '暖光' },
  { id: 'night', name: '夜色' },
  { id: 'dawn', name: '晨雾' },
];

export const DEFAULT_BUBBLE_PRESETS = [
  {
    id: 'cream',
    name: '奶油',
    css: 'background:#fdf5e9;color:#3a2b21;border-radius:18px;box-shadow:0 1px 2px rgba(70,45,25,.06);',
  },
  {
    id: 'night',
    name: '夜色',
    css: 'background:#2f2721;color:#f8efe3;border-radius:18px;',
  },
  {
    id: 'glass',
    name: '玻璃',
    css: 'background:rgba(255,255,255,.5);color:#2c221b;border-radius:18px;border:1px solid rgba(255,255,255,.7);backdrop-filter:blur(10px);',
  },
];
