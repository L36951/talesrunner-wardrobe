# 撳左欄裝備跳去櫥櫃嗰一版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 撳左邊 Avatar／角色欄嘅已著裝備格，右邊櫥櫃翻到嗰件裝備所在嗰一版，卡片閃一閃。

**Architecture:** 把 `renderGrid` 嘅 filter 抽做純函數 `visibleItemsIn`，再喺上面砌 `locateItem` 計頁碼；兩支都冇 closure 依賴，測試由 `index.html` source 抽出嚟真係跑。改狀態嘅 `revealItem` 獨立一支，rail 嘅 click／鍵盤只係叫佢。

**Tech Stack:** 單檔 SPA（`index.html`，classic script，冇 build step）、`node --test`（`npm test`）、Python `http.server` 做本機靜態 server。

**Spec:** `docs/superpowers/specs/2026-08-01-rail-reveals-item-design.md`

---

## File Structure

| 檔 | 責任 | 動作 |
|---|---|---|
| `index.html` | 成個 SPA。新增 `visibleItemsIn`／`locateItem`（純）、`revealItem`／`syncCategoryTabs`（有狀態）、`.revealed` 動畫、rail 嘅 click／keydown | 改 |
| `tests/reveal-item.test.mjs` | 上述兩支純函數嘅行為，加兩條釘死上游資料前提嘅斷言 | 新增 |

`index.html` 係一個大檔，但呢個係本 repo 既定嘅結構（`file://` 直接開得），**唔好順手拆檔**。新函數擺喺現有純函數嗰堆隔籬（`planWearSet` 之後，即 `index.html:408` 附近）。

⚠️ **所有新增嘅頂層 function 必須縮排 4 個空格、收尾一行淨係 `    }`。** 測試靠呢個 pattern 由 source 抽函數出嚟，唔跟就抽唔到（`tests/wear-set.test.mjs:12`）。

---

## Task 1: 測試腳手架 ＋ `visibleItemsIn`

**Files:**
- Create: `tests/reveal-item.test.mjs`
- Modify: `index.html`（喺 `planWearSet` 收尾之後，`index.html:408` 附近插入）

- [ ] **Step 1: 寫失敗測試**

新增 `tests/reveal-item.test.mjs`：

```js
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
```

- [ ] **Step 2: 跑，確認佢真係失敗**

Run: `npm test`
Expected: FAIL，四條都係 `index.html 入面搵唔到頂層 function visibleItemsIn`

- [ ] **Step 3: 加 `visibleItemsIn`**

喺 `index.html` `planWearSet` 收尾嗰行 `    }`（`index.html:408`）之後插入：

```js
    // 櫥櫃實際見到邊幾件。renderGrid 同 locateItem 共用同一支 —— 兩份 filter
    // 一日唔同步，locateItem 計出嚟嗰個頁碼就會靜靜哋錯：跳到一版，件嘢唔喺度。
    // 同 planWearSet 一樣係純函數，character／isBlocked 由參數入，唔好攞外部變數。
    function visibleItemsIn(list,options){
      const normalizedQuery=(options.query||'').trim().toLocaleLowerCase();
      return list.filter(item=>{
        // character 0 = 全角色通用，其餘係該角色專屬
        if(item.character!==0&&String(item.character)!==String(options.character))return false;
        // 白名單以外：呢個角色根本著唔到
        if(options.isBlocked(item))return false;
        if(!normalizedQuery)return item.category===options.category&&item.subcategory===options.subtab;
        const searchable=[item.name,item.description,item.category,item.subcategory,item.occupancy,item.equipmentType,...item.stats.map(([text])=>text),...item.channelStats.map(([text])=>text),item.extra].join(' ').toLocaleLowerCase();
        return searchable.includes(normalizedQuery);
      });
    }
```

- [ ] **Step 4: 跑，確認轉綠**

Run: `npm test`
Expected: PASS，全部測試綠（包括原有嗰啲）

- [ ] **Step 5: Commit**

```bash
git add tests/reveal-item.test.mjs index.html
git commit -m "Pull the wardrobe filter out into a pure function"
```

---

## Task 2: `renderGrid` 改用同一支 filter

**Files:**
- Modify: `index.html:726-735`

呢個 task 冇新測試 —— `renderGrid` 係純 DOM，跑唔到。佢係整個設計嘅重點（兩份 filter 唔可以並存），所以靠瀏覽器實測頂。

