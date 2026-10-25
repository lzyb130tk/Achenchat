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
  if (message.type === 'sticker') return '[表情]';
  return message.content || '';
}

export function firstNameMark(name) {
  return Array.from(String(name || '你').trim() || '你').slice(-1)[0];
}

