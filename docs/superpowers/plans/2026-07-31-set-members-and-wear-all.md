# 套裝成員清單同「著晒成套」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 喺配裝工具嘅裝備 tooltip 加同套成員清單（已著綠／未著灰／著唔到 ✗），
再將卡片上面嗰粒 disabled「快捷」掣換成「著晒成套」／「卸下成套」。

**Architecture:** 全部改動集中喺 `index.html` 一個檔。核心邏輯抽成**三個純函數**
（`setMemberRows`、`setMembersMarkup`、`planWearSet`）—— 冇 closure 依賴，
所以 `tests/` 可以由 source 抽返出嚟用 `new Function` 真係跑，唔使淨靠脆弱嘅
source pattern 斷言。DOM／state 改動留喺 `wearWholeSet` 度，唔測。

**Tech Stack:** 純 vanilla JS classic script（`file://` 直接開得，所以唔可以用
ESM／build step）、`node --test`、`node:assert/strict`。

**Spec:** `docs/superpowers/specs/2026-07-31-set-members-and-wear-all-design.md`

---

## 落手之前要知嘅事

**1. 呢個 repo 冇 build step。** `index.html` 係一個 self-contained 檔，
CSS 同 JS 都 inline。唔好加 `import`／`type="module"`／bundler。

**2. 頂層 function 一律縮排 4 個空格**，收尾係一行 `    }`。測試靠呢個
慣例由 source 抽 function 出嚟，所以新加嘅純函數**必須跟足呢個縮排**。

**3. ⚠️ CSS `filter` 唔可以由子元素撤銷。** Spec 初稿寫過「或者對
`.tooltip-members` 落 `filter:none`」—— 嗰個做法**冇效**：`filter` 落喺
祖先度會 rasterize 成個 subtree，後代點寫都反轉唔到。所以唯一做法係
**收窄 `.tooltip-set.inactive` 本身**，唔好落喺容器度。Task 3 就係做呢樣。

**4. 已知資料事實**（2026-07-31 實測，用嚟寫測試同註解）：
- 1,980 個套裝，419 個有「同一角色有成員著得到、有成員著唔到」
- 672 條組合加成全部係 2 件

**5. ⚠️ 撞位嘅數字係浮動嘅，唔可以攞嚟寫測試。**
本計劃初稿寫過「3 個套裝嘅成員之間會撞部位」（`深幽婚禮套裝(男)` 嘅長褲同禮服
都佔 `lower`），仲叫人寫個測試去斷言呢種套裝存在。**嗰 3 個撞位其實係
`OCCUPY_RULES` 靠名估出嚟嘅假象**，PR #11 拆走條規則之後變咗 **0 個**。

所以：

- **唔好**寫「撞位套裝存在」呢類資料測試 —— 佢會隨住 `build_items.py` 嘅
  `OCCUPY` 人手表增減而 pass/fail，守唔到嘢
- **但 `planWearSet` 嗰段去重照留**。`OCCUPY` 係人手表，會愈填愈多
  （北極熊戲服已經佔 6 格），撞位遲早會返嚟。用 Task 4 嘅合成資料做單元測試，
  唔好靠真實資料

---

## File Structure

| 檔 | 責任 | 動作 |
|---|---|---|
| `index.html` | 成個 SPA（CSS＋JS inline） | 修改：加 3 個純函數、1 個 action、改 2 段 CSS、改 1 行卡片 markup |
| `tests/wear-set.test.mjs` | 本功能嘅回歸測試 | 新增 |

---

## Task 1: 測試骨架同資料不變式

呢個 task 唔改 `index.html`。先鋪好「由 source 抽 function 出嚟跑」嘅
helper，同埋鎖住功能所倚賴嘅三個資料前提。

**Files:**
- Test: `tests/wear-set.test.mjs`（新增）

- [ ] **Step 1: 寫測試檔**

建立 `tests/wear-set.test.mjs`：

