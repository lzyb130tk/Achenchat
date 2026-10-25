import test from 'node:test';
import assert from 'node:assert/strict';
import { addMask, addTag, deleteTag, getMasks, getTags, initStore, updateTag } from '../src/services/store.js';

test('tags can be created, renamed and deleted without removing masks', async () => {
  globalThis.localStorage = { getItem: () => null, removeItem: () => {} };
  await initStore();
  const tag = addTag('工作搭子');
  assert.ok(tag);
  assert.equal(updateTag(tag.id, '同事').name, '同事');
  assert.equal(updateTag(tag.id, '朋友'), null);
  assert.equal(getTags().some((item) => item.id === tag.id), true);
  const mask = addMask({ name: '新身份', avatar: 'src/assets/default-person.svg' });
  assert.equal(getMasks().find((item) => item.id === mask.id).avatar, 'src/assets/default-person.svg');
  assert.equal(deleteTag(tag.id), true);
  assert.equal(getMasks().some((item) => item.id === mask.id), true);
});
