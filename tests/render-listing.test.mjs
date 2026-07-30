import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHub, renderListing, LISTINGS } from '../scripts/lib/render-listing.mjs';

const pages = [
  { setId: '1', name: 'R一', equipmentType: 'role', members: [{}, {}] },
  { setId: '2', name: 'A一', equipmentType: 'avatar', members: [{}, {}] },
];

test('LISTINGS covers both equipment types', () => {
  assert.deepEqual(LISTINGS.map((l) => l.equipmentType), ['role', 'avatar']);
  assert.deepEqual(LISTINGS.map((l) => l.path), ['/sets/role', '/sets/avatar']);
});

test('the hub links to both listings with counts', () => {
  const html = renderHub(pages);
  assert.match(html, /href="\/sets\/role"/);
  assert.match(html, /href="\/sets\/avatar"/);
  assert.match(html, /1 個/);
});

test('a listing links every set of its own type and no others', () => {
  const html = renderListing(LISTINGS[0], pages);
  assert.match(html, /href="\/set\/1-R一"/);
  assert.doesNotMatch(html, /href="\/set\/2-A一"/);
});

test('a listing declares its own canonical', () => {
  assert.match(renderListing(LISTINGS[0], pages), /rel="canonical"[^>]*\/sets\/role"/);
});

test('escapes set names in listings', () => {
  const html = renderListing(LISTINGS[0],
    [{ setId: '1', name: '<b>x</b>', equipmentType: 'role', members: [{}, {}] }]);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});