```js
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
  // build_items.py 嘅人手表（PR #11），加新一件嗰陣好易順手擺錯次序。
  const wrong = data.items.filter(
    (item) => (item.slots || [item.slot])[0] !== item.slot);
  assert.deepEqual(wrong.map((item) => item.name), []);
});
```

⚠️ **唔好**加「撞位套裝存在」嗰類資料測試 —— 原因見上面第 5 點。

- [ ] **Step 2: 跑測試**

Run: `node --test tests/wear-set.test.mjs`

Expected: 4 條全部 **PASS**。呢批係守門測試（鎖住現有資料事實），
唔係 TDD 嘅 red 階段，所以一開始就應該綠。

如果第 2 條 fail，代表 `items.json` 有 orphan `setId`，停低問返，唔好改測試。

- [ ] **Step 3: Commit**

```bash
git add tests/wear-set.test.mjs
git commit -m "Pin the data facts the set features depend on"
```

---

## Task 2: `setMemberRows` 同 `setMembersMarkup` 兩個純函數

只加函數，未接落 tooltip。

**Files:**
- Modify: `index.html`（喺 `wornSlotsForSet` 之後、`comboStatsFor` 之前插入）
- Test: `tests/wear-set.test.mjs`

- [ ] **Step 1: 寫住 failing test**

喺 `tests/wear-set.test.mjs` 尾加：

```js
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
  const html = setMembersMarkup(setMemberRows(MEMBERS, ['1'], ['3']));
  assert.match(html, /class="tooltip-members"/);
  assert.match(html, /<span class="worn">魔鬼國王的頭髮<\/span>/);
  assert.match(html, /<span class="idle">魔鬼國王的紋樣<\/span>/);
  assert.match(html, /<span class="blocked">✗ 魔鬼國王的鞋<\/span>/);
});

test('setMembersMarkup 冇成員就唔出容器', () => {
  const setMembersMarkup = loadFn('setMembersMarkup');
  assert.equal(setMembersMarkup([]), '');
});
```

- [ ] **Step 2: 跑測試，確認 fail**

Run: `node --test tests/wear-set.test.mjs`

Expected: 新加嗰 4 條 FAIL，訊息係
`index.html 入面搵唔到頂層 function setMemberRows`。

- [ ] **Step 3: 加兩個純函數**

喺 `index.html` 嘅 `wornSlotsForSet` 收尾（`    }`）之後、
`function comboStatsFor(effectiveTypes){` 之前插入：

```js
    // 遊戲背包 tooltip 最底嗰個成員清單：已著綠、未著灰、呢隻角色著唔到加 ✗。
    // 呢兩個同下面 planWearSet 都係純函數、冇 closure 依賴 —— tests/wear-set.test.mjs
    // 會由 source 抽出嚟直接跑，改嘅時候唔好順手攞 setDefs / equipped 呢啲外部變數。
    function setMemberRows(members,wornIds,blockedIds){
      return members.map(item=>{
        const worn=wornIds.includes(item.id);
        // 著咗就係著咗，就算而家揀嘅角色著唔到 —— 照實情出，唔好扮佢冇著
        const blocked=!worn&&blockedIds.includes(item.id);
        return {id:item.id,name:item.name,state:worn?'worn':blocked?'blocked':'idle'};
      });
    }
    function setMembersMarkup(rows){
      if(!rows.length)return '';
      return `<div class="tooltip-members">${rows.map(row=>`<span class="${row.state}">${row.state==='blocked'?'✗ ':''}${row.name}</span>`).join('')}</div>`;
    }
```

- [ ] **Step 4: 跑測試，確認 pass**

Run: `node --test tests/wear-set.test.mjs`

