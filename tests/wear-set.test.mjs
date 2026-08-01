import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 本功能嘅邏輯住喺 index.html 嘅 classic script 入面（噉樣 file:// 直接開都用得），
// import 唔到。但我哋刻意將佢寫成冇 closure 依賴嘅純函數，所以可以由 source
// 抽返出嚟真係跑 —— 好過齋斷言 source pattern。
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(
  readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));

// 頂層 function 縮排 4 個空格、收尾一行「    }」。新加嘅純函數要跟足。
//
// 呢度個 new Function() 餵入去嘅係本 repo 嘅 index.html 原始碼，唔係外來輸入，
// 而且淨係喺 `npm test` 本機跑。`name` 亦都係下面幾個測試寫死嘅字串。
// 唔好改成接受外部參數 —— 一接就變成任意程式碼執行。
function loadFn(name) {
  const match = html.match(new RegExp(`\\n {4}(function ${name}\\([\\s\\S]*?\\n {4}\\})`));
  assert.ok(match, `index.html 入面搵唔到頂層 function ${name}`);
  return new Function(`${match[1]}\nreturn ${name};`)();
}

const membersBySet = {};
for (const item of data.items) {
  if (item.setId) (membersBySet[item.setId] ||= []).push(item);
}

test('有套裝係「同一個角色，有成員著得到有成員著唔到」', () => {
  // 2026-07-31 實測 419 / 1,980。唔寫死精確數字 —— 上游 patch 之後會浮動。
  // 呢條守住「跳過著唔到嘅成員」唔係防禦死碼，係真係行得到嘅路徑。
  const canWear = (item, cid) => {
    const n = Number(cid);
    if (item.wearGroup != null) {
      const group = data.wearGroups[item.wearGroup];
      if (group && group.length && !group.includes(n)) return false;
    }
    if (item.sexLock) {
      const sex = data.characters[cid]?.sex;
      if (sex && sex !== item.sexLock) return false;
    }
    return !(Array.isArray(item.blockedFor) && item.blockedFor.includes(n));
  };
  const mixed = Object.values(membersBySet).filter((members) => {
    if (members.length < 2) return false;
    return Object.keys(data.characters).some((cid) => {
      const yes = members.filter((item) => canWear(item, cid)).length;
      return yes > 0 && yes < members.length;
    });
  });
  assert.ok(mixed.length > 0, '冇呢種套裝嘅話，「跳過」嗰條路就永遠行唔到');
});

test('每件有 setId 嘅裝備都查得返套裝定義', () => {
  // 粒掣同 tooltip 都要 setDefs[item.setId]，查唔到就會炸。
  const missing = data.items.filter(
    (item) => item.setId && !data.sets[item.setId]);
  assert.deepEqual(missing.map((item) => item.name), []);
});

test('組合加成全部係 2 件', () => {
  // 2026-07-31 實測 672 條全部係 2。tooltip 嘅「◯＋◯」寫法建基於呢個假設。
  const sizes = new Set();
  for (const set of Object.values(data.sets)) {
    for (const combo of set.comboStats || []) sizes.add(combo.slots.length);
  }
  assert.deepEqual([...sizes], [2]);
});

test('每件裝備嘅 slots 都由佢自己嗰格打頭', () => {
  // planWearSet 同 tooltip 都假設 slots[0] 就係 item.slot。多部位佔用而家係
  // build_items.py 嘅人手表，加新一件嗰陣好易順手擺錯次序。
  const wrong = data.items.filter(
    (item) => (item.slots || [item.slot])[0] !== item.slot);
  assert.deepEqual(wrong.map((item) => item.name), []);
});