- [ ] **Step 1: 換走 renderGrid 自己嗰份 filter**

`index.html:726-735` 而家係：

```js
      const normalizedQuery=searchQuery.trim().toLocaleLowerCase();
      const visibleItems=items.filter(item=>{
        // character 0 = 全角色通用，其餘係該角色專屬
        if(item.character!==0&&String(item.character)!==selectedCharacter)return false;
        // 白名單以外：呢個角色根本著唔到
        if(blockedForSelected(item))return false;
        if(!normalizedQuery)return item.category===selectedCategory&&item.subcategory===selectedSubtab;
        const searchable=[item.name,item.description,item.category,item.subcategory,item.occupancy,item.equipmentType,...item.stats.map(([text])=>text),...item.channelStats.map(([text])=>text),item.extra].join(' ').toLocaleLowerCase();
        return searchable.includes(normalizedQuery);
      });
```

整段（連 `normalizedQuery` 嗰行，下面冇再用佢）換成：

```js
      const visibleItems=visibleItemsIn(items,{category:selectedCategory,subtab:selectedSubtab,
        query:searchQuery,character:selectedCharacter,isBlocked:blockedForSelected});
```

- [ ] **Step 2: 起本機 server**

```bash
python -m http.server 8777 --bind 127.0.0.1
```

（另開一個 shell，或者背景跑。收工記得熄。）

- [ ] **Step 3: 瀏覽器行一次，確認櫥櫃冇變**

開 `http://127.0.0.1:8777/index.html`，逐樣試：

1. 預設落嚟係「服裝／上衣」，分頁器右下角讀到「共 1,242 件」（角色 1）—— 數字同改之前一樣
2. 撳「飾品」→「頭部」，有嘢出
3. 搜尋框打「月光」，見到跨分類嘅結果
4. 清空搜尋，返到「飾品／頭部」
5. 撳左上角換另一隻角色，件數會變（因為 `blockedForSelected`）

Expected: 五樣全部同改之前一樣。任何一樣唔同 = filter 搬錯咗。

- [ ] **Step 4: 跑齊測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Make renderGrid use the shared filter"
```

---

## Task 3: `locateItem`

**Files:**
- Modify: `tests/reveal-item.test.mjs`（加測試）、`index.html`（`visibleItemsIn` 之後）

- [ ] **Step 1: 寫失敗測試**

`tests/reveal-item.test.mjs` 尾加：

```js
const SPOT = { character: '1', isBlocked: NEVER, pageSize: 16 };

test('locateItem：第 16 件仲喺第一版，第 17 件過版', () => {
  const { locateItem } = loadFns('visibleItemsIn', 'locateItem');
  assert.equal(locateItem(FIXTURE, FIXTURE[15], SPOT).page, 0);
  assert.equal(locateItem(FIXTURE, FIXTURE[16], SPOT).page, 1);
});

test('locateItem：回埋要跳去邊個 tab', () => {
  const { locateItem } = loadFns('visibleItemsIn', 'locateItem');
  const boots = { ...FIXTURE[0], id: '99', subcategory: '鞋子' };
  assert.deepEqual(locateItem([boots], boots, SPOT),
    { category: '服裝', subtab: '鞋子', page: 0 });
});

test('locateItem：頁數用濾完嘅清單計，唔計第二隻角色專屬嗰啲', () => {
  const { locateItem } = loadFns('visibleItemsIn', 'locateItem');
  // 頭 20 件改成第二隻角色專屬：目標由原始清單第 21 位，變成實際清單第 1 位。
  // 攞原始 index 計就會答第 1 版，跳過去件嘢唔喺度。
  const list = FIXTURE.map((item, i) => (i < 20 ? { ...item, character: 2 } : item));
  assert.deepEqual(locateItem(list, list[20], SPOT),
    { category: '服裝', subtab: '上衣', page: 0 });
});

test('locateItem：呢隻角色著唔到就回 null', () => {
  const { locateItem } = loadFns('visibleItemsIn', 'locateItem');
  const spot = locateItem(FIXTURE, FIXTURE[0],
    { ...SPOT, isBlocked: (item) => item.id === '1' });
  assert.equal(spot, null);
});