Expected: 8 條全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add index.html tests/wear-set.test.mjs
git commit -m "Add pure helpers for the set member list"
```

---

## Task 3: 接落 tooltip，同埋收窄 `.inactive` 個 filter

**Files:**
- Modify: `index.html:49`（CSS `.tooltip-set.inactive`）
- Modify: `index.html`（CSS 加 `.tooltip-members`）
- Modify: `index.html` 嘅 `getSetTooltipMarkup`
- Test: `tests/wear-set.test.mjs`

- [ ] **Step 1: 寫住 failing test**

喺 `tests/wear-set.test.mjs` 尾加：

```js
test('.tooltip-set.inactive 唔可以將 filter/opacity 落喺成個容器度', () => {
  // CSS filter 落喺祖先度會 rasterize 成個 subtree，後代點寫都撤銷唔到。
  // 落喺容器度 = 套裝未生效時，已著成員嗰隻綠色會被洗走 —— 偏偏就係
  // 套裝未齊嗰陣先最需要見到「仲爭邊幾件」。
  const rule = html.match(/\.tooltip-set\.inactive\{([^}]*)\}/);
  assert.ok(rule, 'index.html 入面搵唔到 .tooltip-set.inactive');
  assert.doesNotMatch(rule[1], /filter|opacity/,
    'filter/opacity 要落喺 .tooltip-set.inactive 嘅直屬 b/span，唔好落喺容器');
});

test('成員清單三隻狀態都有自己嘅色', () => {
  for (const state of ['worn', 'idle', 'blocked']) {
    assert.match(html, new RegExp(`\\.tooltip-members \\.${state}\\{`),
      `CSS 冇定義 .tooltip-members .${state}`);
  }
});

