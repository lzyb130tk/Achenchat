import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initStore, getFavorites, getFavoriteCount, addFavorite, deleteFavorite,
  getChatMemory, updateMemorySettings, addMemoryEntry, updateMemoryEntry, deleteMemoryEntry,
  getChatPreferences, addChatPreference, updateChatPreference, deleteChatPreference,
  getCharacter, getProfile, saveApiConfig,
} from '../src/services/store.js';
import { streamChat } from '../src/services/api.js';

const A = 'su-mian';
const B = 'lin-ye';
const messages = [{ role: 'user', content: 'snapshot', createdAt: 1 }];

beforeEach(async () => {
  globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
  await initStore();
});

test('favorites and counts require an owner; another contact cannot delete them', () => {
  const a = addFavorite({ title: 'A only', characterId: A, characterName: 'Same name', messages });
  const b = addFavorite({ title: 'B only', characterId: B, characterName: 'Same name', messages });
  assert.deepEqual(getFavorites(A).map(item => item.id), [a.id]);
  assert.deepEqual(getFavorites(B).map(item => item.id), [b.id]);
  assert.equal(getFavoriteCount(A), 1);
  assert.equal(getFavoriteCount(B), 1);
  assert.deepEqual(getFavorites(), []);
  assert.equal(getFavoriteCount(), 0);
  assert.equal(addFavorite({ title: 'No owner', messages }), null);
  assert.equal(deleteFavorite(a.id, B), false);
  assert.equal(deleteFavorite(a.id), false);
  assert.equal(deleteFavorite(a.id, A), true);
  assert.equal(getFavoriteCount(A), 0);
  assert.equal(getFavoriteCount(B), 1);
});

test('one contact reaching the favorite limit does not evict another contact', () => {
  const b = addFavorite({ title: 'Keep B', characterId: B, messages });
  for (let i = 0; i < 301; i++) addFavorite({ title: `A ${i}`, characterId: A, messages });
  assert.equal(getFavoriteCount(A), 300);
  assert.equal(getFavorites(A)[0].title, 'A 300');
  assert.deepEqual(getFavorites(B).map(item => item.id), [b.id]);
});

test('memory, categories, about-me notes, and summary settings stay with their contact', () => {
  const beforeB = structuredClone(getChatMemory(B));
  const entry = addMemoryEntry(A, { category: 'A category', content: 'A memory secret' });
  const pref = addChatPreference(A, 'A about-me secret');
  updateMemorySettings(A, { contextCount: 40, summaryEvery: 3, preferenceEvery: 2 });
  assert.deepEqual(getChatMemory(B), beforeB);
  assert.equal(updateMemoryEntry(B, entry.id, { content: 'Wrong contact' }), null);
  assert.equal(deleteMemoryEntry(B, entry.id), false);
  assert.equal(updateChatPreference(B, pref.id, 'Wrong contact'), null);
  assert.equal(deleteChatPreference(B, pref.id), false);
  const sameNoteB = addChatPreference(B, 'A about-me secret');
  assert.ok(sameNoteB, 'deduplication is local to each conversation');
  updateMemoryEntry(A, entry.id, { content: 'Updated A memory' });
  updateChatPreference(A, pref.id, 'Updated A note');
  assert.equal(getChatPreferences(B).find(item => item.id === sameNoteB.id).content, 'A about-me secret');
  assert.equal(deleteMemoryEntry(A, entry.id), true);
  assert.equal(deleteChatPreference(A, pref.id), true);
  assert.equal(getChatPreferences(B).length, beforeB.preferences.length + 1);
});

test('AI prompts contain only the current contacts memory and about-me notes', async () => {
  addMemoryEntry(A, { content: 'A-memory-secret' });
  addChatPreference(A, 'A-preference-secret');
  addMemoryEntry(B, { content: 'B-memory-secret' });
  addChatPreference(B, 'B-preference-secret');
  saveApiConfig({ provider: 'openai', baseUrl: 'https://example.test/v1', apiKey: 'test', model: 'test' });
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async (_url, options) => {
    prompts.push(JSON.parse(options.body).messages[0].content);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
  };
  try {
    for (const id of [A, B]) {
      await streamChat({ character: getCharacter(id), profile: getProfile(), memory: getChatMemory(id), messages: [], onDelta: () => {} });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  for (const [index, own, other] of [[0, 'A', 'B'], [1, 'B', 'A']]) {
    assert.ok(prompts[index].includes(`${own}-memory-secret`));
    assert.ok(prompts[index].includes(`${own}-preference-secret`));
    assert.ok(!prompts[index].includes(`${other}-memory-secret`));
    assert.ok(!prompts[index].includes(`${other}-preference-secret`));
  }
});
