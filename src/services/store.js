import { CHARACTERS } from '../data/characters.js';
import {
  DEFAULT_BUBBLE_PRESETS,
  DEFAULT_CHAT_STYLE,
  DEFAULT_MEMORY,
  PACKET_PRESETS,
} from '../data/chat-options.js';
import { createSeedConversations, DEFAULT_PROFILE } from '../data/seed.js';
import { generateShopIncome, getShopType, nextNoon } from '../data/shop.js';
import { dbGet, dbSet } from './db.js';

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
};

const DEFAULT_TAGS = [
  { id: 'lover', name: '恋人', order: 0 },
  { id: 'friend', name: '朋友', order: 1 },
];

let state = null;
let writeChain = Promise.resolve();
let writeQueued = false;

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
  return {
    bubbleCss: wrapLegacyBubbleCss(raw.bubbleCss),
    presetId: text(raw.presetId, DEFAULT_CHAT_STYLE.presetId),
    packetCss: text(raw.packetCss),
    packetPresetId,
    animationId: text(raw.animationId, DEFAULT_CHAT_STYLE.animationId),
    animationCss: text(raw.animationCss),
    typingSpeed: Math.round(Math.min(0.12, Math.max(0.005, speed)) * 1000) / 1000,
    sendMode: raw.sendMode === 'multi' ? 'multi' : 'single',
    background,
    backgroundImage: text(raw.backgroundImage),
    avatarSize: Math.min(48, Math.max(20, Math.round(finite(raw.avatarSize, 28)))),
    avatarRadius: Math.min(50, Math.max(0, Math.round(finite(raw.avatarRadius, 50)))),
    showUserAvatar: Boolean(raw.showUserAvatar),
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
  const summaryEvery = rawEvery <= 0 ? 0 : Math.min(200, Math.max(5, rawEvery));
  return {
    contextCount,
    summaryEvery,
    categories: [...categorySet].slice(0, 24),
    items,
    lastSummaryAt: Math.max(0, finite(source.lastSummaryAt)),
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
    settings: {
      api: { ...DEFAULT_API },
      appearance: { ...DEFAULT_APPEARANCE },
    },
    masks: [createDefaultMask()],
    activeMaskId: 'mask-me',
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag })),
    customCharacters: [],
    characterOverrides: {},
    conversations: seeded ? createSeedConversations() : {},
    wallet: emptyWallet ? createEmptyWallet() : createWelcomeWallet(),
    shop: null,
    stickerPacks: [],
    bubblePresets: DEFAULT_BUBBLE_PRESETS.map((preset) => ({ ...preset })),
    likedMoments: [],
  };
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.createdAt)) return null;
  if (raw.role !== 'user' && raw.role !== 'assistant') return null;

  const type = raw.type === 'redpacket' || raw.type === 'sticker' ? raw.type : 'text';
  const quote = normalizeQuote(raw.quote);
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
      ...(quote ? { quote } : {}),
      createdAt: raw.createdAt,
    };
  }

  return {
    id: text(raw.id, makeId('message')),
    role: raw.role,
    type: 'text',
    content: text(raw.content),
    ...(quote ? { quote } : {}),
    createdAt: raw.createdAt,
  };
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.messages)) return null;
  return {
    unread: Math.max(0, Math.round(finite(raw.unread))),
    pinned: Boolean(raw.pinned),
    messages: raw.messages.map(normalizeMessage).filter(Boolean).slice(-200),
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
    if (typeof override.avatar === 'string') item.avatar = override.avatar;
    if (typeof override.tagId === 'string') {
      item.tagId = tagIds.has(override.tagId) ? override.tagId : '';
    }
    if (typeof override.muted === 'boolean') item.muted = override.muted;
    result[id] = item;
  }
  return result;
}

function normalizeStickerPacks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((pack) => {
      const name = text(pack?.name).trim();
      const urls = Array.isArray(pack?.urls)
        ? pack.urls
            .map((url) => text(url).trim())
            .filter((url) => /^https?:\/\//i.test(url))
        : [];
      if (!name || !urls.length) return null;
      return {
        id: text(pack?.id, makeId('pack')),
        name,
        urls,
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
  const characterIds = new Set([
    ...CHARACTERS.map((character) => character.id),
    ...customCharacters.map((character) => character.id),
  ]);
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

  return {
    version: 2,
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
        ...(candidate?.settings?.appearance && typeof candidate.settings.appearance === 'object'
          ? candidate.settings.appearance
          : {}),
        colorMode: ['system', 'light', 'dark'].includes(
          candidate?.settings?.appearance?.colorMode,
        )
          ? candidate.settings.appearance.colorMode
          : DEFAULT_APPEARANCE.colorMode,
        fontSize: ['sm', 'md', 'lg'].includes(candidate?.settings?.appearance?.fontSize)
          ? candidate.settings.appearance.fontSize
          : DEFAULT_APPEARANCE.fontSize,
      },
    },
    masks: masks.length ? masks : [createDefaultMask(fallback.masks[0])],
    activeMaskId,
    tags,
    customCharacters,
    characterOverrides,
    conversations,
    wallet: normalizeWallet(candidate?.wallet),
    shop: normalizeShop(candidate?.shop),
    stickerPacks: normalizeStickerPacks(candidate?.stickerPacks),
    bubblePresets: normalizeBubblePresets(candidate?.bubblePresets),
    likedMoments: Array.isArray(candidate?.likedMoments)
      ? candidate.likedMoments.filter((id) => typeof id === 'string')
      : [],
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
      await dbSet(DB_KEY, clone(state));
      if (legacy) localStorage.removeItem(LEGACY_KEY);
    } catch {
      // The app keeps running in memory if IndexedDB is unavailable.
    }
  } else {
    state = normalizeState(stored);
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
    tagId:
      override.tagId !== undefined
        ? override.tagId
        : text(base.tagId),
    muted: Boolean(override.muted ?? base.muted),
  };
}

