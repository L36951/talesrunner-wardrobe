import test from 'node:test';
import assert from 'node:assert/strict';
import { toSlug, setPath } from '../scripts/lib/slug.mjs';

test('turns full-width and half-width brackets into hyphens', () => {
  assert.equal(toSlug('青花瓷套裝(男)'), '青花瓷套裝-男');
  assert.equal(toSlug('異世界（女）組合'), '異世界-女-組合');
});

test('leaves a plain name alone', () => {
  assert.equal(toSlug('暗黑騎士套裝'), '暗黑騎士套裝');
});

test('never leaves a leading or trailing hyphen', () => {
  assert.equal(toSlug('(限定)聖言小丑'), '限定-聖言小丑');
  assert.equal(toSlug('20周年紀念T恤(紅)'), '20周年紀念T恤-紅');
});

test('collapses runs of separators', () => {
  assert.equal(toSlug('A  / B'), 'A-B');
});

test('setPath prefixes the stable set id', () => {
  assert.equal(setPath('1259', '青花瓷套裝(男)'), '/set/1259-青花瓷套裝-男');
});
