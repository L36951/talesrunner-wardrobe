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

const MEMBERS = [
  { id: '1', name: '魔鬼國王的頭髮', slots: ['hair'] },
  { id: '2', name: '魔鬼國王的紋樣', slots: ['upper'] },
  { id: '3', name: '魔鬼國王的鞋', slots: ['shoes'] },
];

test('setMemberRows 分得出已著／未著／著唔到三態', () => {
  const setMemberRows = loadFn('setMemberRows');
  const rows = setMemberRows(MEMBERS, ['1'], ['3']);
  assert.deepEqual(rows.map((row) => row.state), ['worn', 'idle', 'blocked']);
  assert.deepEqual(rows.map((row) => row.name),
    ['魔鬼國王的頭髮', '魔鬼國王的紋樣', '魔鬼國王的鞋']);
});

test('setMemberRows：已著贏過著唔到', () => {
  // 著咗之後先揀去另一隻著唔到嘅角色，件嘢仲喺身上。照實情出「已著」。
  const setMemberRows = loadFn('setMemberRows');
  const rows = setMemberRows(MEMBERS, ['3'], ['3']);
  assert.equal(rows[2].state, 'worn');
});

test('setMembersMarkup 出到三隻色同 ✗ 前綴', () => {
  const setMemberRows = loadFn('setMemberRows');
  const setMembersMarkup = loadFn('setMembersMarkup');
  const markup = setMembersMarkup(setMemberRows(MEMBERS, ['1'], ['3']));
  assert.match(markup, /class="tooltip-members"/);
  assert.match(markup, /<span class="worn">魔鬼國王的頭髮<\/span>/);
  assert.match(markup, /<span class="idle">魔鬼國王的紋樣<\/span>/);
  assert.match(markup, /<span class="blocked">✗ 魔鬼國王的鞋<\/span>/);
});

test('setMembersMarkup 冇成員就唔出容器', () => {
  const setMembersMarkup = loadFn('setMembersMarkup');
  assert.equal(setMembersMarkup([]), '');
});

test('.tooltip-set.inactive 唔可以將 filter/opacity 落喺成個容器度', () => {
  // CSS filter 落喺祖先度會 rasterize 成個 subtree，後代點寫都撤銷唔到。
  // 落喺容器度 = 套裝未生效時，已著成員嗰隻綠色會被洗走 —— 偏偏就係
  // 套裝未齊嗰陣先最需要見到「仲爭邊幾件」。
  const container = html.match(/\.tooltip-set\.inactive\{([^}]*)\}/);
  assert.equal(container, null,
    '.tooltip-set.inactive 唔應該再有「淨係佢自己」嗰條規則 —— '
    + '有嘅話 filter/opacity 會蓋住成個 subtree，包括 .tooltip-members');
  assert.match(html, /\.tooltip-set\.inactive>[^{]*\{[^}]*filter:grayscale/,
    '灰化要落喺 .tooltip-set.inactive 嘅直屬 b/span 度，唔好淨係刪走');
});

test('成員清單三隻狀態都有自己嘅色', () => {
  for (const state of ['worn', 'idle', 'blocked']) {
    assert.match(html, new RegExp(`\.tooltip-members \.${state}\{`),
      `CSS 冇定義 .tooltip-members .${state}`);
  }
});

test('getSetTooltipMarkup 有掛住成員清單', () => {
  const source = html.match(/function getSetTooltipMarkup\([\s\S]*?\n {4}\}/);
  assert.ok(source, '搵唔到 getSetTooltipMarkup');
  assert.match(source[0], /setMembersMarkup\(/, 'tooltip 冇出成員清單');
  assert.match(source[0], /setMemberRows\(/,
    '狀態要行 setMemberRows，唔好喺 template 入面自己再判一次');
});

test('planWearSet：跳過著唔到嘅成員，分母唔計佢', () => {
  const planWearSet = loadFn('planWearSet');
  const plan = planWearSet(MEMBERS, [], ['3']);
  assert.deepEqual(plan.wearable, ['1', '2']);
  assert.deepEqual(plan.toWear, ['1', '2']);
  assert.deepEqual(plan.blocked, ['3']);
  assert.equal(plan.allWorn, false);
});

test('planWearSet：著得到嘅全部著晒就算 allWorn，唔理著唔到嗰啲', () => {
  // 唔計著唔到嗰啲入分母，否則得 2/3 件著得到嘅套裝，粒掣永遠停喺「著晒成套」。
  const planWearSet = loadFn('planWearSet');
  const plan = planWearSet(MEMBERS, ['1', '2'], ['3']);
  assert.deepEqual(plan.toWear, []);
  assert.equal(plan.allWorn, true);
});

test('planWearSet：成員之間撞部位，後面嗰件要讓開', () => {
  // 用合成資料，唔靠真實資料 —— 真實撞位數字會隨 build_items.py 嘅 OCCUPY
  // 人手表增減。但一件全身裝就佔 6 格（北極熊戲服），表填落去撞位一定會返嚟。
  const planWearSet = loadFn('planWearSet');
  const clashing = [
    { id: 'a', name: '全身戲服', slots: ['upper', 'lower'] },
    { id: 'b', name: '長褲', slots: ['lower'] },
    { id: 'c', name: '鞋', slots: ['shoes'] },
  ];
  const plan = planWearSet(clashing, [], []);
  assert.deepEqual(plan.wearable, ['a', 'c']);
  assert.deepEqual(plan.clashed, ['b']);
});

test('planWearSet：一件都著唔到就唔算 allWorn', () => {
  const planWearSet = loadFn('planWearSet');
  const plan = planWearSet(MEMBERS, [], ['1', '2', '3']);
  assert.deepEqual(plan.wearable, []);
  assert.equal(plan.allWorn, false, '空套裝唔可以扮已經著晒');
});

test('卡片第二粒掣：冇套裝維持 disabled 快捷，有套裝先做得嘢', () => {
  const source = html.match(/const cards=pageItems\.map\([\s\S]*?\n {6}\}\);/);
  assert.ok(source, '搵唔到卡片 markup');
  assert.match(source[0], /data-action="wear-set"/, '第二粒掣冇接 wear-set action');
  assert.match(source[0], /快捷/,
    '冇套裝嘅裝備要維持而家嗰粒 disabled「快捷」，唔好改晒佢個外觀');
});

test('wearWholeSet 用 activeLoadout，唔會自動切欄', () => {
  const source = html.match(/const wearWholeSet=[\s\S]*?\n {6}\};/);
  assert.ok(source, '搵唔到 wearWholeSet');
  // `[^=]` 係為咗唔好撞正 `activeLoadout==='avatar'` 呢類比較
  assert.doesNotMatch(source[0], /activeLoadout\s*=[^=]/,
    '唔可以喺度改 activeLoadout —— 「唔自動切欄」係已拍板嘅決定');
  assert.match(source[0], /先生效/,
    '跨欄嗰陣一定要 notify 提返，否則用家會以為壞咗');
});

test('.card-actions 有 wear-set 嘅樣式', () => {
  assert.match(html, /\.card-actions \.wear-set\{/);
});
