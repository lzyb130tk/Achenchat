const TAG_NAMES = 'status|msg|redbag|sticker|tagline';
// Models slip on the protocol now and then, writing [ msg ], [/msg] or 【msg】.
// Accept those spellings so a stray space never swallows a whole reply.
const TAG_SOURCE = String.raw`[\[【]\s*(\/|／)?\s*(${TAG_NAMES})\s*[\]】]`;
const TAG_TOKEN_PATTERN = new RegExp(TAG_SOURCE, 'gi');
const TAG_TOKEN_SEARCH = new RegExp(TAG_SOURCE, 'i');
const PARTIAL_TAG_PATTERN = /[\[【][^\[\]【】]*$/;

function findTokens(raw) {
  const tokens = [];
  TAG_TOKEN_PATTERN.lastIndex = 0;
  let match;
  while ((match = TAG_TOKEN_PATTERN.exec(raw))) {
    tokens.push({
      tag: match[2].toLowerCase(),
      closing: Boolean(match[1]),
      start: match.index,
      end: TAG_TOKEN_PATTERN.lastIndex,
    });
  }
  return tokens;
}

function cleanStatus(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 24);
}

function cleanTagline(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 24);
}

function lastOpening(tokens, tag) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (token.tag === tag && !token.closing) return token;
  }
  return null;
}

function statusFrom(tokens, blocks, raw) {
  const lastBlock = blocks.filter((block) => block.tag === 'status').at(-1);
  const complete = lastBlock ? cleanStatus(lastBlock.content) : '';
  if (complete) return complete;
  // Still streaming, or the closing tag never arrived: read what follows the
  // last opening tag instead of showing nothing.
  const partial = lastOpening(tokens, 'status');
  if (!partial) return complete;
  const rest = raw.slice(partial.end);
  const next = rest.search(TAG_TOKEN_SEARCH);
  return cleanStatus(next >= 0 ? rest.slice(0, next) : rest.split(/[\[【]/)[0]);
}

export function readStatus(raw) {
  const source = typeof raw === 'string' ? raw : '';
  const tokens = findTokens(source);
  const { blocks } = collectBlocks(tokens, source);
  return statusFrom(tokens, blocks, source);
}

function splitSegments(value) {
  return value
    .split('\\')
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectBlocks(tokens, raw) {
  const blocks = [];
  const open = new Map();
  for (const token of tokens) {
    const current = open.get(token.tag);
    if (current) {
      blocks.push({
        tag: token.tag,
        content: raw.slice(current.contentStart, token.start),
        from: current.tokenStart,
        to: token.end,
      });
      open.delete(token.tag);
      if (token.closing) continue;
    } else if (token.closing) {
      continue;
    }
    open.set(token.tag, { contentStart: token.end, tokenStart: token.start });
  }
  return { blocks, open };
}

// A reply cut off mid-stream leaves its last [msg] open. Keep whatever fits
// before the next tag (or the end) instead of dropping those messages.
function recoverOpenBlocks(open, tokens, raw) {
  const recovered = [];
  for (const [tag, start] of open) {
    if (tag !== 'msg' && tag !== 'redbag') continue;
    const next = tokens.find((token) => token.start >= start.contentStart);
    const content = raw
      .slice(start.contentStart, next ? next.start : raw.length)
      .replace(PARTIAL_TAG_PATTERN, '')
      .trim();
    if (!content) continue;
    recovered.push({ tag, content, from: start.tokenStart, to: raw.length });
  }
  return recovered.sort((a, b) => a.from - b.from);
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
  const tokens = findTokens(source);
  const { blocks, open } = collectBlocks(tokens, source);
  const status = statusFrom(tokens, blocks, source);
  const taglineBlock = [...blocks].reverse().find((block) => block.tag === 'tagline');
  const tagline = taglineBlock ? cleanTagline(taglineBlock.content) : '';
  const segments = [];
  const stickerByName = new Map(
    stickers
      .filter((sticker) => sticker?.name && sticker?.url)
      .map((sticker) => [String(sticker.name).trim(), sticker]),
  );

  const ordered = [...blocks, ...recoverOpenBlocks(open, tokens, source)].sort(
    (a, b) => a.from - b.from,
  );

  for (const block of ordered) {
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
