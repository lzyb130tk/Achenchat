const TAG_PATTERN = /\[(status|msg|redbag)\]/gi;
const TAG_TOKEN_PATTERN = /\[\/?(?:status|msg|redbag)\]/gi;

function cleanStatus(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 24);
}

export function readStatus(raw) {
  const source = typeof raw === 'string' ? raw : '';
  const start = source.toLowerCase().indexOf('[status]');
  if (start < 0) return '';
  const rest = source.slice(start + 8);
  const closing = rest.search(/\[\/?status\]/i);
  const value = closing >= 0 ? rest.slice(0, closing) : rest.split('[')[0];
  return cleanStatus(value);
}

function splitSegments(value) {
  return value
    .split('\\')
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectBlocks(raw) {
  const blocks = [];
  const open = new Map();
  TAG_PATTERN.lastIndex = 0;
  let match;
  while ((match = TAG_PATTERN.exec(raw))) {
    const tag = match[1].toLowerCase();
    if (!open.has(tag)) {
      open.set(tag, { contentStart: TAG_PATTERN.lastIndex, tokenStart: match.index });
      continue;
    }
    const start = open.get(tag);
    blocks.push({
      tag,
      content: raw.slice(start.contentStart, match.index),
      from: start.tokenStart,
      to: TAG_PATTERN.lastIndex,
    });
    open.delete(tag);
  }
  return blocks;
}

function plainFallback(raw, blocks) {
  let plain = raw;
  const statusBlocks = blocks
    .filter((block) => block.tag === 'status')
    .sort((a, b) => b.from - a.from);
  for (const block of statusBlocks) {
    plain = `${plain.slice(0, block.from)} ${plain.slice(block.to)}`;
  }
  return plain.replace(TAG_TOKEN_PATTERN, ' ').trim();
}

function parseAmount(content) {
  const dash = content.indexOf('-');
  const amountText = (dash >= 0 ? content.slice(0, dash) : content)
    .replace(/[¥￥,\s]/g, '')
    .trim();
  const note = (dash >= 0 ? content.slice(dash + 1) : '').trim();
  const yuan = Number.parseFloat(amountText);
  if (!Number.isFinite(yuan) || yuan <= 0) return null;
  const amountFen = Math.round(yuan * 100);
  if (amountFen < 1) return null;
  return {
    amountFen,
    note: note.slice(0, 40) || '恭喜发财，大吉大利',
  };
}

export function parseAIReply(raw) {
  const source = typeof raw === 'string' ? raw : '';
  const blocks = collectBlocks(source);
  const statusBlock = [...blocks].reverse().find((block) => block.tag === 'status');
  const status = statusBlock ? cleanStatus(statusBlock.content) : '';
  const segments = [];

  for (const block of blocks) {
    if (block.tag === 'msg') {
      for (const content of splitSegments(block.content)) {
        segments.push({ type: 'text', content: content.slice(0, 1000) });
      }
      continue;
    }
    if (block.tag === 'redbag') {
      const packet = parseAmount(block.content);
      if (packet) segments.push({ type: 'redpacket', ...packet });
    }
  }

  if (!segments.length) {
    for (const content of splitSegments(plainFallback(source, blocks))) {
      segments.push({ type: 'text', content: content.slice(0, 1000) });
    }
  }

  return { status, segments };
}

export function messageAsText(message) {
  if (!message) return '';
  if (message.type === 'redpacket') {
    return `[红包] ${message.note || '恭喜发财，大吉大利'}`;
  }
  if (message.type === 'sticker') return '[表情]';
  return message.content || '';
}

export function messageLength(message) {
  if (!message) return 0;
  if (message.type === 'redpacket') return (message.note || '').length + 4;
  if (message.type === 'sticker') return 2;
  return (message.content || '').length;
}
