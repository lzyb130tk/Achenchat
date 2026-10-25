import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayShopOrder,
  getWallet,
  initStore,
  openShop,
  saveApiConfig,
  settleDailyShopOrder,
} from '../src/services/store.js';
import { evaluateShopOrders } from '../src/services/api.js';
import { getDailyOrderQuestions } from '../src/data/shop.js';

test('daily orders use the configured API and pay once', async () => {
  globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
  await initStore();
  saveApiConfig({
    provider: 'openai',
    apiKey: 'test-key',
    baseUrl: 'https://example.test/v1',
    model: 'test-model',
  });
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://example.test/v1/chat/completions');
    assert.equal(JSON.parse(options.body).messages.length, 2);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ wageFen: 1862, feedback: '做得不错' }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  assert.ok(openShop('flower'));
  const balanceBefore = getWallet().balanceFen;
  assert.equal(getDailyOrderQuestions('flower').length, 3);
  assert.equal(settleDailyShopOrder({ answers: [0, 1, 2], wageFen: NaN }).ok, false);
  assert.equal(getWallet().balanceFen, balanceBefore);
  const result = await evaluateShopOrders({ typeId: 'flower', answers: [0, 1, 2] });
  const first = settleDailyShopOrder({ answers: [0, 1, 2], ...result });
  const second = settleDailyShopOrder({ answers: [0, 1, 2], ...result });

  assert.equal(calls, 1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(getTodayShopOrder().count, 3);
  assert.equal(getWallet().balanceFen, balanceBefore + 1862);
  assert.equal(getWallet().transactions[0].type, 'order-salary');
});
