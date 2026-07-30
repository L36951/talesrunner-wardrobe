import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTryOnUrl } from '../scripts/lib/deeplink.mjs';

const rolePage = {
  equipmentType: 'role',
  members: [{ id: '101' }, { id: '102' }],
};

test('puts role sets in the role slot and leaves avatar empty', () => {
  assert.equal(buildTryOnUrl(rolePage, '1'),
    '/#v=1&char=1&avatar=&role=101,102&view=role');
});

test('puts avatar sets in the avatar slot', () => {
  assert.equal(buildTryOnUrl({ ...rolePage, equipmentType: 'avatar' }, '7'),
    '/#v=1&char=7&avatar=101,102&role=&view=avatar');
});

test('keeps member order stable', () => {
  const url = buildTryOnUrl({ equipmentType: 'role', members: [{ id: 'b' }, { id: 'a' }] }, '1');
  assert.match(url, /role=b,a/);
});