test('locateItem：件嘢唔喺清單就回 null，唔會回負數版', () => {
  const { locateItem } = loadFns('visibleItemsIn', 'locateItem');
  const outsider = { ...FIXTURE[0], id: '999' };
  assert.equal(locateItem(FIXTURE, outsider, SPOT), null);
});
```

- [ ] **Step 2: 跑，確認失敗**

Run: `npm test`
Expected: FAIL，五條都係 `index.html 入面搵唔到頂層 function locateItem`

- [ ] **Step 3: 加 `locateItem`**

喺 `index.html` `visibleItemsIn` 收尾嗰行 `    }` 之後插入：

```js
    // 件裝備喺櫥櫃邊一版。用件裝備自己嘅 category／subcategory 做目標 tab，
    // query 當空（撳左欄一律清搜尋）。搵唔到回 null —— 見 revealItem 點處理。
    function locateItem(list,item,options){
      const scoped=visibleItemsIn(list,{category:item.category,subtab:item.subcategory,
        query:'',character:options.character,isBlocked:options.isBlocked});
      const index=scoped.findIndex(candidate=>candidate.id===item.id);
      if(index<0)return null;
      return {category:item.category,subtab:item.subcategory,
        page:Math.floor(index/options.pageSize)};
    }
```

- [ ] **Step 4: 跑，確認轉綠**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/reveal-item.test.mjs index.html
git commit -m "Work out which wardrobe page an item sits on"
```

---

## Task 4: 釘死兩條上游資料前提

**Files:**
- Modify: `tests/reveal-item.test.mjs`

呢兩條係資料斷言，**寫完應該即刻綠**（2026-08-01 已實測），唔會經歷 red 階段。佢哋守嘅係
`locateItem` 靜靜哋依賴緊、但代碼保證唔到嘅嘢：上游 patch 加一個新 subcategory 就會爆。

- [ ] **Step 1: 加測試**

`tests/reveal-item.test.mjs` 尾加（`loadObject` 擺喺檔頂 `loadFns` 隔籬）：

```js
// subtabsByCategory 係 const object 唔係 function，loadFns 抽唔到。抽 source 出嚟
// 係要緊嘅 —— 喺測試度抄一份副本，就守唔到「index.html 改咗但資料冇跟」嗰種漂移。
function loadObject(name) {
  const match = html.match(new RegExp(`\\n {4}const ${name}=(\\{[\\s\\S]*?\\n {4}\\});`));
  assert.ok(match, `index.html 入面搵唔到 const ${name}`);
  return new Function(`return ${match[1]};`)();
}

test('有 slots 嘅裝備，分類同子tab 全部喺櫥櫃 tab 表入面', () => {
  // 冇呢條，locateItem 就會跳去一個唔存在嘅 subtab，個 grid 一片空白。
  // 2026-08-01 實測：15 個 category/subcategory 組合，零孤兒。
  const subtabs = loadObject('subtabsByCategory');
  const orphans = [...new Set(data.items
    .filter((item) => item.slots && item.slots.length)
    .filter((item) => !(subtabs[item.category] || []).includes(item.subcategory))
    .map((item) => `${item.category} / ${item.subcategory}`))];
  assert.deepEqual(orphans, []);
});

test('有 slots 嘅裝備冇一件係「角色」分類', () => {
  // renderGrid 一見 selectedCategory==='角色' 就轉去 renderCharacterGrid（另一個
  // grid、另一套分頁）。rail 上件件都有 slots，所以呢條路永遠唔應該撞到。
  const wrong = data.items.filter(
    (item) => item.slots && item.slots.length && item.category === '角色');
  assert.deepEqual(wrong.map((item) => item.name), []);
});
```

- [ ] **Step 2: 跑，確認綠**

Run: `npm test`
Expected: PASS。**如果呢兩條有一條紅，停手** —— 即係上游資料同 spec 第二節嘅前提唔同咗，返去改設計，唔好改測試遷就佢。

- [ ] **Step 3: Commit**

```bash
git add tests/reveal-item.test.mjs
git commit -m "Pin the data facts the jump relies on"
```

---

## Task 5: 抽 `syncCategoryTabs`

**Files:**
- Modify: `index.html:867-873`

- [ ] **Step 1: 加函數**

喺 `index.html` 分類 tab 嗰個 handler（`index.html:867`）之前插入：