test('getSetTooltipMarkup 有掛住成員清單', () => {
  const source = html.match(/function getSetTooltipMarkup\([\s\S]*?\n {4}\}/);
  assert.ok(source, '搵唔到 getSetTooltipMarkup');
  assert.match(source[0], /setMembersMarkup\(/,
    'tooltip 冇出成員清單');
  assert.match(source[0], /setMemberRows\(/,
    '狀態要行 setMemberRows，唔好喺 template 入面自己再判一次');
});
```

- [ ] **Step 2: 跑測試，確認 fail**

Run: `node --test tests/wear-set.test.mjs`

Expected: 新加嗰 3 條 FAIL —— 第一條因為 `.tooltip-set.inactive` 而家
真係有 `filter:grayscale(1);opacity:.58`。

- [ ] **Step 3: 改 CSS**

`index.html:49` 入面搵：

```css
.tooltip-set.inactive{filter:grayscale(1);opacity:.58}
```

換成（將 filter 由容器移落直屬 `b`／`span`，噉 `.tooltip-members` 就唔會中招）：

```css
.tooltip-set.inactive>b,.tooltip-set.inactive>span{filter:grayscale(1);opacity:.58}
```

跟住喺 `index.html:51` 嗰行（`.tooltip-set span.combo{...}`）之後加：

```css
.tooltip-members{margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,.12)}.tooltip-members span{display:block}.tooltip-members .worn{color:#54f258}.tooltip-members .idle{color:#8b8d94}.tooltip-members .blocked{color:#8b8d94}
```

- [ ] **Step 4: 改 `getSetTooltipMarkup`**

而家個 return（`index.html:413`）尾段係：

```js
${combos?`<b class="combo-head">夾中就發動・唔使成套</b>${combos}`:''}</div>`;
```

喺 `const combos=...` 之後、`return` 之前插入：

```js
      // 成員狀態一律睇【套裝自己生效嗰欄】，唔係 activeLoadout ——
      // 噉先同上面句「・生效中／・未生效」對得上。粒掣係睇 activeLoadout 嘅，
      // 兩者喺跨欄嗰陣唔同步係故意嘅，唔好夾佢哋一致（見 spec）。
      const members=setMembers[item.setId]||[];
      const rows=setMemberRows(members,
        members.filter(member=>equipped[definition.equipmentType][member.id]).map(member=>member.id),
        members.filter(blockedForSelected).map(member=>member.id));
```

再將 return 尾段改成：

```js
${combos?`<b class="combo-head">夾中就發動・唔使成套</b>${combos}`:''}${setMembersMarkup(rows)}</div>`;
```

- [ ] **Step 5: 跑全部測試**

Run: `npm test`

Expected: 全部 PASS（連原有嘅 `set-combos.test.mjs` 等）。

- [ ] **Step 6: Commit**

```bash
git add index.html tests/wear-set.test.mjs
git commit -m "Show set members in the tooltip, worn ones in green"
```

---

## Task 4: `planWearSet` 純函數

**Files:**
- Modify: `index.html`（喺 `setMembersMarkup` 之後插入）
- Test: `tests/wear-set.test.mjs`

- [ ] **Step 1: 寫住 failing test**

```js
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
  // 人手表增減（PR #11 之後係 0）。但一件全身裝就佔 6 格（北極熊戲服），
  // 表填落去撞位一定會返嚟，所以呢段去重要留。
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
```

- [ ] **Step 2: 跑測試，確認 fail**

Run: `node --test tests/wear-set.test.mjs`

Expected: 4 條 FAIL，`搵唔到頂層 function planWearSet`。

- [ ] **Step 3: 實作**

喺 `index.html` 嘅 `setMembersMarkup` 收尾之後插入：

```js
    // 「著晒成套」要著邊幾件。純函數，理由同上面兩個一樣。
    // 分母只計 wearable —— 著唔到／撞位嗰啲唔計，否則粒掣永遠停喺「著晒成套」。
    function planWearSet(members,wornIds,blockedIds){
      const wearable=[],blocked=[],clashed=[],taken=new Set();
      members.forEach(item=>{
        if(blockedIds.includes(item.id)){blocked.push(item.id);return}
        // 成員之間可以撞部位（一件全身裝就佔 6 格），唔去重就會後著頂走前著
        if(item.slots.some(slot=>taken.has(slot))){clashed.push(item.id);return}
        item.slots.forEach(slot=>taken.add(slot));
        wearable.push(item.id);
      });
      const toWear=wearable.filter(id=>!wornIds.includes(id));
      return {wearable,blocked,clashed,toWear,
        allWorn:wearable.length>0&&toWear.length===0};
    }
```

- [ ] **Step 4: 跑測試，確認 pass**

Run: `node --test tests/wear-set.test.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add index.html tests/wear-set.test.mjs
git commit -m "Work out which set pieces a wear-all can actually put on"
```

---

## Task 5: 卡片粒掣同 `wearWholeSet`

**Files:**
- Modify: `index.html:704`（卡片 markup）
- Modify: `index.html:709-719`（`toggleEquipment` 附近，加 `wearWholeSet` 同 listener）
- Modify: `index.html:45` 一帶（CSS `.card-actions`）
- Test: `tests/wear-set.test.mjs`

- [ ] **Step 1: 寫住 failing test**

```js
test('卡片第二粒掣：冇套裝維持 disabled 快捷，有套裝先做得嘢', () => {
  const source = html.match(/const cards=pageItems\.map\([\s\S]*?\n {6}\}\);/);
  assert.ok(source, '搵唔到卡片 markup');
  assert.match(source[0], /data-action="wear-set"/,
    '第二粒掣冇接 wear-set action');
  assert.match(source[0], /快捷/,
    '冇套裝嘅裝備要維持而家嗰粒 disabled「快捷」，唔好改晒佢個外觀');
});

test('wearWholeSet 用 activeLoadout，唔會自動切欄', () => {
  const source = html.match(/const wearWholeSet=[\s\S]*?\n {6}\};/);
  assert.ok(source, '搵唔到 wearWholeSet');
  assert.doesNotMatch(source[0], /activeLoadout=/,
    '唔可以喺度改 activeLoadout —— 「唔自動切欄」係已拍板嘅決定');
  assert.match(source[0], /先生效/,
    '跨欄嗰陣一定要 notify 提返，否則用家會以為壞咗');
});

