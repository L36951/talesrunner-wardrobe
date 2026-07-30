import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSetPage, SITE_ORIGIN } from '../scripts/lib/render-set.mjs';

const data = {
  characters: { '1': { name: '光光', sex: 'M', order: 0 } },
  wearGroups: [[]],
};

const page = {
  setId: '1259',
  name: '青花瓷套裝(男)',
  equipmentType: 'role',
  setStats: [['最高速度 +1', 'blue']],
  members: [
    { id: '1', name: '青花瓷羽毛(男)', subcategory: '頭部',
      icon: 'head/a.webp', stats: [['最高速度 +1', 'blue']] },
    { id: '2', name: '青花瓷長筒靴(男)', subcategory: '鞋子',
      icon: 'shoes/b.webp', stats: [['加速度 +2', 'blue']] },
  ],
};

const render = (overrides = {}) =>
  renderSetPage({ page, data, related: [], counterpart: null, ...overrides });

test('puts the set name in the title and the h1', () => {
  const html = render();
  assert.match(html, /<title>青花瓷套裝\(男\)｜/);
  assert.match(html, /<h1>青花瓷套裝\(男\)<\/h1>/);
});

test('declares a canonical URL built from the set path', () => {
  assert.match(render(),
    new RegExp(`<link rel="canonical" href="${SITE_ORIGIN}/set/1259-青花瓷套裝-男"`));
});

test('uses absolute image paths so they survive the nested directory', () => {
  const html = render();
  assert.match(html, /src="\/assets\/itemimage\/head\/a\.webp"/);
  assert.doesNotMatch(html, /src="assets\//);
});

test('gives every member image an alt of the item name', () => {
  assert.match(render(), /alt="青花瓷羽毛\(男\)"/);
});

test('lists the set bonus', () => {
  const html = render();
  assert.match(html, /<table class="data">[\s\S]*最高速度[\s\S]*\+1[\s\S]*<\/table>/);
});

test('falls back to explanatory copy when the set has no bonus', () => {
  const html = render({ page: { ...page, setStats: [] } });
  assert.match(html, /冇套裝效果/);
});

test('shows the summed member stats', () => {
  const html = render();
  assert.match(html, /著齊全套合計[\s\S]*加速度[\s\S]*\+2/);
});

test('opens with a lead sentence naming the members', () => {
  const html = render();
  assert.match(html, /青花瓷套裝\(男\) 係《跑Online》嘅角色裝備套裝/);
  assert.match(html, /青花瓷羽毛\(男\)、青花瓷長筒靴\(男\)/);
});

test('links the shared stylesheet', () => {
  assert.match(render(), /<link rel="stylesheet" href="\/assets\/set-page\.css">/);
});

test('carries an infobox', () => {
  const html = render();
  assert.match(html, /<aside class="infobox">/);
  assert.match(html, /3 件|2 件/);
});

test('stacks a member’s stats instead of running them together', () => {
  const html = render({
    page: {
      ...page,
      members: [{
        ...page.members[0],
        stats: [['力量 +3', 'blue'], ['控制 +5', 'blue'], ['EXP +70%', 'blue']],
      }],
    },
  });
  assert.match(html, /力量 \+3<\/span><br>/);
  assert.doesNotMatch(html, /力量 \+3<\/span>、/);
});

test('puts the counterpart in a hatnote at the top, not a section at the bottom', () => {
  const html = render({ counterpart: { setId: '1260', name: '青花瓷套裝(女)' } });
  assert.match(html, /class="hatnote"/);
  const hatnoteAt = html.indexOf('hatnote');
  const membersAt = html.indexOf('成員裝備');
  assert.ok(hatnoteAt > 0 && hatnoteAt < membersAt, 'hatnote should precede the member list');
});

test('omits the hatnote when there is no counterpart', () => {
  assert.doesNotMatch(render(), /class="hatnote"/);
});

test('escapes names that contain HTML characters', () => {
  const html = render({
    page: { ...page, name: '<script>x</script>' },
  });
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
});

test('links to the gender counterpart when there is one', () => {
  const html = render({
    counterpart: { setId: '1260', name: '青花瓷套裝(女)' },
  });
  assert.match(html, /href="\/set\/1260-青花瓷套裝-女"/);
});

test('never emits a canonical pointing at the counterpart', () => {
  const html = render({ counterpart: { setId: '1260', name: '青花瓷套裝(女)' } });
  const canonicals = html.match(/<link rel="canonical"[^>]*>/g);
  assert.equal(canonicals.length, 1);
  assert.match(canonicals[0], /1259/);
});

test('emits a try-on deep link', () => {
  assert.match(render(), /href="\/#v=1&amp;char=1&amp;avatar=&amp;role=1,2&amp;view=role"/);
});

test('says so when no character can wear the whole set', () => {
  const html = render({
    page: { ...page, members: [{ ...page.members[0], sexLock: 'F' }, page.members[1]] },
  });
  assert.match(html, /冇角色可以著齊/);
});

test('renders related set links', () => {
  const html = render({ related: [{ setId: '99', name: '別的套裝' }] });
  assert.match(html, /href="\/set\/99-別的套裝"/);
});

test('emits JSON-LD naming the set', () => {
  const html = render();
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(block, 'expected a JSON-LD block');
  const parsed = JSON.parse(block[1]);
  assert.equal(parsed.name, '青花瓷套裝(男)');
  assert.equal(parsed.numberOfItems, 2);
});

test('renders member descriptions, which are most of the page text on sparse sets', () => {
  const html = renderSetPage({
    page: {
      ...page,
      members: [{ ...page.members[0], description: '繡有永不熄滅的地獄的極限藍焰' }],
    },
    data, related: [], counterpart: null,
  });
  assert.match(html, /繡有永不熄滅的地獄的極限藍焰/);
});

test('escapes a member description', () => {
  const html = renderSetPage({
    page: { ...page, members: [{ ...page.members[0], description: '<b>x</b>' }] },
    data, related: [], counterpart: null,
  });
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

test('a name containing a script tag cannot break out of the JSON-LD block', () => {
  const html = renderSetPage({
    page: { ...page, name: '</script><img onerror=alert(1)>' },
    data, related: [], counterpart: null,
  });
  const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g);
  assert.equal(blocks.length, 1);
  assert.doesNotMatch(html, /<img onerror/);
});
