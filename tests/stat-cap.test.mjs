import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 基礎能力值上限。客戶端寫死咗絕對封頂 20，唔係「15 ＋ 最大值提升」加到幾多得幾多。
// capFor 住喺 index.html 嘅 classic script 度（噉樣 file:// 直接開都用得），
// import 唔到，所以呢度驗個 source 同埋啲數，唔行佢。
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(
  readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));

const RAISER = '最高速度最大值';
const valueOf = (text) => Number(text.slice(text.lastIndexOf('+') + 1));

test('items.json 帶埋兩個上限', () => {
  assert.equal(data.baseStatCap, 15);
  assert.equal(data.statHardCap, 20);
});

test('capFor 有夾住客戶端封頂', () => {
  const source = html.match(/function capFor\(name,raiserValue\)\{(.*?)\}/);
  assert.ok(source, 'index.html 入面搵唔到 capFor');
  assert.match(source[1], /Math\.min\(statHardCap,/,
    'capFor 淨係加 baseStatCap 就會畀出 21，超過客戶端封頂');
});

test('statHardCap 由 items.json 讀返，唔係寫死喺前端', () => {
  assert.match(html, /if\(data\.statHardCap\)statHardCap=data\.statHardCap/);
});

test('封頂夾得到 —— 唔係理論值', () => {
  // 逐個部位攞最高嗰件，再加套裝：最高速度真係去得到 21
  const best = new Map();
  for (const item of data.items) {
    for (const [text] of item.stats ?? []) {
      if (text.startsWith(RAISER)) {
        best.set(item.slot, Math.max(best.get(item.slot) ?? 0, valueOf(text)));
      }
    }
  }
  const fromSets = Math.max(0, ...Object.values(data.sets).flatMap(
    (set) => (set.stats ?? [])
      .filter(([t]) => t.startsWith(RAISER)).map(([t]) => valueOf(t))));
  const reachable = [...best.values()].reduce((a, b) => a + b, 0) + fromSets;

  assert.ok(data.baseStatCap + reachable > data.statHardCap,
    `夾到 ${data.baseStatCap + reachable}，冇超過封頂就唔使加呢個限制`);
});

test('另外兩項暫時撞唔到頂，但一樣受同一條規管', () => {
  for (const raiser of ['加速度最大值', '控制最大值']) {
    const found = data.items.some(
      (item) => (item.stats ?? []).some(([t]) => t.startsWith(raiser)));
    assert.ok(found, `${raiser} 應該有裝備帶住`);
  }
  assert.deepEqual(
    Object.values(data.capRaisers).sort(),
    ['最高速度最大值', '加速度最大值', '控制最大值'].sort());
});
