export const FONT_SIZE_OPTIONS = [
  { value: 'sm', label: '小', meta: '更紧凑' },
  { value: 'md', label: '标准', meta: '推荐' },
  { value: 'lg', label: '大', meta: '更易读' },
];

export const COLOR_MODE_OPTIONS = [
  { value: 'system', label: '跟随系统', icon: 'monitor' },
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon-stars' },
];

export const FONT_SIZE_LABELS = Object.fromEntries(
  FONT_SIZE_OPTIONS.map((option) => [option.value, option.label]),
);

export const COLOR_MODE_LABELS = Object.fromEntries(
  COLOR_MODE_OPTIONS.map((option) => [option.value, option.label]),
);
