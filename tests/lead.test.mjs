import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLead, LEAD_MEMBER_LIMIT } from '../scripts/lib/lead.mjs';

const page = (over = {}) => ({
  name: '青花瓷套裝(男)',
  equipmentType: 'role',
  setStats: [['最高速度 +1', 'blue']],
  members: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  ...over,
});

test('names the set, its kind, its size and its members', () => {
  assert.equal(buildLead(page(), 29),
    '青花瓷套裝(男) 係《跑Online》嘅角色裝備套裝，由 3 件裝備組成：A、B、C。'
    + '著齊全套會觸發套裝效果，共 29 個角色可以著齊。');
});

test('calls an avatar set an Avatar set', () => {
  assert.match(buildLead(page({ equipmentType: 'avatar' }), 5), /嘅Avatar套裝/);
});

test('says so when the set carries no bonus', () => {
  assert.match(buildLead(page({ setStats: [] }), 5), /呢套裝備冇套裝效果，/);
});

test('says so when nobody can wear the whole set', () => {
  assert.match(buildLead(page(), 0), /暫時冇角色可以著齊全套。$/);
});

test('truncates a long member list rather than reciting all nine', () => {
  const members = Array.from({ length: 9 }, (_, i) => ({ name: `件${i + 1}` }));
  const lead = buildLead(page({ members }), 3);
  assert.equal(LEAD_MEMBER_LIMIT, 6);
  assert.match(lead, /件1、件2、件3、件4、件5、件6 等 9 件。/);
  assert.doesNotMatch(lead, /件7/);
});

test('lists every member when at or under the limit', () => {
  const members = Array.from({ length: 6 }, (_, i) => ({ name: `件${i + 1}` }));
  assert.match(buildLead(page({ members }), 3), /件6。/);
  assert.doesNotMatch(buildLead(page({ members }), 3), /等 6 件/);
});

test('returns plain text, not HTML - escaping is the callers job', () => {
  const lead = buildLead(page({ name: '<b>x</b>' }), 1);
  assert.match(lead, /<b>x<\/b>/);
});