export function getAllCharacters() {
  return [...CHARACTERS, ...state.customCharacters].map(decorateCharacter);
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
  if (index < 0) return false;
  state.customCharacters.splice(index, 1);
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
    messages: [],
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

export function addMessage(characterId, role, content, options = {}) {
  const conversation = ensureConversation(characterId);
  const type =
    options.type === 'redpacket' || options.type === 'sticker' ? options.type : 'text';
  const message = {
    id: makeId('message'),
    role,
    type,
    createdAt: Date.now(),
  };
  const quote = normalizeQuote(options.quote);
  if (quote) message.quote = quote;

  if (type === 'redpacket') {
    message.amountFen = Math.max(1, Math.round(options.amountFen || 0));
    message.note = text(options.note, '恭喜发财，大吉大利');
    message.claimed = Boolean(options.claimed);
    message.claimedAt = options.claimedAt || null;
  } else if (type === 'sticker') {
    message.url = text(options.url);
    message.packName = text(options.packName);
  } else {
    message.content = text(content);
  }

  conversation.messages.push(message);
  if (options.unread) conversation.unread = (conversation.unread || 0) + 1;
  persist();
  return message;
}

export function updateMessage(characterId, messageId, patch) {
  const message = state.conversations[characterId]?.messages.find(
    (item) => item.id === messageId,
  );
  if (!message) return null;
  Object.assign(message, patch);
  persist();
  return message;
}

export function deleteMessage(characterId, messageId) {
  const conversation = state.conversations[characterId];
  if (!conversation) return null;
  const index = conversation.messages.findIndex((item) => item.id === messageId);
  if (index < 0) return null;
  const [removed] = conversation.messages.splice(index, 1);
  persist();
  return removed;
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

export function markMemorySummary(characterId, at) {
  const conversation = ensureConversation(characterId);
  conversation.memory.lastSummaryAt = Math.max(0, finite(at, Date.now()));
  persist();
}

export function markConversationRead(characterId) {
  const conversation = state.conversations[characterId];
  if (conversation?.unread) {
    conversation.unread = 0;
    persist();
  }
}

export function clearConversation(characterId) {
  const conversation = ensureConversation(characterId);
  conversation.messages = [];
  conversation.unread = 0;
  conversation.status = null;
  persist();
}

export function deleteConversation(characterId) {
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
      if (!conversation?.messages.length) return [];
      const lastMessage = conversation.messages[conversation.messages.length - 1];
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
    (total, item) => total + item.conversation.messages.length,
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

export function getStickerPacks() {
  return state.stickerPacks;
}

export function addStickerPack({ name, urls, enabled = true }) {
  const value = text(name).trim();
  const list = urls
    .map((url) => text(url).trim())
    .filter((url) => /^https?:\/\//i.test(url));
  if (!value || !list.length) return null;
  const pack = {
    id: makeId('pack'),
    name: value,
    urls: list,
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
  if (Array.isArray(patch.urls)) {
    const list = patch.urls
      .map((url) => text(url).trim())
      .filter((url) => /^https?:\/\//i.test(url));
    if (list.length) pack.urls = list;
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

export function getEnabledStickerUrls() {
  return state.stickerPacks
    .filter((pack) => pack.enabled)
    .flatMap((pack) =>
      pack.urls.map((url) => ({ url, packName: pack.name, packId: pack.id })),
    );
}

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

export function claimRedPacket(characterId, messageId) {
  const character = getCharacter(characterId);
  const message = state.conversations[characterId]?.messages.find(
    (item) => item.id === messageId,
  );
  if (!character || !message || message.type !== 'redpacket') {
    return { ok: false, message: '红包不存在' };
  }
  if (message.role !== 'assistant') return { ok: false, message: '这是你发出的红包' };
  if (message.claimed) return { ok: false, message: '红包已经领过了' };

  message.claimed = true;
  message.claimedAt = Date.now();
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
  };
  persist();
  return state.shop;
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

export function createBackup() {
  const snapshot = clone(state);
  snapshot.settings.api.apiKey = '';
  snapshot.exportedAt = new Date().toISOString();
  return JSON.stringify(snapshot, null, 2);
}

export function restoreBackup(raw) {
  const parsed = JSON.parse(raw);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.conversations ||
    typeof parsed.conversations !== 'object'
  ) {
    throw new Error('备份文件格式不正确');
  }
  const normalized = normalizeState(parsed);
  normalized.settings.api.apiKey = state.settings.api.apiKey;
  state = normalized;
  persist();
  settleShopIncome();
}

export function clearAllData() {
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
  persist();
}
