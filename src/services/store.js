import { CHARACTERS } from '../data/characters.js';
import {
  DEFAULT_BUBBLE_PRESETS,
  DEFAULT_CHAT_STYLE,
  DEFAULT_MEMORY,
  PACKET_PRESETS,
  SPARK_ICONS,
} from '../data/chat-options.js';
import { createSeedConversations, DEFAULT_PROFILE } from '../data/seed.js';
import { generateShopIncome, getShopType, localDayKey, nextNoon } from '../data/shop.js';
import { dbGet, dbSet } from './db.js';
import {
  dbGetAllImages,
  dbGetAllMessages,
  dbGetMessage,
  dbGetMessagePage,
  dbGetMessagesSince,
  dbGetRecentMessages,
  dbPutImage,
  dbPutMessage,
  dbPutMessages,
  dbDeleteMessage,
  dbDeleteMessages,
  dbDeleteMessagesForCharacter,
  dbCountMessages,
  dbGetImage,
  dbClearAllData,
  dbClearMessagesAndImages,
} from './db.js';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  THEME_PRESETS,
  normalizeHexColor,
} from './preferences.js';
import { sanitizeSvgIcon } from './utils.js';

const DB_KEY = 'state';
const LEGACY_KEY = 'achat.state.v1';
const TONES = ['apricot', 'sage', 'rose', 'sky', 'sand'];

const DEFAULT_API = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
};

const DEFAULT_APPEARANCE = {
  colorMode: 'system',
  fontSize: 'md',
  themePreset: 'default',
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  glassEnabled: true,
  glassBlur: 18,
};

const DEFAULT_TAGS = [
  { id: 'lover', name: '恋人', order: 0 },
  { id: 'friend', name: '朋友', order: 1 },
];

let state = null;
let writeChain = Promise.resolve();
let writeQueued = false;

const STATE_SCHEMA = 2;
const MAX_IMAGES_PER_MESSAGE = 9;

function makeId(prefix) {
  const value =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function lastMark(name) {
  return Array.from(text(name).trim() || '你').slice(-1)[0];
}

function randomTone() {
  return TONES[Math.floor(Math.random() * TONES.length)];
}

function createDefaultMask(source = DEFAULT_PROFILE) {
  return {
    id: 'mask-me',
    name: text(source?.name).trim() || '你',
    signature: text(source?.signature),
    persona: text(source?.persona),
    avatar: text(source?.avatar),
    createdAt: finite(source?.createdAt, Date.now()),
  };
}

function wrapLegacyBubbleCss(value) {
  const css = text(value).trim();
  if (!css || css.includes('{')) return css;
  return `.message-bubble--assistant,
.message-bubble--user {
  ${css}
}`;
}

function createChatStyle(raw = {}) {
  const background = ['default', 'warm', 'night', 'dawn'].includes(raw.background)
    ? raw.background
    : DEFAULT_CHAT_STYLE.background;
  const speed = finite(raw.typingSpeed, DEFAULT_CHAT_STYLE.typingSpeed);
  const packetPresetId = PACKET_PRESETS.some((item) => item.id === raw.packetPresetId)
    ? raw.packetPresetId
    : DEFAULT_CHAT_STYLE.packetPresetId;
  const sparkIcon =
    raw.sparkIcon === 'custom' || SPARK_ICONS.some((item) => item.id === raw.sparkIcon)
      ? raw.sparkIcon
      : DEFAULT_CHAT_STYLE.sparkIcon;
  return {
    bubbleCss: wrapLegacyBubbleCss(raw.bubbleCss),
    presetId: text(raw.presetId, DEFAULT_CHAT_STYLE.presetId),
    packetCss: text(raw.packetCss),
    packetPresetId,
    animationId: text(raw.animationId, DEFAULT_CHAT_STYLE.animationId),
    animationCss: text(raw.animationCss),
    typingSpeed: Math.round(Math.min(0.12, Math.max(0.005, speed)) * 1000) / 1000,
    sendMode: raw.sendMode === 'multi' ? 'multi' : 'single',
    composerStyle: raw.composerStyle === 'raised' ? 'raised' : 'default',
    composerPlaceholder: text(raw.composerPlaceholder).trim().slice(0, 80),
    typingText: text(raw.typingText).trim().slice(0, 80),
    loadingStyle: raw.loadingStyle === 'header' ? 'header' : 'bubble',
    messageGroup: raw.messageGroup === 'each' ? 'each' : 'group',
    messageGap: Math.min(16, Math.max(0, Math.round(finite(raw.messageGap, DEFAULT_CHAT_STYLE.messageGap)))),
    background,
    backgroundImage: text(raw.backgroundImage),
    avatarSize: Math.min(48, Math.max(20, Math.round(finite(raw.avatarSize, 28)))),
    avatarRadius: Math.min(50, Math.max(0, Math.round(finite(raw.avatarRadius, 50)))),
    reactionSize: Math.min(40, Math.max(14, Math.round(finite(raw.reactionSize, 20)))),
    showUserAvatar: Boolean(raw.showUserAvatar),
    showStatus: raw.showStatus !== false,
    timeAwareness: Boolean(raw.timeAwareness),
    sparkEnabled: Boolean(raw.sparkEnabled),
    sparkIcon,
    sparkSvg: sanitizeSvgIcon(raw.sparkSvg),
  };
}

function normalizeQuote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const content = text(raw.content).trim().slice(0, 500);
  if (!content) return null;
  return {
    messageId: text(raw.messageId).slice(0, 120),
    role: raw.role === 'assistant' ? 'assistant' : 'user',
    name: text(raw.name).trim().slice(0, 40) || '对方',
    content,
  };
}

function preferenceKey(content) {
  return text(content)
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, '')
    .replace(/[。！？!?，,、；;：:"'“”‘’]/g, '');
}

function normalizePreferences(raw) {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set();
  const seenContent = new Set();
  const items = [];
  for (const entry of raw) {
    const content = text(
      typeof entry === 'string' ? entry : entry?.content ?? entry?.text,
    )
      .trim()
      .slice(0, 160);
    if (!content) continue;
    const key = preferenceKey(content);
    if (!key || seenContent.has(key)) continue;
    seenContent.add(key);
    let id = text(entry?.id);
    if (!id || seenIds.has(id)) id = makeId('pref');
    seenIds.add(id);
    const createdAt = finite(entry?.createdAt, Date.now());
    items.push({
      id,
      content,
      source: entry?.source === 'auto' ? 'auto' : 'manual',
      createdAt,
      updatedAt: finite(entry?.updatedAt, createdAt),
    });
  }
  return items.slice(-80);
}

function normalizeMemory(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const categorySet = new Set(DEFAULT_MEMORY.categories);
  if (Array.isArray(source.categories)) {
    source.categories.forEach((category) => {
      const value = text(category).trim().slice(0, 16);
      if (value) categorySet.add(value);
    });
  }
  const seen = new Set();
  const items = Array.isArray(source.items)
    ? source.items
        .map((item) => {
          const content = text(item?.content).trim().slice(0, 600);
          if (!content) return null;
          const category = text(item?.category).trim().slice(0, 16) || '其他';
          categorySet.add(category);
          let id = text(item?.id);
          if (!id || seen.has(id)) id = makeId('memory');
          seen.add(id);
          return {
            id,
            category,
            content,
            source: item?.source === 'auto' ? 'auto' : 'manual',
            createdAt: finite(item?.createdAt, Date.now()),
          };
        })
        .filter(Boolean)
        .slice(-300)
    : [];
  const contextCount = Math.min(
    120,
    Math.max(2, Math.round(finite(source.contextCount, DEFAULT_MEMORY.contextCount))),
  );
  const rawEvery = Math.round(finite(source.summaryEvery, DEFAULT_MEMORY.summaryEvery));
  const summaryEvery = rawEvery <= 0 ? 0 : Math.min(200, Math.max(1, rawEvery));
  const rawPreferenceEvery = Math.round(
    finite(source.preferenceEvery, DEFAULT_MEMORY.preferenceEvery),
  );
  const preferenceEvery =
    rawPreferenceEvery <= 0 ? 0 : Math.min(50, Math.max(1, rawPreferenceEvery));
  return {
    contextCount,
    summaryEvery,
    roundsSinceSummary: Math.min(
      1000,
      Math.max(
        0,
        Math.round(
          finite(source.roundsSinceSummary, DEFAULT_MEMORY.roundsSinceSummary),
        ),
      ),
    ),
    categories: [...categorySet].slice(0, 24),
    items,
    lastSummaryAt: Math.max(0, finite(source.lastSummaryAt)),
    preferences: normalizePreferences(source.preferences),
    preferenceEvery,
    preferenceRounds: Math.min(
      1000,
      Math.max(
        0,
        Math.round(
          finite(source.preferenceRounds, DEFAULT_MEMORY.preferenceRounds),
        ),
      ),
    ),
    lastPreferenceAt: Math.max(0, finite(source.lastPreferenceAt)),
  };
}

function normalizeConversationStatus(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const value = text(raw.text).trim().slice(0, 32);
  if (!value) return null;
  return { text: value, at: finite(raw.at, Date.now()) };
}

function createWelcomeWallet() {
  return {
    balanceFen: 18800,
    transactions: [
      {
        id: 'welcome',
        type: 'initial',
        amountFen: 18800,
        label: '初始零钱',
        createdAt: Date.now(),
      },
    ],
  };
}

function createEmptyWallet() {
  return { balanceFen: 0, transactions: [] };
}

function createDefaultState({ seeded = true, emptyWallet = false } = {}) {
  return {
    version: 2,
    schema: STATE_SCHEMA,
    settings: {
      api: { ...DEFAULT_API },
      appearance: { ...DEFAULT_APPEARANCE },
    },
    masks: [createDefaultMask()],
    activeMaskId: 'mask-me',
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag })),
    customCharacters: [],
    hiddenCharacters: [],
    characterOverrides: {},
    conversations: seeded ? createSeedConversations() : {},
    wallet: emptyWallet ? createEmptyWallet() : createWelcomeWallet(),
    shop: null,
    stickerPacks: [],
    bubblePresets: DEFAULT_BUBBLE_PRESETS.map((preset) => ({ ...preset })),
    likedMoments: [],
    favorites: [],
  };
}

