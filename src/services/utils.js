export function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = Math.max(0, now.getTime() - timestamp);
  if (diff < 60000) return '刚刚';
  if (startOfDay(now) === startOfDay(date)) {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
  if (startOfDay(now) - startOfDay(date) === 86400000) return '昨天';
  if (now.getTime() - timestamp < 6 * 86400000) {
    return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

export function formatChatDay(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  if (startOfDay(now) === startOfDay(date)) return '今天';
  if (startOfDay(now) - startOfDay(date) === 86400000) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date);
}

export function isSameDay(a, b) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMoney(fen) {
  return `¥${(Math.max(0, fen) / 100).toFixed(2)}`;
}

export function formatMoneyDelta(fen, type = '') {
  const sign = type === 'redpacket-out' ? '−' : '+';
  return `${sign}${formatMoney(fen)}`;
}

export function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  if (startOfDay(now) === startOfDay(date)) return `今天 ${time}`;
  if (startOfDay(now) - startOfDay(date) === 86400000) return `昨天 ${time}`;
  return `${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)} ${time}`;
}

export function messagePreview(message) {
  if (!message) return '';
  if (message.type === 'redpacket') return '[红包] 恭喜发财，大吉大利';
  if (message.type === 'sticker') {
    return message.name ? `[表情] ${message.name}` : '[表情]';
  }
  return message.content || '';
}

export function firstNameMark(name) {
  return Array.from(String(name || '你').trim() || '你').slice(-1)[0];
}

export function chatStreakDays(messages, now = Date.now()) {
  const days = new Set();
  for (const message of messages || []) {
    if (!Number.isFinite(message?.createdAt)) continue;
    const date = new Date(message.createdAt);
    date.setHours(0, 0, 0, 0);
    days.add(date.getTime());
  }
  if (!days.size) return 0;

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.getTime())) return 0;
  }

  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'defs',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'title',
]);

const SVG_ATTRIBUTES = new Set([
  'viewBox',
  'preserveAspectRatio',
  'fill',
  'fill-rule',
  'fill-opacity',
  'clip-rule',
  'clip-path',
  'clipPathUnits',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'paint-order',
  'vector-effect',
  'opacity',
  'transform',
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'points',
  'width',
  'height',
  'id',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
]);

function safeSvgAttribute(value) {
  const source = String(value || '').trim();
  if (!source) return true;
  if (/url\(\s*['"]?(?!#)/i.test(source)) return false;
  return !/javascript:/i.test(source);
}

export function sanitizeSvgIcon(raw) {
  if (typeof raw !== 'string') return '';
  const source = raw.trim();
  if (!source || source.length > 8000) return '';
  if (!/^<svg[\s>]/i.test(source)) return '';
  if (typeof DOMParser === 'undefined') return '';

  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return '';
  const svg = doc.documentElement;
  if (svg?.nodeName?.toLowerCase() !== 'svg') return '';

  for (const node of [...svg.querySelectorAll('*')]) {
    if (!SVG_ELEMENTS.has(node.nodeName)) {
      node.remove();
      continue;
    }
    for (const attribute of [...node.attributes]) {
      if (
        !SVG_ATTRIBUTES.has(attribute.name) ||
        !safeSvgAttribute(attribute.value)
      ) {
        node.removeAttribute(attribute.name);
      }
    }
  }
  for (const attribute of [...svg.attributes]) {
    if (
      !SVG_ATTRIBUTES.has(attribute.name) ||
      !safeSvgAttribute(attribute.value)
    ) {
      svg.removeAttribute(attribute.name);
    }
  }

  if (!svg.getAttribute('viewBox')) {
    const width = Number.parseFloat(svg.getAttribute('width'));
    const height = Number.parseFloat(svg.getAttribute('height'));
    svg.setAttribute(
      'viewBox',
      width > 0 && height > 0 ? `0 0 ${width} ${height}` : '0 0 24 24',
    );
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const serialized = new XMLSerializer().serializeToString(svg);
  return serialized.includes('<svg') ? serialized : '';
}

