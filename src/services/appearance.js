import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  THEME_PRESETS,
  colorChroma,
  contrastInk,
  mixHex,
  normalizeHexColor,
  themePreset,
  themeSurfaces,
} from './preferences.js';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function resolveColorMode(colorMode) {
  if (colorMode === 'light' || colorMode === 'dark') return colorMode;
  return darkQuery.matches ? 'dark' : 'light';
}

export function applyAppearance(appearance) {
  const theme = resolveColorMode(appearance.colorMode);
  const dark = theme === 'dark';
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.fontSize = appearance.fontSize;

  const primary = normalizeHexColor(appearance.primaryColor) || DEFAULT_PRIMARY_COLOR;
  const accent = normalizeHexColor(appearance.accentColor) || DEFAULT_ACCENT_COLOR;
  const preset = themePreset(appearance.themePreset) || THEME_PRESETS[0];
  const palette = themeSurfaces(preset.id, dark ? 'dark' : 'light');

  // In dark mode keep the chosen hue but raise it to a visible tone, the way
  // Material's dark palette uses lighter primary tones.
  const action = dark ? mixHex(primary, '#ffffff', 0.24) : primary;
  const accentTone = dark ? mixHex(accent, '#ffffff', 0.18) : accent;

  root.style.setProperty('--theme-primary', primary);
  root.style.setProperty('--theme-accent', accentTone);
  root.style.setProperty('--theme-action', action);
  root.style.setProperty('--theme-action-ink', contrastInk(action));
  root.style.setProperty('--theme-accent-ink', contrastInk(accentTone));

  // Each preset ships its own neutral ramp. Custom colours borrow that ramp;
  // a chromatic primary gently tints it instead of replacing it.
  const tint =
    primary !== preset.primary && colorChroma(primary) >= 24 ? 0.04 : 0;
  const surface = (key) =>
    tint ? mixHex(palette[key], primary, tint) : palette[key];

  root.style.setProperty('--theme-surface', surface('surface'));
  root.style.setProperty('--theme-bg', surface('bg'));
  root.style.setProperty('--theme-surface-soft', surface('soft'));
  root.style.setProperty('--theme-surface-muted', surface('muted'));
  root.style.setProperty('--theme-line', surface('line'));
  root.style.setProperty('--theme-line-strong', surface('lineStrong'));
  root.style.setProperty('--theme-nav', surface('nav'));
  root.style.setProperty('--theme-backdrop', surface('backdrop'));

  const customTheme =
    preset.id !== 'default' ||
    primary !== preset.primary ||
    accent !== preset.accent;
  root.toggleAttribute('data-custom-theme', customTheme);

  const glassEnabled = appearance.glassEnabled !== false;
  const glassBlur = Number.isFinite(Number(appearance.glassBlur))
    ? Math.min(30, Math.max(0, Math.round(Number(appearance.glassBlur))))
    : 18;
  root.dataset.glass = glassEnabled ? 'on' : 'off';
  root.style.setProperty('--glass-blur', `${glassBlur}px`);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', surface('bg'));
}

export function watchSystemTheme(getAppearance) {
  darkQuery.addEventListener('change', () => {
    const appearance = getAppearance();
    if (appearance.colorMode === 'system') applyAppearance(appearance);
  });
}