const MAX_REACTIONS_PER_MESSAGE = 3;

export function normalizeReactions(raw) {
  if (!Array.isArray(raw)) return [];
  const reactions = [];
  const seen = new Set();
  for (const item of raw) {
    const emoji = text(item?.emoji).trim().slice(0, 16);
    if (!emoji) continue;
    const by = item?.by === 'assistant' ? 'assistant' : 'user';
    const key = `${by}:${emoji}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reactions.push({ emoji, by });
  }
  return reactions.slice(-MAX_REACTIONS_PER_MESSAGE);
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.createdAt)) return null;
  if (raw.role !== 'user' && raw.role !== 'assistant') return null;

  const reactions = normalizeReactions(raw.reactions);
  const reactionField = reactions.length ? { reactions } : {};
  const type =
    raw.type === 'redpacket' || raw.type === 'sticker' || raw.type === 'image'
      ? raw.type
      : 'text';
  const quote = normalizeQuote(raw.quote);
  const rawField = text(raw.raw).trim() ? { raw: text(raw.raw).slice(0, 4000) } : {};
  const meta = {};
  if (typeof raw.characterId === 'string') meta.characterId = raw.characterId;
  if (Number.isFinite(raw.seq)) meta.seq = Math.max(1, Math.round(raw.seq));
  if (type === 'image') {
    const images = Array.isArray(raw.images)
      ? raw.images
          .map((image) => ({
            id: text(image?.id),
            width: Math.max(1, Math.round(finite(image?.width, 1))),
            height: Math.max(1, Math.round(finite(image?.height, 1))),
          }))
          .filter((image) => image.id)
          .slice(0, MAX_IMAGES_PER_MESSAGE)
      : [];
    if (!images.length) return null;
    return {
      id: text(raw.id, makeId('image-message')),
      role: raw.role,
      type,
      images,
      content: text(raw.content).slice(0, 500),
      ...(quote ? { quote } : {}),
      ...reactionField,
      ...rawField,
      ...meta,
      createdAt: raw.createdAt,
    };
  }
  if (type === 'redpacket') {
    const amountFen = Math.round(finite(raw.amountFen));
    if (amountFen <= 0) return null;
    return {
      id: text(raw.id, makeId('packet')),
      role: raw.role,
      type,
      amountFen,
      note: text(raw.note, '恭喜发财，大吉大利'),
      claimed: Boolean(raw.claimed),
      claimedAt: Number.isFinite(raw.claimedAt) ? raw.claimedAt : null,
      ...(quote ? { quote } : {}),
      ...reactionField,
      ...rawField,
      ...meta,
      createdAt: raw.createdAt,
    };
  }

  if (type === 'sticker') {
    const url = text(raw.url);
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) return null;
    return {
      id: text(raw.id, makeId('sticker')),
      role: raw.role,
      type,
      url,
      packName: text(raw.packName),
      name: text(raw.name).trim().slice(0, 20),
      ...(quote ? { quote } : {}),
      ...reactionField,
      ...rawField,
      ...meta,
      createdAt: raw.createdAt,
    };
  }

  return {
    id: text(raw.id, makeId('message')),
    role: raw.role,
    type: 'text',
    content: text(raw.content),
    ...(quote ? { quote } : {}),
    ...reactionField,
    ...rawField,
    ...meta,
    createdAt: raw.createdAt,
  };
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const legacyMessages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage).filter(Boolean)
    : [];
  const lastMessage =
    normalizeMessage(raw.lastMessage) || legacyMessages[legacyMessages.length - 1] || null;
  const messageCount = Math.max(
    0,
    Math.round(finite(raw.messageCount, legacyMessages.length)),
  );
  return {
    unread: Math.max(0, Math.round(finite(raw.unread))),
    pinned: Boolean(raw.pinned),
    multiSentCount: Math.max(0, Math.min(999, Math.round(finite(raw.multiSentCount)))),
    maskIds: Array.isArray(raw.maskIds) ? raw.maskIds.filter((id) => typeof id === 'string') : [],
    messageCount,
    lastSeq: Math.max(
      messageCount,
      Math.round(finite(raw.lastSeq, messageCount)),
      Math.round(finite(lastMessage?.seq, 0)),
    ),
    lastMessage,
    style: createChatStyle(raw.style),
    memory: normalizeMemory(raw.memory),
    status: normalizeConversationStatus(raw.status),
  };
}

function normalizeTags(raw) {
  if (!Array.isArray(raw)) return DEFAULT_TAGS.map((tag) => ({ ...tag }));
  const seen = new Set();
  return raw
    .map((tag, index) => {
      const id = text(tag?.id);
      const name = text(tag?.name).trim();
      if (!id || !name || seen.has(id)) return null;
      seen.add(id);
      return { id, name, order: finite(tag?.order, index) };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function normalizeMasks(raw, legacyProfile) {
  const source = Array.isArray(raw) && raw.length ? raw : [legacyProfile || DEFAULT_PROFILE];
  const seen = new Set();
  return source
    .map((mask, index) => {
      const name = text(mask?.name).trim();
      if (!name) return null;
      let id = text(mask?.id) || `mask-${index + 1}`;
      if (seen.has(id)) id = makeId('mask');
      seen.add(id);
      return {
        id,
        name,
        signature: text(mask?.signature),
        persona: text(mask?.persona),
        avatar: text(mask?.avatar),
        createdAt: finite(mask?.createdAt, Date.now()),
      };
    })
    .filter(Boolean);
}

function normalizeCustomCharacters(raw, tagIds) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .map((character) => {
      const name = text(character?.name).trim();
      if (!name) return null;
      let id = text(character?.id);
      if (!id || seen.has(id)) id = makeId('custom');
      seen.add(id);
      const tagId = tagIds.has(character?.tagId) ? character.tagId : '';
      return {
        id,
        name,
        mark: lastMark(name),
        role: text(character?.role, '新朋友') || '新朋友',
        relationship: text(character?.relationship, '朋友') || '朋友',
        tone: TONES.includes(character?.tone) ? character.tone : randomTone(),
        tagline: text(character?.tagline, '刚刚认识。'),
        persona: text(character?.persona),
        avatar: text(character?.avatar),
        tagId,
        muted: Boolean(character?.muted),
        createdAt: finite(character?.createdAt, Date.now()),
      };
    })
    .filter(Boolean);
}

function normalizeOverrides(raw, characterIds, tagIds) {
  if (!raw || typeof raw !== 'object') return {};
  const result = {};
  for (const [id, override] of Object.entries(raw)) {
    if (!characterIds.has(id) || !override || typeof override !== 'object') continue;
    const item = {};
    if (typeof override.name === 'string' && override.name.trim()) {
      item.name = override.name.trim();
    }
    if (typeof override.persona === 'string') item.persona = override.persona;
    if (typeof override.tagline === 'string') item.tagline = override.tagline;
    if (typeof override.avatar === 'string') item.avatar = override.avatar;
    if (typeof override.tagId === 'string') {
      item.tagId = tagIds.has(override.tagId) ? override.tagId : '';
    }
    if (typeof override.muted === 'boolean') item.muted = override.muted;
    result[id] = item;
  }
  return result;
}

function uniqueStickerName(value, used) {
  const base =
    text(value)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20) || '表情';
  let name = base;
  let index = 2;
  while (used.has(name)) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(name);
  return name;
}

function normalizeStickerItems(rawItems, legacyUrls = []) {
  const items = [];
  const seenUrls = new Set();
  const usedNames = new Set();
  const source = Array.isArray(rawItems)
    ? rawItems
    : Array.isArray(legacyUrls)
      ? legacyUrls.map((url) => ({ url, name: '' }))
      : [];

  for (const item of source) {
    const url = text(item?.url).trim();
    if (!/^https?:\/\//i.test(url) || seenUrls.has(url)) continue;
    seenUrls.add(url);
    items.push({
      url,
      name: uniqueStickerName(item?.name || `表情 ${items.length + 1}`, usedNames),
    });
    if (items.length >= 200) break;
  }
  return items;
}

function normalizeStickerPacks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((pack) => {
      const name = text(pack?.name).trim();
      const items = normalizeStickerItems(pack?.items, pack?.urls);
      if (!name || !items.length) return null;
      return {
        id: text(pack?.id, makeId('pack')),
        name,
        items,
        enabled: pack?.enabled !== false,
        createdAt: finite(pack?.createdAt, Date.now()),
      };
    })
    .filter(Boolean);
}

function normalizeBubblePresets(raw) {
  if (!Array.isArray(raw)) {
    return DEFAULT_BUBBLE_PRESETS.map((preset) => ({ ...preset }));
  }
  return raw
    .map((preset, index) => {
      const name = text(preset?.name).trim();
      const css = wrapLegacyBubbleCss(preset?.css);
      if (!name || !css) return null;
      return {
        id: text(preset?.id) || `bubble-${index + 1}`,
        name,
        css,
      };
    })
    .filter(Boolean);
}

function normalizeFavorite(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Favourites keep their own snapshot of the messages, so deleting the
  // original chat never empties a collection.
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage).filter(Boolean).slice(-120)
    : [];
  if (!messages.length) return null;
  const title = text(raw.title).trim().slice(0, 40);
  return {
    id: text(raw.id, makeId('favorite')),
    title: title || '未命名收藏',
    characterId: text(raw.characterId),
    characterName: text(raw.characterName).trim().slice(0, 40),
    messages,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

function normalizeFavorites(raw) {
  if (!Array.isArray(raw)) return [];
  const counts = new Map();
  return raw.map(normalizeFavorite).filter((favorite) => {
    if (!favorite) return false;
    const count = (counts.get(favorite.characterId) || 0) + 1;
    counts.set(favorite.characterId, count);
    return count <= 300;
  });
}

function normalizeShop(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = getShopType(raw.typeId);
  if (!type || !Number.isFinite(raw.payrollAt)) return null;
  return {
    typeId: type.id,
    openedAt: finite(raw.openedAt, Date.now()),
    payrollAt: raw.payrollAt,
    pendingFen: Math.max(0, Math.round(finite(raw.pendingFen))),
    lastIncomeFen: Math.max(0, Math.round(finite(raw.lastIncomeFen))),
    earlyClaimedAt: Number.isFinite(raw.earlyClaimedAt) ? raw.earlyClaimedAt : null,
    orderHistory: Array.isArray(raw.orderHistory)
      ? raw.orderHistory.filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(item.day) && Number.isFinite(item.wageFen)).slice(-90)
      : [],
  };
}

function normalizeWallet(raw) {
  if (!raw || typeof raw !== 'object') return createWelcomeWallet();
  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions
        .map((item) => {
          const amountFen = Math.round(finite(item?.amountFen));
          if (!Number.isFinite(amountFen)) return null;
          return {
            id: text(item?.id, makeId('tx')),
            type: text(item?.type, 'initial'),
            amountFen,
            label: text(item?.label, '零钱变动'),
            createdAt: finite(item?.createdAt, Date.now()),
          };
        })
        .filter(Boolean)
        .slice(0, 200)
    : [];
  return {
    balanceFen: Math.max(0, Math.round(finite(raw.balanceFen))),
    transactions,
  };
}

function normalizeState(candidate) {
  const fallback = createDefaultState({ seeded: false });
  const tags = normalizeTags(candidate?.tags);
  const tagIds = new Set(tags.map((tag) => tag.id));
  const masks = normalizeMasks(candidate?.masks, candidate?.profile);
  const activeMaskId = masks.some((mask) => mask.id === candidate?.activeMaskId)
    ? candidate.activeMaskId
    : masks[0].id;
  const customCharacters = normalizeCustomCharacters(candidate?.customCharacters, tagIds);
  const hiddenCharacters = Array.isArray(candidate?.hiddenCharacters)
    ? [...new Set(
        candidate.hiddenCharacters.filter(
          (id) => typeof id === 'string' && CHARACTERS.some((character) => character.id === id),
        ),
      )]
    : [];
  const hiddenSet = new Set(hiddenCharacters);
  const characterIds = new Set([
    ...CHARACTERS.map((character) => character.id),
    ...customCharacters.map((character) => character.id),
  ].filter((id) => !hiddenSet.has(id)));
  const characterOverrides = normalizeOverrides(
    candidate?.characterOverrides,
    characterIds,
    tagIds,
  );

  const conversations = {};
  const rawConversations = candidate?.conversations;
  if (rawConversations && typeof rawConversations === 'object') {
    for (const id of characterIds) {
      const conversation = normalizeConversation(rawConversations[id]);
      if (conversation) conversations[id] = conversation;
    }
  }

  const rawAppearance = candidate?.settings?.appearance;
  let primaryColor =
    normalizeHexColor(rawAppearance?.primaryColor) || DEFAULT_APPEARANCE.primaryColor;
  let accentColor =
    normalizeHexColor(rawAppearance?.accentColor) || DEFAULT_APPEARANCE.accentColor;
  const presetIds = THEME_PRESETS.map((preset) => preset.id);
  const themePreset = presetIds.includes(rawAppearance?.themePreset)
    ? rawAppearance.themePreset
    : 'default';
  // Carry untouched legacy defaults into the current palette; preserve
  // colours that users chose individually.
  if (
    themePreset === 'default' &&
    ((primaryColor === '#201c17' && accentColor === '#a94a32') ||
      (primaryColor === '#3b332c' && accentColor === '#9f4a34') ||
      (primaryColor === '#34465c' && accentColor === '#536d8e') ||
      (primaryColor === '#444449' && accentColor === '#626268'))
  ) {
    primaryColor = DEFAULT_APPEARANCE.primaryColor;
    accentColor = DEFAULT_APPEARANCE.accentColor;
  }

  return {
    version: 2,
    schema: STATE_SCHEMA,
    settings: {
      api: {
        ...DEFAULT_API,
        ...(candidate?.settings?.api && typeof candidate.settings.api === 'object'
          ? candidate.settings.api
          : {}),
        model: text(candidate?.settings?.api?.model),
      },
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...(rawAppearance && typeof rawAppearance === 'object' ? rawAppearance : {}),
        colorMode: ['system', 'light', 'dark'].includes(rawAppearance?.colorMode)
          ? rawAppearance.colorMode
          : DEFAULT_APPEARANCE.colorMode,
        fontSize: ['sm', 'md', 'lg'].includes(rawAppearance?.fontSize)
          ? rawAppearance.fontSize
          : DEFAULT_APPEARANCE.fontSize,
        themePreset,
        primaryColor,
        accentColor,
        glassEnabled: rawAppearance?.glassEnabled !== false,
        glassBlur: Math.min(
          30,
          Math.max(
            0,
            Math.round(
              finite(rawAppearance?.glassBlur, DEFAULT_APPEARANCE.glassBlur),
            ),
          ),
        ),
      },
    },
    masks: masks.length ? masks : [createDefaultMask(fallback.masks[0])],
    activeMaskId,
    tags,
    customCharacters,
    hiddenCharacters,
    characterOverrides,
    conversations,
    wallet: normalizeWallet(candidate?.wallet),
    shop: normalizeShop(candidate?.shop),
    stickerPacks: normalizeStickerPacks(candidate?.stickerPacks),
    bubblePresets: normalizeBubblePresets(candidate?.bubblePresets),
    likedMoments: Array.isArray(candidate?.likedMoments)
      ? candidate.likedMoments.filter((id) => typeof id === 'string')
      : [],
    favorites: normalizeFavorites(candidate?.favorites),
  };
}

function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function migrateLegacy(legacy) {
  const base = createDefaultState({ seeded: false });
  return {
    ...base,
    settings: legacy.settings || base.settings,
    masks: [
      createDefaultMask({
        name: legacy.profile?.name,
        signature: legacy.profile?.signature,
        createdAt: legacy.profile?.createdAt,
      }),
    ],
    activeMaskId: 'mask-me',
    conversations: legacy.conversations || {},
  };
}

async function importLegacyMessages(rawConversations) {
  if (!rawConversations || typeof rawConversations !== 'object') return 0;
  let imported = 0;
  for (const [characterId, raw] of Object.entries(rawConversations)) {
    const conversation = state.conversations[characterId];
    if (!conversation) continue;
    const rawMessages = Array.isArray(raw?.messages) ? raw.messages : [];
    if (!rawMessages.length) continue;
    const messages = rawMessages.map(normalizeMessage).filter(Boolean);
    if (!messages.length) continue;
    const records = messages.map((message, index) => ({
      ...message,
      characterId,
      seq: index + 1,
    }));
    await dbPutMessages(records);
    conversation.messageCount = records.length;
    conversation.lastSeq = records.length;
    conversation.lastMessage = records[records.length - 1];
    imported += records.length;
  }
  return imported;
}

export async function initStore() {
  let stored = null;
  try {
    stored = await dbGet(DB_KEY);
  } catch {
    stored = null;
  }

  if (!stored) {
    const legacy = readLegacyState();
    const candidate = legacy ? migrateLegacy(legacy) : createDefaultState();
    state = normalizeState(candidate);
    try {
      await dbClearMessagesAndImages();
      await importLegacyMessages(candidate.conversations);
      await dbSet(DB_KEY, clone(state));
      if (legacy) localStorage.removeItem(LEGACY_KEY);
    } catch {
      // The app keeps running in memory if IndexedDB is unavailable.
    }
  } else {
    state = normalizeState(stored);
    if (stored.schema !== STATE_SCHEMA) {
      try {
        await dbClearMessagesAndImages();
        await importLegacyMessages(stored.conversations);
        state.schema = STATE_SCHEMA;
        await dbSet(DB_KEY, clone(state));
      } catch {
        // Keep whatever was already readable.
      }
    }
  }

  settleShopIncome();
}

function persist() {
  if (!state || writeQueued) return;
  writeQueued = true;
  queueMicrotask(() => {
    writeQueued = false;
    if (!state) return;
    const snapshot = clone(state);
    writeChain = writeChain
      .then(() => dbSet(DB_KEY, snapshot))
      .catch(() => {
        // Keep the in-memory state usable when a write fails.
      });
  });
}

export function getState() {
  return state;
}

/**
 * Waits for queued message/state writes to reach IndexedDB. Reads that must see
 * a just-created message (reply history, page load) await this first.
 */
export function flushMessageWrites() {
  return writeChain.catch(() => {});
}

export function getApiConfig() {
  return state.settings.api;
}

export function saveApiConfig(config) {
  state.settings.api = { ...state.settings.api, ...config };
  persist();
}

export function hasApiConfig() {
  const { apiKey, baseUrl, model } = state.settings.api;
  return Boolean(apiKey.trim() && baseUrl.trim() && model.trim());
}

export function getAppearance() {
  return state.settings.appearance;
}

export function setAppearance(patch) {
  state.settings.appearance = { ...state.settings.appearance, ...patch };
  persist();
}

export function getMasks() {
  return state.masks;
}

export function getActiveMask() {
  return state.masks.find((mask) => mask.id === state.activeMaskId) || state.masks[0];
}

export function getMaskConversationCount(maskId) {
  return Object.values(state.conversations).filter((conversation) => {
    if (conversation.maskIds?.includes(maskId)) return true;
    // Older conversations did not record a mask. Attribute those with user messages to the original mask.
    return !conversation.maskIds?.length
      && maskId === state.masks[0]?.id
      && (conversation.messageCount || 0) > 0;
  }).length;
}

export function getProfile() {
  return getActiveMask();
}

export function setActiveMask(maskId) {
  if (!state.masks.some((mask) => mask.id === maskId)) return false;
  state.activeMaskId = maskId;
  persist();
  return true;
}

export function addMask(data) {
  const name = text(data?.name).trim();
  if (!name) return null;
  const mask = {
    id: makeId('mask'),
    name,
    signature: text(data?.signature),
    persona: text(data?.persona),
    avatar: text(data?.avatar),
    createdAt: Date.now(),
  };
  state.masks.push(mask);
  state.activeMaskId = mask.id;
  persist();
  return mask;
}

export function updateMask(maskId, patch) {
  const mask = state.masks.find((item) => item.id === maskId);
  if (!mask) return null;
  if (typeof patch.name === 'string') {
    const name = patch.name.trim();
    if (!name) return null;
    mask.name = name;
  }
  if (typeof patch.signature === 'string') mask.signature = patch.signature;
  if (typeof patch.persona === 'string') mask.persona = patch.persona;
  if (typeof patch.avatar === 'string') mask.avatar = patch.avatar;
  persist();
  return mask;
}

export function deleteMask(maskId) {
  if (state.masks.length <= 1) return false;
  const index = state.masks.findIndex((mask) => mask.id === maskId);
  if (index < 0) return false;
  state.masks.splice(index, 1);
  if (state.activeMaskId === maskId) state.activeMaskId = state.masks[0].id;
  persist();
  return true;
}

function baseCharacter(id) {
  if (state.hiddenCharacters.includes(id)) return null;
  return (
    CHARACTERS.find((character) => character.id === id) ||
    state.customCharacters.find((character) => character.id === id) ||
    null
  );
}

function decorateCharacter(base) {
  const override = state.characterOverrides[base.id] || {};
  const name = text(override.name, '').trim() || base.name;
  return {
    ...base,
    name,
    mark: override.name ? lastMark(name) : base.mark,
    avatar: override.avatar !== undefined ? override.avatar : text(base.avatar),
    persona: override.persona !== undefined ? override.persona : text(base.persona),
    tagline: override.tagline !== undefined ? override.tagline : text(base.tagline),
    tagId:
      override.tagId !== undefined
        ? override.tagId
        : text(base.tagId),
    muted: Boolean(override.muted ?? base.muted),
  };
}

export function getAllCharacters() {
  const hidden = new Set(state.hiddenCharacters);
  return [...CHARACTERS, ...state.customCharacters]
    .filter((character) => !hidden.has(character.id))
    .map(decorateCharacter);
}

export function getCharacter(id) {
  const base = baseCharacter(id);
  return base ? decorateCharacter(base) : null;
}

export function createCharacter(data) {
  const name = text(data?.name).trim();
  if (!name) return null;
  const tagId = state.tags.some((tag) => tag.id === data?.tagId) ? data.tagId : '';
  const role = text(data?.role).trim() || '新朋友';
  const nameMark = text(data?.mark).trim();
  const character = {
    id: makeId('custom'),
    name,
    mark: nameMark ? lastMark(nameMark) : lastMark(name),
    role,
    relationship: text(data?.relationship).trim() || '朋友',
    tone: TONES.includes(data?.tone) ? data.tone : randomTone(),
    tagline: text(data?.tagline).trim() || '刚刚认识。',
    persona: text(data?.persona),
    avatar: text(data?.avatar),
    tagId,
    muted: false,
    createdAt: Date.now(),
  };
  state.customCharacters.push(character);
  persist();
  return character;
}

export function updateCharacter(id, patch) {
  const custom = state.customCharacters.find((character) => character.id === id);
  if (custom) {
    if (typeof patch.name === 'string' && patch.name.trim()) {
      custom.name = patch.name.trim();
      custom.mark = lastMark(custom.name);
    }
    if (typeof patch.persona === 'string') custom.persona = patch.persona;
    if (typeof patch.tagline === 'string') custom.tagline = patch.tagline;
    if (typeof patch.avatar === 'string') custom.avatar = patch.avatar;
    if (typeof patch.tagId === 'string') {
      custom.tagId = state.tags.some((tag) => tag.id === patch.tagId) ? patch.tagId : '';
    }
    if (typeof patch.muted === 'boolean') custom.muted = patch.muted;
    persist();
    return decorateCharacter(custom);
  }

  if (!CHARACTERS.some((character) => character.id === id)) return null;
  const override = state.characterOverrides[id] || {};
  if (typeof patch.name === 'string' && patch.name.trim()) {
    override.name = patch.name.trim();
  }
  if (typeof patch.persona === 'string') override.persona = patch.persona;
  if (typeof patch.tagline === 'string') override.tagline = patch.tagline;
  if (typeof patch.avatar === 'string') override.avatar = patch.avatar;
  if (typeof patch.tagId === 'string') {
    override.tagId = state.tags.some((tag) => tag.id === patch.tagId) ? patch.tagId : '';
  }
  if (typeof patch.muted === 'boolean') override.muted = patch.muted;
  state.characterOverrides[id] = override;
  persist();
  return getCharacter(id);
}

export function deleteCharacter(id) {
  const index = state.customCharacters.findIndex((character) => character.id === id);
  if (index >= 0) {
    state.customCharacters.splice(index, 1);
  } else if (CHARACTERS.some((character) => character.id === id)) {
    if (!state.hiddenCharacters.includes(id)) state.hiddenCharacters.push(id);
  } else {
    return false;
  }
  delete state.characterOverrides[id];
  delete state.conversations[id];
  persist();
  return true;
}

export function getTags() {
  return state.tags;
}

export function getTagName(tagId) {
  return state.tags.find((tag) => tag.id === tagId)?.name || '';
}

export function addTag(name) {
  const value = text(name).trim();
  if (!value) return null;
  if (state.tags.some((tag) => tag.name === value)) return null;
  const tag = {
    id: makeId('tag'),
    name: value,
    order: state.tags.length,
  };
  state.tags.push(tag);
  persist();
  return tag;
}

export function updateTag(tagId, name) {
  const value = text(name).trim();
  const tag = state.tags.find((item) => item.id === tagId);
  if (!tag || !value || state.tags.some((item) => item.id !== tagId && item.name === value)) return null;
  tag.name = value;
  persist();
  return tag;
}

export function deleteTag(tagId) {
  const index = state.tags.findIndex((tag) => tag.id === tagId);
  if (index < 0) return false;
  state.tags.splice(index, 1);
  for (const character of state.customCharacters) {
    if (character.tagId === tagId) character.tagId = '';
  }
  for (const override of Object.values(state.characterOverrides)) {
    if (override.tagId === tagId) override.tagId = '';
  }
  persist();
  return true;
}

function createEmptyConversation() {
  return {
    unread: 0,
    pinned: false,
    multiSentCount: 0,
    messageCount: 0,
    lastSeq: 0,
    lastMessage: null,
    style: createChatStyle(),
    memory: normalizeMemory(DEFAULT_MEMORY),
    status: null,
  };
}

export function ensureConversation(characterId) {
  if (!state.conversations[characterId]) {
    state.conversations[characterId] = createEmptyConversation();
    persist();
  }
  return state.conversations[characterId];
}

export function getConversation(characterId) {
  return state.conversations[characterId] || null;
}

function queueMessageWrite(message, imageBlobs = []) {
  writeChain = writeChain
    .then(async () => {
      for (const image of imageBlobs) await dbPutImage(image);
      await dbPutMessage(message);
    })
    .catch(() => {
      // Keep the in-memory state usable when a write fails.
    });
}

export function getMessagePage(characterId, options = {}) {
  return dbGetMessagePage(characterId, options);
}

export function getRecentMessages(characterId, limit = 50) {
  return dbGetRecentMessages(characterId, limit);
}

export function getMessagesSince(characterId, seq = 0) {
  return dbGetMessagesSince(characterId, seq);
}

export function getImageRecord(imageId) {
  return dbGetImage(imageId);
}

export async function refreshConversationTail(characterId) {
  const conversation = getConversation(characterId);
  if (!conversation) return null;
  const [recent] = await dbGetRecentMessages(characterId, 1);
  const count = await dbCountMessages(characterId);
  conversation.lastMessage = recent || null;
  conversation.messageCount = count;
  conversation.lastSeq = Math.max(conversation.lastSeq || 0, count);
  persist();
  return conversation;
}

export function incrementMultiSentCount(characterId) {
  const conversation = ensureConversation(characterId);
  conversation.multiSentCount = Math.min(999, (conversation.multiSentCount || 0) + 1);
  persist();
  return conversation.multiSentCount;
}

// How many messages the user has queued up since the last reply. Derived from
// the stored message list so deleting a queued message can never leave a stale
// count behind in the "receive" badge.
export async function countPendingUserMessages(characterId) {
  const messages = await dbGetRecentMessages(characterId, 80);
  let count = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== 'user') break;
    count += 1;
  }
  return Math.min(999, count);
}

export async function recountMultiSentCount(characterId) {
  const conversation = ensureConversation(characterId);
  conversation.multiSentCount = await countPendingUserMessages(characterId);
  persist();
  return conversation.multiSentCount;
}

export function clearMultiSentCount(characterId) {
  const conversation = getConversation(characterId);
  if (!conversation) return;
  conversation.multiSentCount = 0;
  persist();
}

export function addMessage(characterId, role, content, options = {}) {
  const conversation = ensureConversation(characterId);
  conversation.maskIds ||= [];
  if (!conversation.maskIds.length && (conversation.messageCount || 0) > 0) {
    conversation.maskIds.push(state.masks[0].id);
  }
  if (!conversation.maskIds.includes(state.activeMaskId)) conversation.maskIds.push(state.activeMaskId);
  const type =
    options.type === 'redpacket' || options.type === 'sticker' || options.type === 'image'
      ? options.type
      : 'text';
  const message = {
    id: makeId(type === 'image' ? 'image-message' : 'message'),
    role,
    type,
    createdAt: Date.now(),
  };
  const quote = normalizeQuote(options.quote);
  if (quote) message.quote = quote;
  if (options.raw) message.raw = text(options.raw).slice(0, 4000);
  const imageBlobs = [];

  if (type === 'redpacket') {
    message.amountFen = Math.max(1, Math.round(options.amountFen || 0));
    message.note = text(options.note, '恭喜发财，大吉大利');
    message.claimed = Boolean(options.claimed);
    message.claimedAt = options.claimedAt || null;
  } else if (type === 'sticker') {
    message.url = text(options.url);
    message.packName = text(options.packName);
    message.name = text(options.name).trim().slice(0, 20);
  } else if (type === 'image') {
    const sources = Array.isArray(options.images) ? options.images.slice(0, MAX_IMAGES_PER_MESSAGE) : [];
    const refs = [];
    for (const source of sources) {
      if (!source?.blob) continue;
      const id = makeId('image');
      refs.push({
        id,
        width: Math.max(1, Math.round(finite(source.width, 1))),
        height: Math.max(1, Math.round(finite(source.height, 1))),
      });
      imageBlobs.push({ id, blob: source.blob, createdAt: Date.now() });
    }
    if (!refs.length) return null;
    message.images = refs;
    message.content = text(content).slice(0, 500);
  } else {
    message.content = text(content);
  }

  message.seq = (conversation.lastSeq || 0) + 1;
  conversation.lastSeq = message.seq;
  conversation.messageCount = (conversation.messageCount || 0) + 1;
  conversation.lastMessage = message;
  if (options.unread) conversation.unread = (conversation.unread || 0) + 1;
  queueMessageWrite({ ...message, characterId }, imageBlobs);
  persist();
  return message;
}

export async function updateMessage(characterId, messageId, patch) {
  await flushMessageWrites();
  const existing = await dbGetMessage(messageId);
  if (!existing || existing.characterId !== characterId) return null;
  const updated = { ...existing, ...patch };
  await dbPutMessage(updated);
  const conversation = getConversation(characterId);
  if (conversation?.lastMessage?.id === messageId) conversation.lastMessage = updated;
  persist();
  return updated;
}

// Tapbacks live on the message itself so they survive reloads and backups.
// A sender may only hold one reaction per emoji; tapping the same emoji again
// removes it (toggle), matching the iMessage gesture. The list is capped so a
// bubble never disappears behind a pile of stickers.
export async function reactToMessage(
  characterId,
  messageId,
  emoji,
  by = 'user',
  { toggle = true } = {},
) {
  await flushMessageWrites();
  const existing = await dbGetMessage(messageId);
  if (!existing || existing.characterId !== characterId) return null;
  const value = text(emoji).trim().slice(0, 16);
  if (!value) return null;
  const role = by === 'assistant' ? 'assistant' : 'user';
  const current = normalizeReactions(existing.reactions);
  const index = current.findIndex(
    (reaction) => reaction.emoji === value && reaction.by === role,
  );
  let next;
  if (index >= 0) {
    if (!toggle) return current;
    next = current.filter((_, position) => position !== index);
  } else {
    next = [...current, { emoji: value, by: role }].slice(
      -MAX_REACTIONS_PER_MESSAGE,
    );
  }
  const updated = { ...existing, reactions: next };
  await dbPutMessage(updated);
  const conversation = getConversation(characterId);
  if (conversation?.lastMessage?.id === messageId) conversation.lastMessage = updated;
  persist();
  return next;
}

export async function deleteMessage(characterId, messageId) {
  const existing = await dbGetMessage(messageId);
  if (!existing || existing.characterId !== characterId) return null;
  await dbDeleteMessage(messageId);
  await deleteImageRecordsForMessages([existing]);
  await refreshConversationTail(characterId);
  return existing;
}

export async function removeLastAssistantReply(characterId) {
  const conversation = getConversation(characterId);
  if (!conversation) return { removed: [] };
  const messages = await dbGetRecentMessages(characterId, 200);
  let index = messages.length - 1;
  while (index >= 0 && messages[index].role === 'assistant') index -= 1;
  if (index === messages.length - 1) return { removed: [] };
  const removed = messages.slice(index + 1);
  await dbDeleteMessages(removed.map((message) => message.id));
  await deleteImageRecordsForMessages(removed);
  await refreshConversationTail(characterId);
  return { removed };
}

function favoriteImageIds() {
  const ids = new Set();
  for (const favorite of state.favorites || []) {
    for (const message of favorite.messages || []) {
      for (const image of message.images || []) {
        if (image?.id) ids.add(image.id);
      }
    }
  }
  return ids;
}

async function deleteImageRecordsForMessages(messages) {
  const protectedIds = favoriteImageIds();
  const ids = messages
    .flatMap((message) =>
      message.type === 'image' && Array.isArray(message.images)
        ? message.images.map((image) => image.id)
        : [],
    )
    .filter((id) => id && !protectedIds.has(id));
  if (ids.length) await dbDeleteImages(ids);
}


export function setConversationStatus(characterId, statusText) {
  const conversation = ensureConversation(characterId);
  const value = text(statusText).trim().slice(0, 32);
  if (!value) return conversation.status;
  if (conversation.status?.text === value) return conversation.status;
  conversation.status = { text: value, at: Date.now() };
  persist();
  return conversation.status;
}

export function getChatMemory(characterId) {
  return ensureConversation(characterId).memory;
}

export function updateMemorySettings(characterId, patch) {
  const conversation = ensureConversation(characterId);
  conversation.memory = normalizeMemory({ ...conversation.memory, ...patch });
  persist();
  return conversation.memory;
}

export function addMemoryCategory(characterId, name) {
  const value = text(name).trim().slice(0, 16);
  if (!value) return null;
  const conversation = ensureConversation(characterId);
  if (!conversation.memory.categories.includes(value)) {
    conversation.memory.categories.push(value);
    persist();
  }
  return value;
}

export function addMemoryEntry(characterId, { category, content, source = 'manual' }) {
  const value = text(content).trim().slice(0, 600);
  if (!value) return null;
  const conversation = ensureConversation(characterId);
  const name = text(category).trim().slice(0, 16) || '其他';
  if (!conversation.memory.categories.includes(name)) {
    conversation.memory.categories.push(name);
  }
  const entry = {
    id: makeId('memory'),
    category: name,
    content: value,
    source: source === 'auto' ? 'auto' : 'manual',
    createdAt: Date.now(),
  };
  conversation.memory.items.push(entry);
  conversation.memory.items = conversation.memory.items.slice(-300);
  persist();
  return entry;
}

export function updateMemoryEntry(characterId, entryId, patch) {
  const conversation = state.conversations[characterId];
  const entry = conversation?.memory.items.find((item) => item.id === entryId);
  if (!entry) return null;
  if (typeof patch.content === 'string' && patch.content.trim()) {
    entry.content = patch.content.trim().slice(0, 600);
  }
  if (typeof patch.category === 'string' && patch.category.trim()) {
    const category = patch.category.trim().slice(0, 16);
    entry.category = category;
    if (!conversation.memory.categories.includes(category)) {
      conversation.memory.categories.push(category);
    }
  }
  persist();
  return entry;
}

export function deleteMemoryEntry(characterId, entryId) {
  const conversation = state.conversations[characterId];
  if (!conversation) return false;
  const index = conversation.memory.items.findIndex((item) => item.id === entryId);
  if (index < 0) return false;
  conversation.memory.items.splice(index, 1);
  persist();
  return true;
}

export function deleteMemoryCategory(characterId, name) {
  const conversation = state.conversations[characterId];
  if (!conversation) return false;
  const value = text(name).trim();
  if (!value || conversation.memory.items.some((item) => item.category === value)) {
    return false;
  }
  const index = conversation.memory.categories.indexOf(value);
  if (index < 0) return false;
  conversation.memory.categories.splice(index, 1);
  persist();
  return true;
}

export function getChatPreferences(characterId) {
  return ensureConversation(characterId).memory.preferences || [];
}

export function addChatPreference(
  characterId,
  content,
  { source = 'manual' } = {},
) {
  const value = text(content).trim().slice(0, 160);
  if (!value) return null;
  const conversation = ensureConversation(characterId);
  if (!Array.isArray(conversation.memory.preferences)) {
    conversation.memory.preferences = [];
  }
  const key = preferenceKey(value);
  const duplicate = conversation.memory.preferences.some(
    (item) => preferenceKey(item.content) === key,
  );
  if (duplicate) return null;
  const entry = {
    id: makeId('pref'),
    content: value,
    source: source === 'auto' ? 'auto' : 'manual',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  conversation.memory.preferences.push(entry);
  conversation.memory.preferences = conversation.memory.preferences.slice(-80);
  persist();
  return entry;
}

export function updateChatPreference(characterId, preferenceId, content) {
  const conversation = state.conversations[characterId];
  const entry = conversation?.memory.preferences?.find(
    (item) => item.id === preferenceId,
  );
  if (!entry) return null;
  const value = text(content).trim().slice(0, 160);
  if (!value) return null;
  const key = preferenceKey(value);
  const duplicate = conversation.memory.preferences.some(
    (item) => item.id !== preferenceId && preferenceKey(item.content) === key,
  );
  if (duplicate) return null;
  entry.content = value;
  entry.updatedAt = Date.now();
  persist();
  return entry;
}

export function deleteChatPreference(characterId, preferenceId) {
  const conversation = state.conversations[characterId];
  if (!conversation?.memory.preferences) return false;
  const index = conversation.memory.preferences.findIndex(
    (item) => item.id === preferenceId,
  );
  if (index < 0) return false;
  conversation.memory.preferences.splice(index, 1);
  persist();
  return true;
}

export function markMemoryPreferences(characterId, at, consumedRounds = 0) {
  const conversation = ensureConversation(characterId);
  conversation.memory.lastPreferenceAt = Math.max(0, finite(at, Date.now()));
  conversation.memory.preferenceRounds = Math.max(
    0,
    (conversation.memory.preferenceRounds || 0) -
      Math.max(0, Math.round(consumedRounds)),
  );
  persist();
}

export function markMemorySummary(characterId, at, consumedRounds = 0) {
  const conversation = ensureConversation(characterId);
  conversation.memory.lastSummaryAt = Math.max(0, finite(at, Date.now()));
  conversation.memory.roundsSinceSummary = Math.max(
    0,
    (conversation.memory.roundsSinceSummary || 0) -
      Math.max(0, Math.round(consumedRounds)),
  );
  persist();
}

export function incrementMemoryRound(characterId) {
  const conversation = ensureConversation(characterId);
  conversation.memory.roundsSinceSummary = Math.min(
    1000,
    (conversation.memory.roundsSinceSummary || 0) + 1,
  );
  conversation.memory.preferenceRounds = Math.min(
    1000,
    (conversation.memory.preferenceRounds || 0) + 1,
  );
  persist();
  return conversation.memory.roundsSinceSummary;
}

export function markConversationRead(characterId) {
  const conversation = state.conversations[characterId];
  if (conversation?.unread) {
    conversation.unread = 0;
    persist();
  }
}

export async function clearConversation(characterId) {
  const conversation = ensureConversation(characterId);
  const existing = await dbGetRecentMessages(characterId, 100000);
  await dbDeleteMessagesForCharacter(characterId);
  await deleteImageRecordsForMessages(existing);
  conversation.messageCount = 0;
  conversation.lastSeq = 0;
  conversation.lastMessage = null;
  conversation.unread = 0;
  conversation.status = null;
  conversation.memory.lastSummaryAt = 0;
  conversation.memory.roundsSinceSummary = 0;
  conversation.memory.lastPreferenceAt = 0;
  conversation.memory.preferenceRounds = 0;
  persist();
}

export async function deleteConversation(characterId) {
  await clearConversation(characterId);
  delete state.conversations[characterId];
  persist();
}

export function pinConversation(characterId, pinned) {
  const conversation = ensureConversation(characterId);
  conversation.pinned = Boolean(pinned);
  persist();
}

export function getSortedConversations() {
  return getAllCharacters()
    .flatMap((character) => {
      const conversation = state.conversations[character.id];
      const lastMessage = conversation?.lastMessage;
      if (!lastMessage || !(conversation.messageCount > 0)) return [];
      return [{ character, conversation, lastMessage }];
    })
    .sort((a, b) => {
      if (a.conversation.pinned !== b.conversation.pinned) {
        return a.conversation.pinned ? -1 : 1;
      }
      return b.lastMessage.createdAt - a.lastMessage.createdAt;
    });
}

export function getUnreadTotal() {
  return Object.values(state.conversations).reduce(
    (total, conversation) => total + (conversation.unread || 0),
    0,
  );
}

export function getStats() {
  const conversations = getSortedConversations();
  const messageCount = conversations.reduce(
    (total, item) => total + (item.conversation.messageCount || 0),
    0,
  );
  const startedAt = state.masks.reduce(
    (earliest, mask) => Math.min(earliest, mask.createdAt || Date.now()),
    Date.now(),
  );
  const days = Math.max(1, Math.floor((Date.now() - startedAt) / 86400000) + 1);
  return {
    partnerCount: getAllCharacters().length,
    conversationCount: conversations.length,
    messageCount,
    days,
  };
}

export function getStorageSize() {
  return new Blob([JSON.stringify(state)]).size;
}

export function getChatStyle(characterId) {
  return createChatStyle(state.conversations[characterId]?.style || {});
}

export function updateChatStyle(characterId, patch) {
  const conversation = ensureConversation(characterId);
  conversation.style = createChatStyle({ ...conversation.style, ...patch });
  persist();
  return conversation.style;
}

export function getBubblePresets() {
  return state.bubblePresets;
}

export function addBubblePreset({ name, css }) {
  const trimmedName = text(name).trim();
  const trimmedCss = wrapLegacyBubbleCss(css);
  if (!trimmedName || !trimmedCss) return null;
  const preset = { id: makeId('bubble'), name: trimmedName, css: trimmedCss };
  state.bubblePresets.push(preset);
  persist();
  return preset;
}

export function updateBubblePreset(id, { name, css }) {
  const preset = state.bubblePresets.find((item) => item.id === id);
  if (!preset) return null;
  if (typeof name === 'string' && name.trim()) preset.name = name.trim();
  const normalizedCss = wrapLegacyBubbleCss(css);
  if (normalizedCss) preset.css = normalizedCss;
  persist();
  return preset;
}

export function deleteBubblePreset(id) {
  const index = state.bubblePresets.findIndex((item) => item.id === id);
  if (index < 0) return false;
  state.bubblePresets.splice(index, 1);
  persist();
  return true;
}

export function getFavorites(characterId) {
  if (!characterId) return [];
  return state.favorites.filter((favorite) => favorite.characterId === characterId);
}

export function getFavoriteCount(characterId) {
  return getFavorites(characterId).length;
}

export function addFavorite({ title, characterId, characterName, messages }) {
  if (typeof characterId !== 'string' || !characterId.trim()) return null;
  const favorite = normalizeFavorite({
    id: makeId('favorite'),
    title,
    characterId,
    characterName,
    messages: Array.isArray(messages) ? messages : [],
    createdAt: Date.now(),
  });
  if (!favorite) return null;
  state.favorites.unshift(favorite);
  let count = 0;
  state.favorites = state.favorites.filter(
    (item) => item.characterId !== characterId || ++count <= 300,
  );
  persist();
  return favorite;
}

export function deleteFavorite(id, characterId) {
  if (!characterId) return false;
  const index = state.favorites.findIndex(
    (item) => item.id === id && item.characterId === characterId,
  );
  if (index < 0) return false;
  state.favorites.splice(index, 1);
  persist();
  return true;
}

export function getStickerPacks() {
  return state.stickerPacks;
}

export function addStickerPack({ name, items, enabled = true }) {
  const value = text(name).trim();
  const list = normalizeStickerItems(items);
  if (!value || !list.length) return null;
  const pack = {
    id: makeId('pack'),
    name: value,
    items: list,
    enabled,
    createdAt: Date.now(),
  };
  state.stickerPacks.push(pack);
  persist();
  return pack;
}

export function updateStickerPack(id, patch) {
  const pack = state.stickerPacks.find((item) => item.id === id);
  if (!pack) return null;
  if (typeof patch.name === 'string' && patch.name.trim()) pack.name = patch.name.trim();
  if (typeof patch.enabled === 'boolean') pack.enabled = patch.enabled;
  if (Array.isArray(patch.items)) {
    const list = normalizeStickerItems(patch.items);
    if (list.length) pack.items = list;
  }
  persist();
  return pack;
}

export function deleteStickerPack(id) {
  const index = state.stickerPacks.findIndex((item) => item.id === id);
  if (index < 0) return false;
  state.stickerPacks.splice(index, 1);
  persist();
  return true;
}

export function getEnabledStickerEntries() {
  return state.stickerPacks
    .filter((pack) => pack.enabled)
    .flatMap((pack) =>
      pack.items.map((item) => ({
        url: item.url,
        name: item.name,
        packName: pack.name,
        packId: pack.id,
      })),
    );
}

export const getEnabledStickerUrls = getEnabledStickerEntries;

export function getWallet() {
  return state.wallet;
}

function addWalletTransaction(type, amountFen, label) {
  state.wallet.transactions.unshift({
    id: makeId('tx'),
    type,
    amountFen: Math.abs(Math.round(amountFen)),
    label,
    createdAt: Date.now(),
  });
  state.wallet.transactions = state.wallet.transactions.slice(0, 200);
}

export function creditWallet(amountFen, type, label) {
  const value = Math.max(0, Math.round(amountFen));
  if (!value) return false;
  state.wallet.balanceFen += value;
  addWalletTransaction(type, value, label);
  persist();
  return true;
}

export function sendRedPacket(characterId, amountFen, note) {
  const value = Math.round(amountFen);
  const character = getCharacter(characterId);
  if (!character || !Number.isFinite(value) || value < 1) {
    return { ok: false, message: '红包金额不对' };
  }
  if (value > state.wallet.balanceFen) {
    return { ok: false, message: '钱包余额不足' };
  }
  state.wallet.balanceFen -= value;
  addWalletTransaction('redpacket-out', value, `给${character.name}的红包`);
  const message = addMessage(characterId, 'user', '', {
    type: 'redpacket',
    amountFen: value,
    note: text(note, '恭喜发财，大吉大利'),
    claimed: true,
  });
  persist();
  return { ok: true, message };
}

export async function claimRedPacket(characterId, messageId) {
  const character = getCharacter(characterId);
  const message = await dbGetMessage(messageId);
  if (!character || !message || message.type !== 'redpacket' || message.characterId !== characterId) {
    return { ok: false, message: '红包不存在' };
  }
  if (message.role !== 'assistant') return { ok: false, message: '这是你发出的红包' };
  if (message.claimed) return { ok: false, message: '红包已经领过了' };

  message.claimed = true;
  message.claimedAt = Date.now();
  await dbPutMessage(message);
  const conversation = getConversation(characterId);
  if (conversation?.lastMessage?.id === messageId) conversation.lastMessage = message;
  state.wallet.balanceFen += message.amountFen;
  addWalletTransaction('redpacket-in', message.amountFen, `${character.name}的红包`);
  persist();
  return { ok: true, amountFen: message.amountFen };
}

export function getShop() {
  return state.shop;
}

export function openShop(typeId) {
  const type = getShopType(typeId);
  if (!type || state.shop) return null;
  state.shop = {
    typeId,
    openedAt: Date.now(),
    payrollAt: nextNoon(),
    pendingFen: generateShopIncome(type),
    lastIncomeFen: 0,
    earlyClaimedAt: null,
    orderHistory: [],
  };
  persist();
  return state.shop;
}

export function getTodayShopOrder() {
  if (!state.shop) return null;
  const day = localDayKey();
  return state.shop.orderHistory?.find((item) => item.day === day) || null;
}

export function getShopWeeklyOrderIncomeFen() {
  if (!state.shop) return 0;
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return (state.shop.orderHistory || [])
    .filter((item) => new Date(`${item.day}T00:00:00`) >= weekStart)
    .reduce((total, item) => total + item.wageFen, 0);
}

export function settleDailyShopOrder({ answers, wageFen, feedback }) {
  if (!state.shop) return { ok: false, message: '先开一家小店吧' };
  const day = localDayKey();
  if (getTodayShopOrder()) return { ok: false, message: '今天的订单已经结算' };
  if (!Array.isArray(answers) || answers.length !== 3 || answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 2)) {
    return { ok: false, message: '请完成三道选择题' };
  }
  if (!Number.isFinite(wageFen) || wageFen <= 0) {
    return { ok: false, message: '订单工资无效，请重新评估' };
  }
  const amount = Math.min(5000, Math.max(500, Math.round(wageFen)));
  const record = {
    day,
    count: 3,
    answers: answers.slice(),
    wageFen: amount,
    feedback: String(feedback || '').slice(0, 120),
    settledAt: Date.now(),
  };
  state.shop.orderHistory ||= [];
  state.shop.orderHistory.push(record);
  state.shop.orderHistory = state.shop.orderHistory.slice(-90);
  state.wallet.balanceFen += amount;
  addWalletTransaction('order-salary', amount, `${getShopType(state.shop.typeId).name} · 今日订单`);
  persist();
  return { ok: true, record };
}

export function settleShopIncome() {
  if (!state?.shop) return [];
  const type = getShopType(state.shop.typeId);
  if (!type) return [];
  const payouts = [];
  let guard = 0;

  while (Date.now() >= state.shop.payrollAt && guard < 30) {
    const gross = state.shop.pendingFen;
    if (gross > 0 && state.shop.earlyClaimedAt !== state.shop.payrollAt) {
      state.wallet.balanceFen += gross;
      const date = new Date(state.shop.payrollAt);
      addWalletTransaction(
        'salary',
        gross,
        `${type.name}工资 · ${date.getMonth() + 1}/${date.getDate()}`,
      );
      payouts.push(gross);
      state.shop.lastIncomeFen = gross;
    }
    state.shop.payrollAt = nextNoon(state.shop.payrollAt);
    state.shop.pendingFen = generateShopIncome(type);
    state.shop.earlyClaimedAt = null;
    guard += 1;
  }

  if (guard) persist();
  return payouts;
}

export function claimEarlySalary() {
  settleShopIncome();
  if (!state.shop) return { ok: false, message: '先开一家小店吧' };
  if (state.shop.earlyClaimedAt === state.shop.payrollAt || state.shop.pendingFen <= 0) {
    return { ok: false, message: '本轮工资已经领过了' };
  }
  const type = getShopType(state.shop.typeId);
  const grossFen = state.shop.pendingFen;
  const feeFen = Math.round(grossFen * 0.1);
  const netFen = grossFen - feeFen;

  state.wallet.balanceFen += netFen;
  addWalletTransaction('early-salary', netFen, `${type.name} · 提前领取工资`);
  state.shop.pendingFen = 0;
  state.shop.earlyClaimedAt = state.shop.payrollAt;
  state.shop.lastIncomeFen = netFen;
  persist();
  return { ok: true, grossFen, feeFen, netFen };
}

export function getLikedMoments() {
  return state.likedMoments;
}

export function toggleMomentLike(momentId) {
  const index = state.likedMoments.indexOf(momentId);
  if (index >= 0) state.likedMoments.splice(index, 1);
  else state.likedMoments.push(momentId);
  persist();
  return index < 0;
}

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function zipCrc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = ZIP_CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateParts(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// A compact ZIP writer using stored (uncompressed) entries. JSON and JPEG data
// are already compact enough, and storing avoids browser support differences.
function createZip(entries) {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name.replace(/\\/g, '/'));
    const data = entry.data instanceof Uint8Array ? entry.data : encoder.encode(String(entry.data ?? ''));
    return { nameBytes, data, crc: zipCrc32(data), ...zipDateParts(entry.date) };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const entry of prepared) {
    localSize += 30 + entry.nameBytes.length + entry.data.length;
    centralSize += 46 + entry.nameBytes.length;
  }
  const buffer = new ArrayBuffer(localSize + centralSize + 22);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const central = [];

  for (const entry of prepared) {
    const localOffset = offset;
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, entry.time, true);
    view.setUint16(offset + 12, entry.date, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    offset += 30;
    bytes.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
    bytes.set(entry.data, offset);
    offset += entry.data.length;
    central.push({ ...entry, localOffset });
  }

  const centralOffset = offset;
  for (const entry of central) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, entry.time, true);
    view.setUint16(offset + 14, entry.date, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, entry.localOffset, true);
    offset += 46;
    bytes.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  }

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, central.length, true);
  view.setUint16(offset + 10, central.length, true);
  view.setUint32(offset + 12, offset - centralOffset, true);
  view.setUint32(offset + 16, centralOffset, true);
  view.setUint16(offset + 20, 0, true);
  return new Blob([buffer], { type: 'application/zip' });
}

function findZipEnd(bytes) {
  const minimum = Math.max(0, bytes.length - 65557);
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }
  return -1;
}

async function inflateZipBytes(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前浏览器不支持解压这个备份');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(input) {
  const bytes = new Uint8Array(input);
  const eocd = findZipEnd(bytes);
  if (eocd < 0) throw new Error('这不是有效的 ZIP 备份文件');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files = new Map();
  let offset = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('ZIP 备份的目录信息已损坏');
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('ZIP 备份中的文件头已损坏');
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    let data = compressed;
    if (method === 8) data = await inflateZipBytes(compressed);
    else if (method !== 0) throw new Error('备份使用了不支持的压缩方式');
    files.set(name, data);
  }
  return files;
}

function jsonFile(files, name, fallback = null) {
  const data = files.get(name);
  if (!data) return fallback;
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new Error(`备份中的 ${name} 无法解析`);
  }
}

function safeFileName(characterId, index) {
  const cleaned = String(characterId).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `messages/${String(index).padStart(3, '0')}-${cleaned || 'conversation'}.json`;
}

export async function createBackup() {
  const snapshot = clone(state);
  snapshot.settings.api.apiKey = '';
  snapshot.exportedAt = new Date().toISOString();
  return JSON.stringify(snapshot, null, 2);
}

export async function exportBackupZip() {
  const [messages, images] = await Promise.all([dbGetAllMessages(), dbGetAllImages()]);
  const grouped = new Map();
  for (const message of messages) {
    if (!grouped.has(message.characterId)) grouped.set(message.characterId, []);
    grouped.get(message.characterId).push(message);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => (a.seq || 0) - (b.seq || 0) || a.createdAt - b.createdAt);
  }

  const snapshot = clone(state);
  snapshot.settings.api.apiKey = '';
  const entries = [
    {
      name: 'manifest.json',
      data: JSON.stringify(
        {
          format: 'achat-backup',
          version: 2,
          app: 'Achenchat',
          createdAt: new Date().toISOString(),
          counts: {
            conversations: Object.keys(snapshot.conversations || {}).length,
            messages: messages.length,
            images: images.length,
            favorites: snapshot.favorites?.length || 0,
          },
          modules: ['profile.json', 'conversations.json', 'wallet.json', 'content.json', 'messages/', 'images/'],
        },
        null,
        2,
      ),
    },
    {
      name: 'profile.json',
      data: JSON.stringify(
        {
          settings: snapshot.settings,
          masks: snapshot.masks,
          activeMaskId: snapshot.activeMaskId,
          tags: snapshot.tags,
          customCharacters: snapshot.customCharacters,
          hiddenCharacters: snapshot.hiddenCharacters,
          characterOverrides: snapshot.characterOverrides,
        },
        null,
        2,
      ),
    },
    {
      name: 'conversations.json',
      data: JSON.stringify(snapshot.conversations || {}, null, 2),
    },
    {
      name: 'wallet.json',
      data: JSON.stringify({ wallet: snapshot.wallet, shop: snapshot.shop }, null, 2),
    },
    {
      name: 'content.json',
      data: JSON.stringify(
        {
          stickerPacks: snapshot.stickerPacks,
          bubblePresets: snapshot.bubblePresets,
          likedMoments: snapshot.likedMoments,
          favorites: snapshot.favorites,
        },
        null,
        2,
      ),
    },
  ];

  let index = 0;
  for (const [characterId, list] of grouped) {
    entries.push({
      name: safeFileName(characterId, index),
      data: JSON.stringify(list),
    });
    index += 1;
  }
  for (const image of images) {
    if (!image?.id || !image.blob) continue;
    entries.push({
      name: `images/${image.id}.jpg`,
      data: new Uint8Array(await image.blob.arrayBuffer()),
    });
  }

  return createZip(entries);
}

export function inspectBackupFile(file) {
  return file.arrayBuffer().then(async (buffer) => {
    const bytes = new Uint8Array(buffer);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!isZip) {
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      const conversations = parsed?.conversations || {};
      const messageCount = Object.values(conversations).reduce(
        (total, conversation) => total + (conversation?.messages?.length || 0),
        0,
      );
      return {
        format: 'achat-json',
        legacy: true,
        createdAt: parsed?.exportedAt || null,
        counts: {
          conversations: Object.keys(conversations).length,
          messages: messageCount,
          images: 0,
        },
      };
    }
    const files = await readZip(bytes);
    const manifest = jsonFile(files, 'manifest.json', null);
    if (!manifest || manifest.format !== 'achat-backup') {
      throw new Error('这个 ZIP 不是 Achat 备份');
    }
    return manifest;
  });
}

async function importZipBackup(files) {
  const manifest = jsonFile(files, 'manifest.json', null);
  if (!manifest || manifest.format !== 'achat-backup') {
    throw new Error('这个 ZIP 不是 Achat 备份');
  }
  const profile = jsonFile(files, 'profile.json', {});
  const conversations = jsonFile(files, 'conversations.json', {});
  const wallet = jsonFile(files, 'wallet.json', {});
  const content = jsonFile(files, 'content.json', {});

  const grouped = new Map();
  for (const [name, data] of files) {
    if (!name.startsWith('messages/') || !name.endsWith('.json')) continue;
    let list;
    try {
      list = JSON.parse(new TextDecoder().decode(data));
    } catch {
      continue;
    }
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item.characterId !== 'string') continue;
      if (!grouped.has(item.characterId)) grouped.set(item.characterId, []);
      grouped.get(item.characterId).push(item);
    }
  }

  const candidate = {
    ...profile,
    conversations,
    wallet: wallet.wallet,
    shop: wallet.shop,
    ...content,
  };
  const normalized = normalizeState(candidate);
  normalized.settings.api.apiKey = state.settings.api.apiKey;
  normalized.schema = STATE_SCHEMA;
  state = normalized;

  const records = [];
  for (const [characterId, list] of grouped) {
    const conversation = state.conversations[characterId];
    if (!conversation) continue;
    list.sort((a, b) => (a.seq || 0) - (b.seq || 0) || a.createdAt - b.createdAt);
    const normalizedList = list.map(normalizeMessage).filter(Boolean);
    normalizedList.forEach((message, index) => {
      records.push({
        ...message,
        characterId,
        seq: index + 1,
      });
    });
    conversation.messageCount = normalizedList.length;
    conversation.lastSeq = normalizedList.length;
    conversation.lastMessage = normalizedList[normalizedList.length - 1] || null;
  }
  for (const [characterId, conversation] of Object.entries(state.conversations)) {
    if (grouped.has(characterId)) continue;
    conversation.messageCount = 0;
    conversation.lastSeq = 0;
    conversation.lastMessage = null;
  }

  const images = [];
  for (const [name, data] of files) {
    if (!name.startsWith('images/') || name.endsWith('/')) continue;
    const id = name.slice('images/'.length).replace(/\.[^.]+$/, '');
    if (!id) continue;
    images.push({ id, blob: new Blob([data], { type: 'image/jpeg' }), createdAt: Date.now() });
  }

  await dbClearAllData();
  if (records.length) await dbPutMessages(records);
  for (const image of images) await dbPutImage(image);
  await dbSet(DB_KEY, clone(state));
  settleShopIncome();
  return {
    counts: {
      conversations: Object.keys(state.conversations).length,
      messages: records.length,
      images: images.length,
    },
  };
}

export async function restoreBackupFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) return importZipBackup(await readZip(bytes));

  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('备份文件格式不正确');
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.conversations) {
    throw new Error('备份文件格式不正确');
  }
  const rawConversations = parsed.conversations;
  const normalized = normalizeState(parsed);
  normalized.settings.api.apiKey = state.settings.api.apiKey;
  normalized.schema = STATE_SCHEMA;
  state = normalized;
  await dbClearAllData();
  await importLegacyMessages(rawConversations);
  await dbSet(DB_KEY, clone(state));
  settleShopIncome();
  return {
    counts: {
      conversations: Object.keys(state.conversations).length,
      messages: Object.values(state.conversations).reduce(
        (total, conversation) => total + conversation.messageCount,
        0,
      ),
      images: 0,
    },
  };
}

export async function restoreBackup(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('备份文件格式不正确');
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.conversations) {
    throw new Error('备份文件格式不正确');
  }
  const rawConversations = parsed.conversations;
  const apiKey = state.settings.api.apiKey;
  state = normalizeState(parsed);
  state.settings.api.apiKey = apiKey;
  state.schema = STATE_SCHEMA;
  await dbClearAllData();
  await importLegacyMessages(rawConversations);
  await dbSet(DB_KEY, clone(state));
  settleShopIncome();
}

export async function clearAllData() {
  state = normalizeState({
    ...createDefaultState({ seeded: false, emptyWallet: true }),
    masks: [
      {
        id: 'mask-me',
        name: '你',
        signature: '从一句话开始。',
        persona: '',
        avatar: '',
        createdAt: Date.now(),
      },
    ],
    activeMaskId: 'mask-me',
    wallet: createEmptyWallet(),
  });
  await dbClearAllData();
  await dbSet(DB_KEY, clone(state));
  settleShopIncome();
}



