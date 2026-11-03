import { showMessageBanner } from '../components/message-banner.js';
import {
  ApiRequestError,
  extractPreferences,
  streamChat,
  summarizeConversation,
} from './api.js';
import { notifyDataChanged } from './events.js';
import {
  addChatPreference,
  addMemoryEntry,
  addMessage,
  getCharacter,
  getChatMemory,
  getChatStyle,
  getConversation,
  getEnabledStickerEntries,
  getProfile,
  getRecentMessages,
  flushMessageWrites,
  hasApiConfig,
  incrementMemoryRound,
  markConversationRead,
  markMemoryPreferences,
  markMemorySummary,
  reactToMessage,
  setConversationStatus,
  updateCharacter,
} from './store.js';
import { collectAmbientContext } from './time-awareness.js';
import {
  messageAsText,
  messageLength,
  parseAIReply,
  readStatus,
  resolveMessageByText,
} from './message-format.js';

const runs = new Map();
const channels = new Map();
const summaryRuns = new Set();
const preferenceRuns = new Set();

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

async function persistReply(characterId, parsed, active, raw) {
  const character = getCharacter(characterId);
  if (!character || !parsed.segments.length) return null;
  const style = getChatStyle(characterId);
  const status = parsed.status || '';
  if (status) setConversationStatus(characterId, status);

  // Reactions and quotes point at the other person's earlier messages, so read
  // the freshest history (including anything typed while the reply streamed).
  await flushMessageWrites();
  const profile = getProfile();
  const contextLimit = Math.max(
    30,
    getConversation(characterId)?.memory?.contextCount || 24,
  );
  const recentMessages = await getRecentMessages(characterId, contextLimit);

  const rawText = typeof raw === 'string' ? raw.trim() : '';
  const items = [];
  const messages = [];
  let pendingQuote = null;

  const quoteFor = (target) => ({
    messageId: target.id,
    role: target.role,
    name: target.role === 'assistant' ? character.name : profile.name || '你',
    content: (target.content || messageAsText(target)).slice(0, 500),
  });

  const emitMessage = (message) => {
    if (!message) return;
    messages.push(message);
    items.push({ kind: 'message', message });
  };

  const lastMessageIndex = parsed.segments.reduce(
    (last, segment, index) =>
      segment.type === 'text' ||
      segment.type === 'redpacket' ||
      segment.type === 'sticker'
        ? index
        : last,
    -1,
  );

  for (const [index, segment] of parsed.segments.entries()) {
    const unread = !active && index === lastMessageIndex;
    if (segment.type === 'reaction') {
      const target = resolveMessageByText(segment.targetText, recentMessages);
      if (!target) continue;
      const reactions = await reactToMessage(
        characterId,
        target.id,
        segment.emoji,
        'assistant',
        { toggle: false },
      );
      if (!reactions) continue;
      target.reactions = reactions;
      items.push({
        kind: 'reaction',
        messageId: target.id,
        emoji: segment.emoji,
        reactions,
      });
      continue;
    }
    if (segment.type === 'repo') {
      const target = resolveMessageByText(segment.targetText, recentMessages);
      if (target) {
        pendingQuote = target;
        continue;
      }
      // Older models sometimes put "原文-回复" inside one repo block. Accept
      // that spelling too as long as the left side matches a real message.
      const dash = Math.max(
        segment.targetText.lastIndexOf('-'),
        segment.targetText.lastIndexOf('－'),
      );
      if (dash <= 0) continue;
      const inlineTarget = resolveMessageByText(
        segment.targetText.slice(0, dash),
        recentMessages,
      );
      const reply = segment.targetText.slice(dash + 1).trim();
      if (!inlineTarget || !reply) continue;
      emitMessage(
        addMessage(characterId, 'assistant', reply.slice(0, 1000), {
          quote: quoteFor(inlineTarget),
          unread,
          raw: rawText,
        }),
      );
      pendingQuote = null;
      continue;
    }
    if (segment.type === 'redpacket') {
      emitMessage(
        addMessage(characterId, 'assistant', '', {
          type: 'redpacket',
          amountFen: segment.amountFen,
          note: segment.note,
          claimed: false,
          unread,
          raw: rawText,
        }),
      );
      continue;
    }
    if (segment.type === 'sticker') {
      emitMessage(
        addMessage(characterId, 'assistant', '', {
          type: 'sticker',
          url: segment.url,
          name: segment.name,
          packName: segment.packName,
          unread,
          raw: rawText,
        }),
      );
      continue;
    }
    const options = { unread, raw: rawText };
    if (pendingQuote) {
      options.quote = quoteFor(pendingQuote);
      pendingQuote = null;
    }
    emitMessage(
      addMessage(characterId, 'assistant', segment.content, options),
    );
  }

  const lastMessage = messages.at(-1) || null;
  emit(characterId, 'done', {
    messages,
    items,
    status,
    active,
  });
  notifyDataChanged();
  incrementMemoryRound(characterId);

  const tagline = parsed.tagline || '';
  if (tagline && tagline !== character.tagline) {
    updateCharacter(characterId, { tagline });
    emit(characterId, 'tagline', { tagline });
  }

  if (
    lastMessage &&
    !active &&
    !character.muted &&
    document.visibilityState !== 'hidden'
  ) {
    showMessageBanner(latestMessagePayload(character, lastMessage));
  }

  scheduleExtra(characterId, character, active, parsed.segments, style);
  maybeSummarize(characterId);
  maybeExtractPreferences(characterId);
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
  const character = getCharacter(characterId);
  if (!character) return;
  summaryRuns.add(characterId);
  const consumedRounds = memory.roundsSinceSummary || 0;
  const categoryList = memory.categories.slice();
  flushMessageWrites()
    .then(() => getRecentMessages(characterId, 200))
    .then((messages) => {
      const pending = messages.filter((message) => message.createdAt > since);
      if (!pending.length) return null;
      return summarizeConversation({
        character,
        profile: getProfile(),
        messages: pending,
        categories: categoryList,
      }).then((text) => ({ text, pending }));
    })
    .then((result) => {
      if (!result) return;
      const rows = parseSummary(result.text);
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
      markMemorySummary(characterId, result.pending.at(-1).createdAt, consumedRounds);
      if (added) notifyDataChanged();
    })
    .catch(() => {
      // Automatic summaries stay silent; the next reply can try again.
    })
    .finally(() => {
      summaryRuns.delete(characterId);
    });
}