```js
    // 分類 tab 嘅高亮。tab 自己撳同 revealItem 跳過嚟都要行呢支 ——
    // 唔抽出嚟嘅話，跳完之後櫥櫃出緊「飾品」但頂上亮住嘅仲係「服裝」。
    function syncCategoryTabs(){
      document.querySelectorAll('.category-tabs [data-category]').forEach(tab=>
        tab.classList.toggle('active',tab.dataset.category===selectedCategory));
    }
```

- [ ] **Step 2: handler 改用佢**

`index.html:871` 嗰行：

```js
      document.querySelectorAll('.category-tabs [data-category]').forEach(tab=>tab.classList.toggle('active',tab===button));
```

換成：

```js
      syncCategoryTabs();
```

（`selectedCategory` 喺上面兩行已經 set 咗做 `button.dataset.category`，所以行為一樣。）

- [ ] **Step 3: 瀏覽器驗**

喺 `http://127.0.0.1:8777/index.html` 逐個撳七個分類 tab，每次確認：撳嗰個變咗 active 樣，之前嗰個唔再 active。

Expected: 同改之前一樣。

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Extract the category tab highlight"
```

---

## Task 6: `revealItem` ＋ 閃燈

**Files:**
- Modify: `index.html`（`locateItem` 之後加 `revealItem`；CSS 加 `.revealed`）

- [ ] **Step 1: 加閃燈 CSS**

`index.html:45` 入面搵 `.item-card{cursor:pointer}`（喺 `.item-card,.empty-card{...}` 之後），
喺佢後面直接插：

```css
.item-card.revealed{animation:card-reveal 2s ease-out forwards}@keyframes card-reveal{0%,55%{box-shadow:0 0 0 2px #ffd33d,0 0 12px 3px rgba(255,211,61,.85),1px 2px 1px #bdc0c2,inset 0 0 0 1px #fff}100%{box-shadow:1px 2px 1px #bdc0c2,inset 0 0 0 1px #fff}}
```

用 `box-shadow` 唔用 `outline`：卡片有 `border-radius:10px`，`outline` 喺舊 WebKit 唔會跟圓角。
尾段個 `box-shadow` 就係 `.item-card` 原本嗰個（`1px 2px 1px #bdc0c2,inset 0 0 0 1px #fff`），
所以淡完之後同冇閃過一模一樣。

- [ ] **Step 2: 加 `revealItem`**

喺 `index.html` `locateItem` 收尾嗰行 `    }` 之後插入：

```js
    // 撳左欄嘅裝備格：右邊櫥櫃翻去嗰件嗰一版，卡片閃一閃。
    function revealItem(id){
      const item=itemById.get(id);
      if(!item)return;
      const spot=locateItem(items,item,{character:selectedCharacter,
        isBlocked:blockedForSelected,pageSize:PAGE_SIZE});
      if(!spot){
        // 換角色唔會清走 equipped，所以左欄可以正正常常著住一件新角色著唔到嘅裝備，
        // 而櫥櫃係濾走佢嘅 —— 根本冇一版有佢。呢個「唔郁」嘅決定要講返出嚟，
        // 否則同壞咗一模一樣（同 wearWholeSet 嗰句「呢套喺角色欄先生效」同一路數）。
        notify(`「${item.name}」${characters[selectedCharacter]?.name||'呢隻角色'}著唔到，櫥櫃唔會列出`);
        return;
      }
      // 搜尋係跨分類 filter，同分類瀏覽兩條唔同嘅分支、各有各嘅頁數。一律清走，
      // 行為先一致。輸入框同變數兩樣都要清，淨係清變數個框會留住舊字。
      equipmentSearch.value='';searchQuery='';
      selectedCategory=spot.category;selectedSubtab=spot.subtab;gridPage=spot.page;
      syncCategoryTabs();hideRailTooltip();
      // 唔使 renderAll —— 左欄、能力值、3D 模型全部冇變
      renderSubtabs();renderGrid();
      // 一定要喺 renderGrid 之後：佢成塊 grid.innerHTML 重建，早過佢加就會俾人洗走
      const card=grid.querySelector(`.item-card[data-id="${id}"]`);
      if(card)card.classList.add('revealed');
    }
```

- [ ] **Step 3: 喺 console 度試一次（rail 未掛掣）**

`http://127.0.0.1:8777/index.html` 開 DevTools console：

```js
revealItem(document.querySelector('#avatarRail .rail-slot.equipped')?.dataset.itemId)
```

（未著嘢就先喺櫥櫃度隨便撳「穿著」一件。）

Expected: 右邊櫥櫃翻到嗰件所在嗰版，卡片黃邊閃一閃、兩秒內自己淡走；頂上分類 tab
高亮跟住轉；子tab 亦都轉埋。

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add revealItem, which walks the wardrobe to an item"
```

---

## Task 7: rail 掛上去 ＋ 三個 case 實測

**Files:**
- Modify: `index.html:632-637`

- [ ] **Step 1: 掛 click ／ keydown**

`index.html:632-637` 而家係：

```js
      element.querySelectorAll('.rail-slot[data-slot-label]').forEach(slot=>{
        slot.addEventListener('mouseenter',()=>showRailTooltip(slot,target));
        slot.addEventListener('mouseleave',hideRailTooltip);
        slot.addEventListener('focus',()=>showRailTooltip(slot,target));
        slot.addEventListener('blur',hideRailTooltip);
      });
```

喺 `blur` 嗰行之後加兩個 listener：

```js
        // 空格冇 data-item-id，唔做嘢。被佔用嗰啲「×」格帶嘅係佔用嗰件嘅 id
        // （renderRail 出 markup 嗰陣已經係咁），所以會跳去佔用嗰件，同 tooltip 一致。
        slot.addEventListener('click',()=>{if(slot.dataset.itemId)revealItem(slot.dataset.itemId)});
        slot.addEventListener('keydown',event=>{
          if(!slot.dataset.itemId)return;
          if(event.key==='Enter'||event.key===' '){event.preventDefault();revealItem(slot.dataset.itemId)}
        });
```

- [ ] **Step 2: 正常情況**

`http://127.0.0.1:8777/index.html`：

1. 櫥櫃度隨便揀一套，撳「著晒成套」
2. 逐格撳左邊 Avatar 欄嗰啲已著格

Expected: 每次都跳到正確嘅分類／子tab／版，嗰張卡閃黃邊；rail tooltip 撳完收埋。
特別留意帽同鞋（`飾品/頭部`、`服裝/鞋子`）跳嘅係唔同分類。

- [ ] **Step 3: 搜尋狀態下撳**

搜尋框打「月光」→ 撳左欄任何一格。

Expected: 搜尋框**即刻變返空白**（唔係淨係結果變），櫥櫃返到分類瀏覽模式並跳到正確嗰版。

- [ ] **Step 4: 著唔到嗰隻角色**

⚠️ **唔可以用「換角色」整呢個狀態** —— `pickCharacter`（`index.html:888`）會
`equipped.avatar={};equipped.role={}` 清晒。要用分享 link：

```
http://127.0.0.1:8777/index.html?r=1#v=1&char=13&avatar=140946,140948,140950,140952,140954,140956,140958,140960&role=&view=avatar
```

（`char=13` 係阿貝爾，嗰 8 件係聖言小丑組合，佢一件都著唔到。個 `?r=1` 係必需嘅 ——
淨係改 hash 唔會 reload，`applySharedLoadout` 就唔會再跑。）

打開之後左欄會有 8 格著住，撳任何一格。

Expected: 出 toast「「XXX」YYY著唔到，櫥櫃唔會列出」，櫥櫃**乜都唔郁**（分類、版、搜尋全部維持原狀）。

- [ ] **Step 5: 空格同鍵盤**

1. 撳一個空嘅 rail 格 → 乜都唔應該發生
2. 用 Tab 掣行到一個已著格，撳 Enter → 跟 click 一樣跳
3. 撳 Space → 一樣跳，而且**版面唔會捲**（`preventDefault` 有效）

- [ ] **Step 6: 跑齊測試**

Run: `npm test`
Expected: PASS，全綠

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Jump to an item's wardrobe page when its rail slot is clicked"
```

- [ ] **Step 8: 熄咗個 server**

```bash
netstat -ano | grep ":8777" | head -2 | awk '{print $5}' | sort -u | while read p; do taskkill //PID $p //F; done
```

---

## 完工檢查

- [ ] `npm test` 全綠
- [ ] Task 7 Step 2-5 四個 case 全部親手行過
- [ ] `git log --oneline main..` 見到 7 個 commit，每個都自己企得住
- [ ] `git diff main --stat` 只掂到 `index.html` 同 `tests/reveal-item.test.mjs`
