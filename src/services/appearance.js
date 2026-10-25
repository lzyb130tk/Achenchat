const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function resolveColorMode(colorMode) {
  if (colorMode === 'light' || colorMode === 'dark') return colorMode;
  return darkQuery.matches ? 'dark' : 'light';
}

export function applyAppearance(appearance) {
  const theme = resolveColorMode(appearance.colorMode);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.fontSize = appearance.fontSize;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#171411' : '#f4efe8');
  }
}

export function watchSystemTheme(getAppearance) {
  darkQuery.addEventListener('change', () => {
    const appearance = getAppearance();
    if (appearance.colorMode === 'system') applyAppearance(appearance);
  });
}