function maybeExtractPreferences(characterId) {
  if (!hasApiConfig() || preferenceRuns.has(characterId)) return;
  const conversation = getConversation(characterId);
  const memory = conversation?.memory;
  if (!memory?.preferenceEvery) return;
  if ((memory.preferenceRounds || 0) < memory.preferenceEvery) return;
  const character = getCharacter(characterId);
  if (!character) return;

  preferenceRuns.add(characterId);
  const consumedRounds = memory.preferenceRounds || 0;
  const since = memory.lastPreferenceAt || 0;
  const existing = (getChatMemory(characterId).preferences || []).map(
    (item) => item.content,
  );

  flushMessageWrites()
    .then(() => getRecentMessages(characterId, 200))
    .then(async (messages) => {
      const pending = messages.filter(
        (message) =>
          message.createdAt > since &&
          (message.role === 'user' || message.role === 'assistant'),
      );
      if (pending.length < 4) return null;
      const found = await extractPreferences({
        character,
        profile: getProfile(),
        messages: pending,
        existing,
      });
      return { found, pending };
    })
    .then((result) => {
      if (!result) return;
      let added = 0;
      for (const content of result.found) {
        if (addChatPreference(characterId, content, { source: 'auto' })) {
          added += 1;
        }
      }
      // Advance even when nothing new was found, so the same stretch is not
      // sent to the model again on the next reply.
      markMemoryPreferences(
        characterId,
        result.pending.at(-1).createdAt,
        consumedRounds,
      );
      if (added) notifyDataChanged();
    })
    .catch(() => {
      // Preference extraction stays silent; the next round can retry.
    })
    .finally(() => {
      preferenceRuns.delete(characterId);
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
  const limit = Math.max(2, conversation.memory?.contextCount || 24);
  flushMessageWrites()
    .then(() => getRecentMessages(characterId, limit))
    .then((history) => {
      if (controller.signal.aborted) {
        void finishFromPartial(characterId, run, isActive(characterId));
        return;
      }
      generate(characterId, character, conversation.memory, history, controller, run);
    })
    .catch((error) => {
      if (runs.get(characterId) === run) runs.delete(characterId);
      emit(characterId, 'error', { message: error?.message || '读取聊天记录失败' });
    });
  return true;
}

async function finishFromPartial(characterId, run, active) {
  const parsed = parseAIReply(run.partial.trim(), {
    stickers: getEnabledStickerEntries(),
  });
  if (!parsed.segments.length) {
    if (runs.get(characterId) === run) runs.delete(characterId);
    emit(characterId, 'cancelled', {});
    return;
  }
  run.finished = true;
  try {
    await persistReply(characterId, parsed, active, run.partial.trim());
  } finally {
    if (runs.get(characterId) === run) runs.delete(characterId);
  }
}

async function generate(characterId, character, memory, history, controller, run) {
  try {
    const style = getChatStyle(characterId);
    const ambient = style.timeAwareness ? await collectAmbientContext() : null;
    const fullText = await streamChat({
      character,
      profile: getProfile(),
      memory,
      messages: history,
      ambient,
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
        await persistReply(characterId, parsed, isActive(characterId), content);
      }
    } else {
      emit(characterId, 'cancelled', {});
    }
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      await finishFromPartial(characterId, run, isActive(characterId));
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
