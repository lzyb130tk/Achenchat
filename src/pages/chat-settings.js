import { createChatSettingsPage } from '../components/chat-settings.js';
import { getCharacter, getChatStyle } from '../services/store.js';

export function renderChatSettings({ characterId }) {
  const character = getCharacter(characterId);
  if (!character) return null;
  return createChatSettingsPage({
    character,
    style: getChatStyle(characterId),
  });
}
