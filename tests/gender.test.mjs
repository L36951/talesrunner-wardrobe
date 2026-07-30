import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genderOf, stemOf, buildCounterpartIndex } from '../scripts/lib/gender.mjs';
import { buildCatalog } from '../scripts/lib/catalog.mjs';

test('reads the gender marker in either bracket style', () => {
  assert.equal(genderOf('青花瓷套裝(男)'), '男');
  assert.equal(genderOf('異世界（女）組合'), '女');
  assert.equal(genderOf('暗黑騎士套裝'), null);
});

test('strips the marker to get the shared stem', () => {
  assert.equal(stemOf('青花瓷套裝(男)'), '青花瓷套裝');
  assert.equal(stemOf('異世界（女）組合'), '異世界組合');
});

test('pairs the two sides and leaves singletons out', () => {
  const pages = [
    { setId: '1', name: 'A(男)' },
    { setId: '2', name: 'A(女)' },
    { setId: '3', name: 'B(男)' },
    { setId: '4', name: 'C' },
  ];
  const index = buildCounterpartIndex(pages);
  assert.equal(index.get('1').setId, '2');
  assert.equal(index.get('2').setId, '1');
  assert.equal(index.has('3'), false);
  assert.equal(index.has('4'), false);
});

test('ignores a stem that somehow has three or more sides', () => {
  const index = buildCounterpartIndex([
    { setId: '1', name: 'A(男)' },
    { setId: '2', name: 'A(女)' },
    { setId: '3', name: 'A(男)' },
  ]);
  assert.equal(index.size, 0);
});

test('does not pair two sets of the same gender that share a stem', () => {
  const index = buildCounterpartIndex([
    { setId: '1', name: 'A(男)' },
    { setId: '2', name: 'A(男)' },
  ]);
  assert.equal(index.size, 0);
});

test('the real catalogue yields 76 pairs, i.e. 152 linked pages', () => {
  const data = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const index = buildCounterpartIndex(buildCatalog(data));
  assert.equal(index.size, 152);
});
