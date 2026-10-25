import { closeActiveSheet } from './components/sheet.js';
import { getCharacter } from './data/characters.js';
import { renderApiConfig } from './pages/api-config.js';
import { renderChat } from './pages/chat.js';
import { renderContacts } from './pages/contacts.js';
import { renderDiscover } from './pages/discover.js';
import { renderMe } from './pages/me.js';
import { renderMessages } from './pages/messages.js';
import { renderSettings } from './pages/settings.js';
import { applyAppearance, watchSystemTheme } from './services/appearance.js';
import { getAppearance } from './services/store.js';

const ROUTES = [
  { pattern: /^\/messages\/?$/, title: '消息', render: renderMessages },
  { pattern: /^\/contacts\/?$/, title: '联系人', render: renderContacts },
  { pattern: /^\/discover\/?$/, title: '发现', render: renderDiscover },
  { pattern: /^\/me\/?$/, title: '我', render: renderMe },
  { pattern: /^\/settings\/?$/, title: '设置', render: renderSettings },
  { pattern: /^\/settings\/api\/?$/, title: 'API 配置', render: renderApiConfig },
  {
    pattern: /^\/chat\/([^/]+)\/?$/,
    title: null,
    render: ({ refresh, match }) => renderChat({ characterId: match[1], refresh }),
  },
];

let activePage = null;

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

  if (!isRefresh) closeActiveSheet({ immediate: true });

  const { route, match } = resolved;
  const refresh = () => renderCurrent({ isRefresh: true });
  const page = route.render({ refresh, match });

  if (!page) {
    window.location.replace(`${window.location.pathname}${window.location.search}#/messages`);
    return;
  }

  activePage?.cleanup?.();
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

export function startApp() {
  if (!window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/messages`);
  }

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
