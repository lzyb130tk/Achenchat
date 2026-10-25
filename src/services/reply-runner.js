import { showMessageBanner } from '../components/message-banner.js';
import { ApiRequestError, streamChat } from './api.js';
import { notifyDataChanged } from './events.js';
import {
  addMessage,
  getCharacter,
  getConversation,
  getEnabledStickerUrls,
  getProfile,
  hasApiConfig,
  markConversationRead,
} from './store.js';

const runs = new Map();
const channels = new Map();
const RED_PACKET_NOTES = [
  '今天想请你喝杯甜的。',
  '一点小心意，收下吧。',
  '路过小店时想起你。',
  '给今天认真生活的你。',
];

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

function addExtraMessage(character, active) {
  const roll = Math.random();
  const stickerUrls = getEnabledStickerUrls();

  if (roll < 0.14) {
    const amountFen = Math.round((600 + Math.random() * 1400) / 100) * 100;
    const note = RED_PACKET_NOTES[Math.floor(Math.random() * RED_PACKET_NOTES.length)];
    const message = addMessage(character.id, 'assistant', '', {
      type: 'redpacket',
      amountFen,
      note,
      claimed: false,
      unread: !active,
    });
    emit(character.id, 'message', { message });
    notifyDataChanged();
    return;
  }

  if (roll < 0.32 && stickerUrls.length) {
    const sticker = stickerUrls[Math.floor(Math.random() * stickerUrls.length)];
    const message = addMessage(character.id, 'assistant', '', {
      type: 'sticker',
      url: sticker.url,
      packName: sticker.packName,
      unread: !active,
    });
    emit(character.id, 'message', { message });
    notifyDataChanged();
  }
}

function persistReply(characterId, content, active) {
  const character = getCharacter(characterId);
  if (!character || !content) return null;
  const message = addMessage(characterId, 'assistant', content, { unread: !active });
  emit(characterId, 'done', { message, active });
  notifyDataChanged();

  if (!active) {
    if (!character.muted && document.visibilityState !== 'hidden') {
      showMessageBanner(latestMessagePayload(character, message));
    }
  }

  window.setTimeout(() => addExtraMessage(character, active), 360);
  return message;
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
  if (!run) return { running: false, text: '' };
  return { running: true, text: run.partial };
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
  const run = { controller, partial: '', finished: false };
  runs.set(characterId, run);
  emit(characterId, 'start', {});
  generate(characterId, character, conversation.messages.slice(), controller, run);
  return true;
}

async function generate(characterId, character, history, controller, run) {
  try {
    const fullText = await streamChat({
      character,
      profile: getProfile(),
      messages: history,
      signal: controller.signal,
      onDelta: (delta) => {
        run.partial += delta;
        emit(characterId, 'delta', { text: run.partial, delta });
      },
    });

    const content = fullText.trim();
    if (content) {
      run.finished = true;
      runs.delete(characterId);
      persistReply(characterId, content, isActive(characterId));
    } else {
      emit(characterId, 'cancelled', {});
    }
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      const content = run.partial.trim();
      if (content) {
        run.finished = true;
        runs.delete(characterId);
        persistReply(characterId, content, isActive(characterId));
      } else {
        emit(characterId, 'cancelled', {});
      }
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
