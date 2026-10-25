const TAG_PATTERN = /\[(status|msg|redbag|sticker|tagline)\]/gi;
const TAG_TOKEN_PATTERN = /\[\/?(?:status|msg|redbag|sticker|tagline)\]/gi;

function cleanStatus(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 24);
}

function cleanTagline(value) {
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
  const hiddenBlocks = blocks
    .filter((block) => block.tag === 'status' || block.tag === 'sticker' || block.tag === 'tagline')
    .sort((a, b) => b.from - a.from);
  for (const block of hiddenBlocks) {
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

export function parseAIReply(raw, { stickers = [] } = {}) {
  const source = typeof raw === 'string' ? raw : '';
  const blocks = collectBlocks(source);
  const statusBlock = [...blocks].reverse().find((block) => block.tag === 'status');
  const status = statusBlock ? cleanStatus(statusBlock.content) : '';
  const taglineBlock = [...blocks].reverse().find((block) => block.tag === 'tagline');
  const tagline = taglineBlock ? cleanTagline(taglineBlock.content) : '';
  const segments = [];
  const stickerByName = new Map(
    stickers
      .filter((sticker) => sticker?.name && sticker?.url)
      .map((sticker) => [String(sticker.name).trim(), sticker]),
  );

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
      continue;
    }
    if (block.tag === 'sticker') {
      const name = block.content.replace(/\s+/g, ' ').trim().slice(0, 20);
      const sticker = stickerByName.get(name);
      if (sticker) {
        segments.push({
          type: 'sticker',
          url: sticker.url,
          name: sticker.name,
          packName: sticker.packName,
        });
      }
    }
  }

  if (!segments.length) {
    for (const content of splitSegments(plainFallback(source, blocks))) {
      segments.push({ type: 'text', content: content.slice(0, 1000) });
    }
  }

  return { status, tagline, segments };
}

export function messageAsText(message) {
  if (!message) return '';
  if (message.type === 'redpacket') {
    return `[红包] ${message.note || '恭喜发财，大吉大利'}`;
  }
  if (message.type === 'sticker') {
    return message.name ? `[表情：${message.name}]` : '[表情]';
  }
  return message.content || '';
}

export function messageLength(message) {
  if (!message) return 0;
  if (message.type === 'redpacket') return (message.note || '').length + 4;
  if (message.type === 'sticker') return 4 + (message.name || '').length;
  return (message.content || '').length;
}
