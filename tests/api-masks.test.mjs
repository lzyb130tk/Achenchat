import test from 'node:test';
import assert from 'node:assert/strict';
import { testApiConnection } from '../src/services/api.js';
import {
  addMask,
  addMessage,
  getMaskConversationCount,
  getMasks,
  initStore,
  setActiveMask,
} from '../src/services/store.js';

test('connection test sends a request to each provider format', async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const content = url.endsWith('/messages')
      ? { content: [{ type: 'text', text: '连接正常' }] }
      : { choices: [{ message: { content: '连接正常' } }] };
    return new Response(JSON.stringify(content), { status: 200 });
  };
  await testApiConnection({ provider: 'openai', baseUrl: 'https://example.test/v1', apiKey: 'key', model: 'model' });
  await testApiConnection({ provider: 'anthropic', baseUrl: 'https://example.test/v1', apiKey: 'key', model: 'model' });
  assert.equal(requests[0].url, 'https://example.test/v1/chat/completions');
  assert.equal(requests[1].url, 'https://example.test/v1/messages');
  assert.equal(JSON.parse(requests[0].options.body).model, 'model');
  assert.equal(JSON.parse(requests[1].options.body).model, 'model');
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 });
  await assert.rejects(
    testApiConnection({ provider: 'openai', baseUrl: 'https://example.test/v1', apiKey: 'bad', model: 'model' }),
    /密钥验证失败/,
  );
});

test('mask usage counts distinct conversations', async () => {
  globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
  await initStore();
  assert.equal(getMaskConversationCount(getMasks()[0].id), 3);
  const mask = addMask({ name: '新面具', signature: '测试' });
  assert.ok(setActiveMask(mask.id));
  addMessage('test-a', 'user', '你好');
  addMessage('test-a', 'assistant', '你好');
  addMessage('test-b', 'user', '早上好');
  assert.equal(getMaskConversationCount(mask.id), 2);
});
