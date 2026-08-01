import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(
  readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));

// 同 tests/wear-set.test.mjs 一樣由 source 抽頂層 function 出嚟真係跑，但呢度要
// 一次過抽幾支 —— locateItem 內部會叫 visibleItemsIn，單獨抽一支就 ReferenceError。
//
// 餵入 new Function() 嘅係本 repo 嘅 index.html 原始碼，唔係外來輸入，而且淨係
// 喺 `npm test` 本機跑。names 亦都係下面測試寫死嘅字串。唔好改成接受外部參數。
function loadFns(...names) {
  const sources = names.map((name) => {
    const match = html.match(
      new RegExp(`\\n {4}(function ${name}\\([\\s\\S]*?\\n {4}\\})`));
    assert.ok(match, `index.html 入面搵唔到頂層 function ${name}`);
    return match[1];
  });
  return new Function(`${sources.join('\n')}\nreturn {${names.join(',')}};`)();
}

// 40 件一模一樣嘅上衣，夠跨到第三版（PAGE_SIZE=16）
const FIXTURE = Array.from({ length: 40 }, (_, i) => ({
  id: String(i + 1), name: `衫${i + 1}`, character: 0,
  category: '服裝', subcategory: '上衣', description: '', occupancy: '上衣',
  equipmentType: 'avatar', stats: [], channelStats: [], extra: '',
}));
const NEVER = () => false;

test('visibleItemsIn：冇 query 就照 category ＋ subtab 對位', () => {
  const { visibleItemsIn } = loadFns('visibleItemsIn');
  const list = [
    FIXTURE[0],
    { ...FIXTURE[1], subcategory: '鞋子' },
    { ...FIXTURE[2], category: '飾品', subcategory: '頭部' },
  ];
  const out = visibleItemsIn(list, {
    category: '服裝', subtab: '上衣', query: '',
    character: '1', isBlocked: NEVER,
  });
  assert.deepEqual(out.map((item) => item.id), ['1']);
});

test('visibleItemsIn：有 query 就跨分類搜，唔理 category／subtab', () => {
  const { visibleItemsIn } = loadFns('visibleItemsIn');
  const list = [{ ...FIXTURE[0], name: '月光帽', category: '飾品', subcategory: '頭部' }];
  const out = visibleItemsIn(list, {
    category: '服裝', subtab: '上衣', query: '月光',
    character: '1', isBlocked: NEVER,
  });
  assert.equal(out.length, 1);
});

test('visibleItemsIn：第二隻角色專屬嘅唔出，通用（character 0）嘅照出', () => {
  const { visibleItemsIn } = loadFns('visibleItemsIn');
  const list = [FIXTURE[0], { ...FIXTURE[1], character: 2 }, { ...FIXTURE[2], character: 1 }];
  const out = visibleItemsIn(list, {
    category: '服裝', subtab: '上衣', query: '',
    character: '1', isBlocked: NEVER,
  });
  assert.deepEqual(out.map((item) => item.id), ['1', '3']);
});

test('visibleItemsIn：isBlocked 講著唔到嘅唔出', () => {
  const { visibleItemsIn } = loadFns('visibleItemsIn');
  const out = visibleItemsIn(FIXTURE.slice(0, 3), {
    category: '服裝', subtab: '上衣', query: '',
    character: '1', isBlocked: (item) => item.id === '2',
  });
  assert.deepEqual(out.map((item) => item.id), ['1', '3']);
});