test('.card-actions 有 wear-set 嘅樣式', () => {
  assert.match(html, /\.card-actions \.wear-set\{/);
});
```

- [ ] **Step 2: 跑測試，確認 fail**

Run: `node --test tests/wear-set.test.mjs`

Expected: 3 條 FAIL。

- [ ] **Step 3: 加 CSS**

`index.html:45` 嗰行入面搵：

```css
.card-actions .disabled{color:#aaa;border-color:#c8c8c8;background:#eee}
```

喺佢後面加（深綠，同遊戲嗰粒一樣，同淺綠嘅「穿著」分得開；
「卸下成套」用橙色，同藍色嘅「已穿著」分得開）：

```css
.card-actions .wear-set{border-color:#0d6b1e;background:linear-gradient(#3fbb52,#0f8c26)}.card-actions .remove-set{border-color:#8a4a00;background:linear-gradient(#f0a444,#c96a06)}
```

- [ ] **Step 4: 改卡片 markup**

`index.html:704` 而家係：

```js
        <div class="card-actions"><button class="${activeEquipped[item.id]?'remove':'wear'}" data-action="toggle">${activeEquipped[item.id]?'已穿著':'穿著'}</button><button class="disabled">快捷</button></div>
```

換成（先喺 `const cards=pageItems.map(item=>` 個 callback 開頭計好狀態）：

```js
      const cards=pageItems.map(item=>{
        const definition=item.setId?setDefs[item.setId]:null;
        const members=definition?(setMembers[item.setId]||[]):[];
        // 睇 activeLoadout —— 粒掣改邊欄就要講邊欄。同上面 tooltip 睇套裝生效欄
        // 唔同步係故意嘅，見 spec。
        const setPlan=definition?planWearSet(members,
          members.filter(member=>activeEquipped[member.id]).map(member=>member.id),
          members.filter(blockedForSelected).map(member=>member.id)):null;
        const setButton=setPlan
          ?`<button class="${setPlan.allWorn?'remove-set':'wear-set'}" data-action="wear-set">${setPlan.allWorn?'卸下成套':'著晒成套'}</button>`
          :'<button class="disabled">快捷</button>';
        return `<article class="item-card" data-id="${item.id}" role="button" tabindex="0" aria-pressed="${Boolean(activeEquipped[item.id])}" aria-label="${activeEquipped[item.id]?'卸下':'穿著'} ${item.name}">
        <button class="favorite">☆</button>${item.equipmentType==='avatar'?'<span class="avatar-mark">A</span>':''}
        <span class="item-icon">${item.img?`<img src="${item.img}" alt="${item.name}" loading="lazy">`:'<span class="icon-missing">?</span>'}</span>
        <h3>${item.name}</h3>
        <div class="card-actions"><button class="${activeEquipped[item.id]?'remove':'wear'}" data-action="toggle">${activeEquipped[item.id]?'已穿著':'穿著'}</button>${setButton}</div>
      </article>`;
      });
```

（原本個 `.map(item=>\`...\`)` 係 arrow-with-expression，而家變咗 block body，
所以要加 `return` 同 `});` 收尾 —— Step 1 個測試就係 match 呢個 `\n      });`。）

- [ ] **Step 5: 加 `wearWholeSet` 同 listener**

喺 `index.html` 嘅 `const toggleEquipment=id=>{...};`（`:709-716`）之後插入：

```js
      const wearWholeSet=id=>{
        const item=itemById.get(id);
        const definition=setDefs[item.setId];
        const members=setMembers[item.setId]||[];
        const plan=planWearSet(members,
          members.filter(member=>equipped[activeLoadout][member.id]).map(member=>member.id),
          members.filter(blockedForSelected).map(member=>member.id));
        const targetName=activeLoadout==='avatar'?'Avatar 裝備':'角色裝備';
        if(plan.allWorn){
          // 卸下就卸走實際著咗嘅全部成員，唔淨係 plan.wearable ——
          // 用家可能自己手動著咗撞位嗰件
          const worn=members.filter(member=>equipped[activeLoadout][member.id]);
          worn.forEach(member=>{delete equipped[activeLoadout][member.id]});
          notify(`已從${targetName}卸下「${definition.name}」${worn.length} 件`);
        }else{
          plan.toWear.forEach(memberId=>{
            const member=itemById.get(memberId);
            equippedItems(activeLoadout).filter(candidate=>candidate.slots.some(slot=>member.slots.includes(slot))).forEach(candidate=>{delete equipped[activeLoadout][candidate.id]});
            equipped[activeLoadout][memberId]=true;
          });
          const skipped=[];
          if(plan.blocked.length)skipped.push(`${plan.blocked.length} 件${characters[selectedCharacter]?.name||'呢隻角色'}著唔到`);
          if(plan.clashed.length)skipped.push(`${plan.clashed.length} 件同部位撞`);
          // 唔自動切欄係拍板嘅決定，代價就係要喺呢度講返 —— 冇咗呢句
          // 個決定就變成 bug：著完乜都冇亮，用家以為壞咗
          const hint=definition.equipmentType!==activeLoadout
            ?`・呢套喺${definition.equipmentType==='avatar'?'Avatar':'角色'}欄先生效`:'';
          notify(`已著「${definition.name}」${plan.wearable.length}/${members.length} 件${skipped.length?`・${skipped.join('・')}`:''}${hint}`);
        }
        syncLoadoutUrl();hideTooltip();renderAll();
      };
```

跟住喺現有嘅 toggle listener（`:717-719`）之後加：

```js
      grid.querySelectorAll('[data-action="wear-set"]').forEach(button=>button.addEventListener('click',event=>{
        event.stopPropagation();wearWholeSet(event.target.closest('.item-card').dataset.id);
      }));
```

- [ ] **Step 6: 跑全部測試**

Run: `npm test`

Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add index.html tests/wear-set.test.mjs
git commit -m "Put the whole set on with one button"
```

---

## Task 6: 喺瀏覽器實地行一次

自動測試冚唔到 DOM 同視覺。呢個 task 冇 code，但**唔可以跳**。

**Files:** 冇

- [ ] **Step 1: 開個 server**

```bash
cd D:/evoke/talesrunner-wardrobe && python -m http.server 8765
```

開 `http://localhost:8765/`。

- [ ] **Step 2: 逐項對**

搜尋「深幽婚禮」，hover 任何一件，對以下六樣：

1. tooltip 最底有成員清單，著咗嘅係綠、未著嘅係灰
2. **套裝未生效（header 寫「・未生效」）嗰陣，已著成員仍然係綠色**
   —— 呢個就係 `.inactive` 個陷阱，睇實佢
3. 撳「著晒成套」，toast 出「已著「深幽婚禮套裝(男)」N/M 件・1 件同部位撞」
4. 再 hover，粒掣變咗「卸下成套」；撳落去成套卸走
5. 切去另一個 loadout 欄，撳一個 avatar 套裝嘅「著晒成套」，
   toast 尾應該有「・呢套喺 Avatar 欄先生效」
6. 隨便搵件冇套裝嘅裝備（例如「材料」分頁），第二粒掣仍然係灰色「快捷」、撳唔郁

- [ ] **Step 3: 揀個著唔到成員嘅個案**

角色揀「光光」，搜尋「傳說的火焰」，hover 隻鞋。
成員清單應該有三行帶 `✗`（髮型／圍巾／翅膀）。
撳「著晒成套」，toast 應該講「1/4 件・3 件光光著唔到」。

- [ ] **Step 4: 有落差就記低**

以上任何一項對唔上，**唔好即刻改**，先寫低實際見到乜，
再返去對 spec 邊度講錯。改完重跑 `npm test`。

- [ ] **Step 5: Commit（如果 Step 4 有改嘢先做）**

```bash
git add index.html
git commit -m "Fix what the browser pass turned up"
```

---

## 收尾

全部 task 做完之後：

```bash
npm test && git log --oneline main..HEAD
```

應該見到 5-6 個 commit。跟住行
`superpowers:finishing-a-development-branch` 決定點合返入 `main`。

⚠️ `main` 直通 production，唔好直接 push 上去。
