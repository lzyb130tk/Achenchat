import test from 'node:test';
import assert from 'node:assert/strict';
import { initStore, getChatStyle, updateChatStyle } from '../src/services/store.js';

test('chat hint text is scoped, normalized, and can be reset independently', async () => {
  globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
  await initStore();
  assert.equal(getChatStyle('su-mian').composerPlaceholder, '');
  assert.equal(getChatStyle('su-mian').typingText, '');

  updateChatStyle('su-mian', {
    composerPlaceholder: '  Say "hello" <3  ',
    typingText: '  Thinking & typing  ',
    composerStyle: 'raised',
  });
  assert.equal(getChatStyle('su-mian').composerPlaceholder, 'Say "hello" <3');
  assert.equal(getChatStyle('su-mian').typingText, 'Thinking & typing');
  assert.equal(getChatStyle('lin-ye').composerPlaceholder, '');
  assert.equal(getChatStyle('lin-ye').typingText, '');

  updateChatStyle('su-mian', { typingText: 'x'.repeat(100) });
  assert.equal(getChatStyle('su-mian').typingText.length, 80);
  updateChatStyle('su-mian', { composerPlaceholder: null, typingText: '   ' });
  assert.equal(getChatStyle('su-mian').composerPlaceholder, '');
  assert.equal(getChatStyle('su-mian').typingText, '');
  assert.equal(getChatStyle('su-mian').composerStyle, 'raised');
});
