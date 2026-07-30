import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInfobox } from '../scripts/lib/infobox.mjs';

const base = {
  page: {
    setId: '1259', name: '青花瓷套裝(男)', equipmentType: 'role',
    setStats: [['最高速度 +1', 'blue']],
    members: [
      { name: '羽毛', subcategory: '頭部', icon: 'a/1.webp' },
      { name: '長靴', subcategory: '鞋子', icon: 'b/2.webp' },
      { name: '上衣', subcategory: '上衣', icon: 'c/3.webp' },
    ],
  },
  wearerCount: 29,
  characterCount: 50,
  counterpart: null,
  tryOnUrl: '/#v=1&char=1',
};

const render = (over = {}) => renderInfobox({ ...base, ...over });

test('titles the box with the set name', () => {
  assert.match(render(), /<div class="ib-title">青花瓷套裝\(男\)<\/div>/);
});

test('shows every member icon with an absolute path and an alt', () => {
  const html = render();
  assert.equal((html.match(/<img /g) ?? []).length, 3);
  assert.match(html, /src="\/assets\/itemimage\/a\/1\.webp" alt="羽毛"/);
  assert.doesNotMatch(html, /src="assets\//);
});

test('reports kind, size and the wearable ratio', () => {
  const html = render();
  assert.match(html, /角色裝備/);
  assert.match(html, /3 件/);
  assert.match(html, /29 \/ 50 個角色/);
});

test('calls an avatar set an Avatar set', () => {
  assert.match(render({ page: { ...base.page, equipmentType: 'avatar' } }), /Avatar/);
});

test('de-duplicates slots but keeps member order', () => {
  const members = [
    { name: 'a', subcategory: '上衣', icon: 'x.webp' },
    { name: 'b', subcategory: '頭部', icon: 'y.webp' },
    { name: 'c', subcategory: '上衣', icon: 'z.webp' },
  ];
  assert.match(render({ page: { ...base.page, members } }), /上衣、頭部/);
});

test('lists the set bonus, or says there is none', () => {
  assert.match(render(), /最高速度 \+1/);
  assert.match(render({ page: { ...base.page, setStats: [] } }), /冇/);
});

test('links the counterpart only when there is one', () => {
  assert.doesNotMatch(render(), /另一版本/);
  const html = render({ counterpart: { setId: '1260', name: '青花瓷套裝(女)' } });
  assert.match(html, /另一版本/);
  assert.match(html, /href="\/set\/1260-青花瓷套裝-女"/);
});

test('never emits a canonical - that belongs to the page, not the box', () => {
  assert.doesNotMatch(render({ counterpart: { setId: '1260', name: 'X' } }), /canonical/);
});

test('carries the try-on call to action', () => {
  assert.match(render(), /class="ib-cta"/);
  assert.match(render(), /href="\/#v=1&amp;char=1"/);
});

test('escapes a hostile set name', () => {
  const html = render({ page: { ...base.page, name: '<b>x</b>' } });
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});
