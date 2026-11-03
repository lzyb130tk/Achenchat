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

/* --------------------------------------------------------------------------
   Theme colours
   -------------------------------------------------------------------------- */

export const DEFAULT_PRIMARY_COLOR = '#444449';
export const DEFAULT_ACCENT_COLOR = '#646464';

export const THEME_PRESETS = [
  {
    id: 'default',
    name: '灰白',
    meta: '默认',
    primary: DEFAULT_PRIMARY_COLOR,
    accent: DEFAULT_ACCENT_COLOR,
    surfaces: {
      light: {
        bg: '#f7f7f7',
        surface: '#ffffff',
        soft: '#f2f2f2',
        muted: '#eeeeee',
        line: '#e8e8e8',
        lineStrong: '#d6d6d6',
        nav: '#fafafa',
        backdrop: '#e9e9e9',
      },
      dark: {
        bg: '#171717',
        surface: '#242424',
        soft: '#2d2d2d',
        muted: '#363636',
        line: '#383838',
        lineStrong: '#505050',
        nav: '#1d1d1d',
        backdrop: '#111111',
      },
    },
  },
  {
    id: 'notion',
    name: 'Notion',
    meta: '纸白 · 中性',
    primary: '#37352f',
    accent: '#2383e2',
    surfaces: {
      light: {
        bg: '#f7f6f3',
        surface: '#ffffff',
        soft: '#f1efeb',
        muted: '#e9e7e2',
        line: '#e4e1db',
        lineStrong: '#d3cfc8',
        nav: '#fbfaf8',
        backdrop: '#e6e3dd',
      },
      dark: {
        bg: '#191919',
        surface: '#202020',
        soft: '#252525',
        muted: '#2d2d2d',
        line: '#333333',
        lineStrong: '#454545',
        nav: '#1b1b1b',
        backdrop: '#0e0e0e',
      },
    },
  },
  {
    id: 'ios',
    name: 'iOS',
    meta: '系统蓝',
    primary: '#0a84ff',
    accent: '#ff9f0a',
    surfaces: {
      light: {
        bg: '#f2f2f7',
        surface: '#ffffff',
        soft: '#ebebf0',
        muted: '#e2e2e8',
        line: '#d8d8df',
        lineStrong: '#c5c5cd',
        nav: '#f8f8fb',
        backdrop: '#e3e3ea',
      },
      dark: {
        bg: '#000000',
        surface: '#1c1c1e',
        soft: '#2c2c2e',
        muted: '#3a3a3c',
        line: '#38383a',
        lineStrong: '#48484a',
        nav: '#0b0b0c',
        backdrop: '#000000',
      },
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    meta: '深海蓝',
    primary: '#4d6bfe',
    accent: '#8b5cf6',
    surfaces: {
      light: {
        bg: '#f5f7fd',
        surface: '#ffffff',
        soft: '#eef2fb',
        muted: '#e4e9f6',
        line: '#e2e7f4',
        lineStrong: '#ccd5ec',
        nav: '#fafbff',
        backdrop: '#e3e8f4',
      },
      dark: {
        bg: '#101318',
        surface: '#171b23',
        soft: '#1d222c',
        muted: '#262c38',
        line: '#2a3140',
        lineStrong: '#3a4457',
        nav: '#12161d',
        backdrop: '#0a0c10',
      },
    },
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    meta: '朱红',
    primary: '#ff2442',
    accent: '#ff8a00',
    surfaces: {
      light: {
        bg: '#fff7f7',
        surface: '#ffffff',
        soft: '#fdf0f0',
        muted: '#f8e6e6',
        line: '#f2e2e2',
        lineStrong: '#e4cccc',
        nav: '#fffafa',
        backdrop: '#f5e8e8',
      },
      dark: {
        bg: '#171213',
        surface: '#201819',
        soft: '#271d1f',
        muted: '#322427',
        line: '#382a2d',
        lineStrong: '#4a383c',
        nav: '#1a1415',
        backdrop: '#0b0909',
      },
    },
  },
];

export function themePreset(presetId) {
  return THEME_PRESETS.find((item) => item.id === presetId) || null;
}

export function themePresetLabel(presetId) {
  return themePreset(presetId)?.name || '自定义';
}

export function themeSurfaces(presetId, theme = 'light') {
  const preset = themePreset(presetId) || THEME_PRESETS[0];
  return preset.surfaces[theme === 'dark' ? 'dark' : 'light'];
}

export function themePresetSummary(appearance) {
  const preset = themePreset(appearance?.themePreset) || THEME_PRESETS[0];
  const primary = normalizeHexColor(appearance?.primaryColor);
  const accent = normalizeHexColor(appearance?.accentColor);
  const tuned =
    primary && accent && (primary !== preset.primary || accent !== preset.accent);
  return tuned ? `${preset.name} · 调色` : preset.name;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb) {
  return `#${rgb
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Accepts `#rgb`, `#rrggbb`, `rgb(r, g, b)` and `rgb(r g b)` and always
 * returns a lower-case `#rrggbb` value, or null when the input is unusable. */
export function parseColorInput(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;

  const hex = input.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((char) => char + char)
            .join('')
        : hex[1];
    return `#${raw.toLowerCase()}`;
  }

  const rgb = input.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i,
  );
  if (rgb) {
    return rgbToHex(rgb.slice(1, 4).map(Number));
  }

  return null;
}

export function normalizeHexColor(value) {
  return parseColorInput(value);
}

export function colorChroma(hex) {
  const [r, g, b] = hexToRgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function channelLuminance(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function colorLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** Picks a readable ink for a coloured button/bubble background. */
export function contrastInk(hex) {
  const luminance = colorLuminance(hex);
  const againstWhite = 1.05 / (luminance + 0.05);
  return againstWhite >= 3 ? '#ffffff' : '#1d1915';
}

export function mixHex(base, tint, amount) {
  const ratio = Math.max(0, Math.min(1, amount));
  const a = hexToRgb(base);
  const b = hexToRgb(tint);
  return rgbToHex(a.map((channel, index) => channel * (1 - ratio) + b[index] * ratio));
}

