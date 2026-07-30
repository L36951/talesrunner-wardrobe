import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog, EXPECTED_PAGE_COUNT, MIN_MEMBERS } from '../scripts/lib/catalog.mjs';

const fixture = {
  sets: {
    '10': { name: '兩件套', equipmentType: 'role', stats: [['最高速度 +1', 'blue']] },
    '11': { name: '單件套', equipmentType: 'avatar', stats: [] },
    '12': { name: '零件套', equipmentType: 'role', stats: [] },
  },
  items: [
    { id: 'a', setId: '10', name: 'A', stats: [] },
    { id: 'b', setId: '10', name: 'B', stats: [] },
    { id: 'c', setId: '11', name: 'C', stats: [] },
  ],
};

test('drops sets with fewer than MIN_MEMBERS members', () => {
  const pages = buildCatalog(fixture);
  assert.equal(MIN_MEMBERS, 2);
  assert.deepEqual(pages.map((page) => page.setId), ['10']);
});

test('carries the definition and members onto the page descriptor', () => {
  const [page] = buildCatalog(fixture);
  assert.equal(page.name, '兩件套');
  assert.equal(page.equipmentType, 'role');
  assert.deepEqual(page.setStats, [['最高速度 +1', 'blue']]);
  assert.deepEqual(page.members.map((item) => item.id), ['a', 'b']);
});

test('orders pages by numeric set id so builds are reproducible', () => {
  const pages = buildCatalog({
    sets: {
      '100': { name: 'X', equipmentType: 'role', stats: [] },
      '20': { name: 'Y', equipmentType: 'role', stats: [] },
    },
    items: [
      { id: '1', setId: '100' }, { id: '2', setId: '100' },
      { id: '3', setId: '20' }, { id: '4', setId: '20' },
    ],
  });
  assert.deepEqual(pages.map((page) => page.setId), ['20', '100']);
});

test('the real catalogue produces exactly EXPECTED_PAGE_COUNT pages', () => {
  const data = JSON.parse(readFileSync('data/items.json', 'utf8'));
  assert.equal(buildCatalog(data).length, EXPECTED_PAGE_COUNT);
});
