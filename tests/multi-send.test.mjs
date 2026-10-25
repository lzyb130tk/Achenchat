import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearMultiSentCount,
  getConversation,
  incrementMultiSentCount,
  initStore,
} from '../src/services/store.js';

test('multi-send count increments and clears after receiving', async () => {
  globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
  await initStore();
  assert.equal(incrementMultiSentCount('su-mian'), 1);
  assert.equal(incrementMultiSentCount('su-mian'), 2);
  assert.equal(getConversation('su-mian').multiSentCount, 2);
  clearMultiSentCount('su-mian');
  assert.equal(getConversation('su-mian').multiSentCount, 0);
  assert.equal(incrementMultiSentCount('su-mian'), 1);
});
