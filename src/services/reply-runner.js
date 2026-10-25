import { showMessageBanner } from '../components/message-banner.js';
import { ApiRequestError, streamChat, summarizeConversation } from './api.js';
import { notifyDataChanged } from './events.js';
import {
  addMemoryEntry,
  addMessage,
  getCharacter,
  getChatMemory,
  getChatStyle,
  getConversation,
  getEnabledStickerEntries,
  getProfile,
  hasApiConfig,
  incrementMemoryRound,
  markConversationRead,
  markMemorySummary,
  setConversationStatus,
} from './store.js';
import {
  messageLength,
  parseAIReply,
  readStatus,
} from './message-format.js';

const runs = new Map();
const channels = new Map();
const summaryRuns = new Set();

let activeCharacterId = null;

function channel(characterId) {
  if (!channels.has(characterId)) channels.set(characterId, new Set());
  return channels.get(characterId);
}

function emit(characterId, type, detail = {}) {
  for (const handler of channel(characterId)) handler({ type, ...detail });
}

function isActive(characterId) {
  return activeCharacterId === characterId && document.visibilityState !== 'hidden';
}

function latestMessagePayload(character, message) {
  return {
    character,
    message,
    onOpen: () => {
      window.location.hash = `#/chat/${character.id}`;
    },
  };
}

function addStickerExtra(character, active) {
  const stickers = getEnabledStickerEntries();
  if (!stickers.length || Math.random() >= 0.1) return;
  const sticker = stickers[Math.floor(Math.random() * stickers.length)];
  const message = addMessage(character.id, 'assistant', '', {
    type: 'sticker',
    url: sticker.url,
    name: sticker.name,
    packName: sticker.packName,
    unread: !active,
  });
  emit(character.id, 'message', { message });
  notifyDataChanged();
}

function scheduleExtra(characterId, character, active, segments, style) {
  if (segments.some((segment) => segment.type === 'sticker')) return;
  if (!getEnabledStickerEntries().length) return;
  const revealMs = segments.reduce(
    (total, segment) =>
      total + Math.min(4500, 180 + messageLength(segment) * style.typingSpeed * 1000),
    0,
  );
  const delay = Math.max(1800, revealMs + 900 + Math.random() * 900);
  window.setTimeout(() => addStickerExtra(character, active), delay);
}

function persistReply(characterId, parsed, active) {
  const character = getCharacter(characterId);
  if (!character || !parsed.segments.length) return null;
  const style = getChatStyle(characterId);
  const status = parsed.status || '';
  if (status) setConversationStatus(characterId, status);

  const messages = parsed.segments.map((segment, index) => {
    const unread = !active && index === parsed.segments.length - 1;
    if (segment.type === 'redpacket') {
      return addMessage(characterId, 'assistant', '', {
        type: 'redpacket',
        amountFen: segment.amountFen,
        note: segment.note,
        claimed: false,
        unread,
      });
    }
    if (segment.type === 'sticker') {
      return addMessage(characterId, 'assistant', '', {
        type: 'sticker',
        url: segment.url,
        name: segment.name,
        packName: segment.packName,
        unread,
      });
    }
    return addMessage(characterId, 'assistant', segment.content, { unread });
  });
  const lastMessage = messages.at(-1);
  emit(characterId, 'done', {
    messages,
    status,
    active,
  });
  notifyDataChanged();
  incrementMemoryRound(characterId);

  if (!active && !character.muted && document.visibilityState !== 'hidden') {
    showMessageBanner(latestMessagePayload(character, lastMessage));
  }

  scheduleExtra(characterId, character, active, parsed.segments, style);
  maybeSummarize(characterId);
  return lastMessage;
}

function parseSummary(text) {
  const rows = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.replace(/^[-*\d.\s]+/, '').trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[｜|]/);
    if (parts.length > 1 && parts[0].trim() && parts.slice(1).join('｜').trim()) {
      rows.push({
        category: parts[0].trim().slice(0, 16),
        content: parts.slice(1).join('｜').trim().slice(0, 160),
      });
    } else {
      rows.push({ category: '自动总结', content: trimmed.slice(0, 160) });
    }
  }
  return rows.slice(0, 6);
}

