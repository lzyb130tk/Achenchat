import { CHARACTERS, getCharacter } from '../data/characters.js';
import { createSeedConversations, DEFAULT_PROFILE } from '../data/seed.js';

const STORAGE_KEY = 'achat.state.v1';

const DEFAULT_API = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

const DEFAULT_APPEARANCE = {
  colorMode: 'system',
  fontSize: 'md',
};

function createDefaultState({ seeded = true } = {}) {
  return {
    version: 1,
    profile: { ...DEFAULT_PROFILE },
    settings: {
      api: { ...DEFAULT_API },
      appearance: { ...DEFAULT_APPEARANCE },
    },
    conversations: seeded ? createSeedConversations() : {},
  };
}

function isValidMessage(message) {
  return (
    message &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    Number.isFinite(message.createdAt)
  );
}

function normalizeState(candidate) {
  const fallback = createDefaultState({ seeded: false });
  const conversations = {};
  const rawConversations = candidate?.conversations;

  if (rawConversations && typeof rawConversations === 'object') {
    for (const character of CHARACTERS) {
      const conversation = rawConversations[character.id];
      if (!conversation || !Array.isArray(conversation.messages)) continue;
      const messages = conversation.messages.filter(isValidMessage).slice(-80);
      conversations[character.id] = {
        unread: Number.isFinite(conversation.unread) ? Math.max(0, conversation.unread) : 0,
        messages,
      };
    }
  }

  return {
    version: 1,
    profile: {
      ...fallback.profile,
      ...(candidate?.profile && typeof candidate.profile === 'object' ? candidate.profile : {}),
    },
    settings: {
      api: {
        ...DEFAULT_API,
        ...(candidate?.settings?.api && typeof candidate.settings.api === 'object'
          ? candidate.settings.api
          : {}),
      },
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...(candidate?.settings?.appearance && typeof candidate.settings.appearance === 'object'
          ? candidate.settings.appearance
          : {}),
      },
    },
    conversations,
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createDefaultState();
    return normalizeState(JSON.parse(stored));
  } catch {
    return createDefaultState();
  }
}

let state = loadState();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The in-memory session remains usable when storage is unavailable.
  }
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function getProfile() {
  return state.profile;
}

export function updateProfile(patch) {
  state.profile = { ...state.profile, ...patch };
  persist();
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

export function getConversation(characterId) {
  return state.conversations[characterId] || null;
}

export function ensureConversation(characterId) {
  if (!state.conversations[characterId]) {
    state.conversations[characterId] = { unread: 0, messages: [] };
    persist();
  }
  return state.conversations[characterId];
}

export function addMessage(characterId, role, content, options = {}) {
  const conversation = ensureConversation(characterId);
  const message = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: Date.now(),
  };
  conversation.messages.push(message);
  if (options.unread) conversation.unread = (conversation.unread || 0) + 1;
  persist();
  return message;
}

export function markConversationRead(characterId) {
  const conversation = state.conversations[characterId];
  if (conversation?.unread) {
    conversation.unread = 0;
    persist();
  }
}

export function clearConversation(characterId) {
  state.conversations[characterId] = { unread: 0, messages: [] };
  persist();
}

export function getSortedConversations() {
  return CHARACTERS.flatMap((character) => {
    const conversation = state.conversations[character.id];
    if (!conversation?.messages.length) return [];
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return [{ character, conversation, lastMessage }];
  }).sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
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
  const days = Math.max(
    1,
    Math.floor((Date.now() - (state.profile.createdAt || Date.now())) / 86400000) + 1,
  );
  return {
    partnerCount: CHARACTERS.length,
    conversationCount: conversations.length,
    messageCount,
    days,
  };
}

export function getStorageSize() {
  return new Blob([JSON.stringify(state)]).size;
}

export function createBackup() {
  const snapshot = JSON.parse(JSON.stringify(state));
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
}

export function clearAllData() {
  state = createDefaultState({ seeded: false });
  state.profile = {
    name: '你',
    signature: '从一句话开始。',
    createdAt: Date.now(),
  };
  persist();
}

export function getConversationPartner(characterId) {
  return getCharacter(characterId);
}
