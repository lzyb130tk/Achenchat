import { closeActiveSheet } from './components/sheet.js';
import { mountStatusBar } from './components/status-bar.js';
import { renderApiConfig } from './pages/api-config.js';
import { renderChat } from './pages/chat.js';
import { renderContacts } from './pages/contacts.js';
import { renderDiscover } from './pages/discover.js';
import { renderMasks } from './pages/masks.js';
import { renderMe } from './pages/me.js';
import { renderMessages } from './pages/messages.js';
import { renderMoments } from './pages/moments.js';
import { renderSettings } from './pages/settings.js';
import { renderShake } from './pages/shake.js';
import { renderShop } from './pages/shop.js';
import { renderStickers } from './pages/stickers.js';
import { renderWallet } from './pages/wallet.js';
import { applyAppearance, watchSystemTheme } from './services/appearance.js';
import { getAppearance, getCharacter } from './services/store.js';

const ROUTES = [
  { pattern: /^\/messages\/?$/, title: '消息', render: renderMessages },
  { pattern: /^\/contacts\/?$/, title: '联系人', render: renderContacts },
  { pattern: /^\/discover\/?$/, title: '发现', render: renderDiscover },
  { pattern: /^\/me\/?$/, title: '我', render: renderMe },
  { pattern: /^\/settings\/?$/, title: '设置', render: renderSettings },
  { pattern: /^\/settings\/api\/?$/, title: 'API 配置', render: renderApiConfig },
  { pattern: /^\/wallet\/?$/, title: '钱包', render: renderWallet },
  { pattern: /^\/shop\/?$/, title: '小店', render: renderShop },
  { pattern: /^\/stickers\/?$/, title: '表情', render: renderStickers },
  { pattern: /^\/masks\/?$/, title: '面具', render: renderMasks },
  { pattern: /^\/moments\/?$/, title: '朋友圈', render: renderMoments },
  { pattern: /^\/shake\/?$/, title: '摇一摇', render: renderShake },
  {
    pattern: /^\/chat\/([^/]+)\/?$/,
    title: null,
    render: ({ refresh, match }) => renderChat({ characterId: match[1], refresh }),
  },
];

let activePage = null;
let started = false;

function currentPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/messages';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function resolveRoute(path) {
  for (const route of ROUTES) {
    const match = path.match(route.pattern);
    if (match) return { route, match };
  }
  return null;
}

function renderCurrent({ isRefresh = false } = {}) {
  const path = currentPath();
  const resolved = resolveRoute(path);

  if (!resolved) {
    window.location.replace(`${window.location.pathname}${window.location.search}#/messages`);
    return;
  }

  if (!isRefresh) closeActiveSheet({ immediate: true, reason: 'navigate' });

  const { route, match } = resolved;
  const refresh = () => renderCurrent({ isRefresh: true });

  activePage?.cleanup?.();
  activePage = null;

  const page = route.render({ refresh, match });
  if (!page) {
    window.location.replace(`${window.location.pathname}${window.location.search}#/messages`);
    return;
  }

  activePage = page;
  const view = document.getElementById('view');
  view.replaceChildren(page.element);

  const character = match ? getCharacter(match[1]) : null;
  const title = route.title || character?.name;
  document.title = title ? `${title} · Achat` : 'Achat';
  document.documentElement.dataset.route = path;
}

function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) {
    renderCurrent({ isRefresh: true });
    return;
  }
  if (replace) window.location.replace(`${window.location.pathname}${window.location.search}${target}`);
  else window.location.hash = target;
}

function watchBrokenImages() {
  document.addEventListener(
    'error',
    (event) => {
      if (event.target instanceof HTMLImageElement) event.target.classList.add('is-broken');
    },
    true,
  );
}

export function startApp() {
  if (started) return;
  started = true;

  if (!window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/messages`);
  }

  mountStatusBar();
  watchBrokenImages();
  applyAppearance(getAppearance());
  watchSystemTheme(getAppearance);
  renderCurrent();

  window.addEventListener('hashchange', () => {
    renderCurrent();
  });

  window.addEventListener('popstate', () => {
    if (!window.location.hash) navigate('/messages', { replace: true });
  });
}