function maybeSummarize(characterId) {
  if (!hasApiConfig() || summaryRuns.has(characterId)) return;
  const conversation = getConversation(characterId);
  const memory = conversation?.memory;
  if (!conversation || !memory?.summaryEvery) return;
  if ((memory.roundsSinceSummary || 0) < memory.summaryEvery) return;
  const since = memory.lastSummaryAt || 0;
  const pending = conversation.messages.filter(
    (message) => message.createdAt > since,
  );
  if (!pending.length) return;

  const character = getCharacter(characterId);
  if (!character) return;
  summaryRuns.add(characterId);
  const consumedRounds = memory.roundsSinceSummary || 0;
  const categoryList = memory.categories.slice();
  summarizeConversation({
    character,
    profile: getProfile(),
    messages: pending,
    categories: categoryList,
  })
    .then((text) => {
      const rows = parseSummary(text);
      if (!rows.length) return;
      const existing = new Set(
        getChatMemory(characterId).items.map((item) => item.content),
      );
      let added = 0;
      for (const row of rows) {
        if (existing.has(row.content)) continue;
        addMemoryEntry(characterId, {
          category: row.category,
          content: row.content,
          source: 'auto',
        });
        existing.add(row.content);
        added += 1;
      }
      // Advance the checkpoint even when every row was already known, so the
      // same stretch of chat is not summarized again on the next reply.
      markMemorySummary(characterId, pending.at(-1).createdAt, consumedRounds);
      if (added) notifyDataChanged();
    })
    .catch(() => {
      // Automatic summaries stay silent; the next reply can try again.
    })
    .finally(() => {
      summaryRuns.delete(characterId);
    });
}

export function setActiveChat(characterId) {
  activeCharacterId = characterId;
  if (characterId) markConversationRead(characterId);
}

export function subscribeReply(characterId, handler) {
  const set = channel(characterId);
  set.add(handler);
  return () => {
    set.delete(handler);
    if (!set.size) channels.delete(characterId);
  };
}

export function getReplyState(characterId) {
  const run = runs.get(characterId);
  if (!run) return { running: false, text: '', status: '' };
  return { running: true, text: run.partial, status: run.status };
}

export function isReplying(characterId) {
  return runs.has(characterId);
}

export function startReply(characterId) {
  if (runs.has(characterId) || !hasApiConfig()) return false;
  const character = getCharacter(characterId);
  const conversation = getConversation(characterId);
  if (!character || !conversation) return false;

  const controller = new AbortController();
  const run = { controller, partial: '', status: '', finished: false };
  runs.set(characterId, run);
  emit(characterId, 'start', {});
  const history = conversation.messages.slice(
    -Math.max(2, conversation.memory?.contextCount || 24),
  );
  generate(characterId, character, conversation.memory, history, controller, run);
  return true;
}

function finishFromPartial(characterId, run, active) {
  const parsed = parseAIReply(run.partial.trim(), {
    stickers: getEnabledStickerEntries(),
  });
  if (!parsed.segments.length) {
    emit(characterId, 'cancelled', {});
    return;
  }
  run.finished = true;
  runs.delete(characterId);
  persistReply(characterId, parsed, active);
}

async function generate(characterId, character, memory, history, controller, run) {
  try {
    const fullText = await streamChat({
      character,
      profile: getProfile(),
      memory,
      messages: history,
      signal: controller.signal,
      onDelta: (delta) => {
        run.partial += delta;
        const status = readStatus(run.partial);
        if (status && status !== run.status) {
          run.status = status;
          emit(characterId, 'status', { status });
        }
        emit(characterId, 'delta', { text: run.partial, delta });
      },
    });

    const content = fullText.trim();
    if (content) {
      const parsed = parseAIReply(content, {
        stickers: getEnabledStickerEntries(),
      });
      if (!parsed.segments.length) {
        emit(characterId, 'cancelled', {});
      } else {
        run.finished = true;
        runs.delete(characterId);
        persistReply(characterId, parsed, isActive(characterId));
      }
    } else {
      emit(characterId, 'cancelled', {});
    }
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      finishFromPartial(characterId, run, isActive(characterId));
    } else {
      const message =
        error instanceof ApiRequestError || error?.message
          ? error.message
          : '回复失败，请稍后再试';
      emit(characterId, 'error', { message });
      if (isActive(characterId)) {
        const { toast } = await import('../components/toast.js');
        toast(message, { tone: 'danger' });
      }
    }
  } finally {
    if (runs.get(characterId) === run) runs.delete(characterId);
    notifyDataChanged();
  }
}

export function stopReply(characterId) {
  runs.get(characterId)?.controller.abort();
}
