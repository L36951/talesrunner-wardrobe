import test from 'node:test';
import assert from 'node:assert/strict';
import { collectLinkTargets, assertEveryPageReachable } from '../scripts/build-seo.mjs';

const pages = [
  { setId: '1', name: 'A', equipmentType: 'role', members: [{}, {}] },
  { setId: '2', name: 'B', equipmentType: 'role', members: [{}, {}] },
];

test('collectLinkTargets counts listing links as inbound', () => {
  const inbound = collectLinkTargets(pages, new Map(), new Map());
  assert.equal(inbound.get('1'), 1);
  assert.equal(inbound.get('2'), 1);
});

test('collectLinkTargets adds related and counterpart links', () => {
  const related = new Map([['1', [pages[1]]]]);
  const counterparts = new Map([['2', pages[0]]]);
  const inbound = collectLinkTargets(pages, related, counterparts);
  assert.equal(inbound.get('2'), 2);
  assert.equal(inbound.get('1'), 2);
});

test('assertEveryPageReachable passes when all pages have inbound links', () => {
  assert.doesNotThrow(() =>
    assertEveryPageReachable(pages, new Map([['1', 1], ['2', 1]])));
});

test('assertEveryPageReachable throws and names the orphans', () => {
  assert.throws(
    () => assertEveryPageReachable(pages, new Map([['1', 1]])),
    /2/,
  );
});
