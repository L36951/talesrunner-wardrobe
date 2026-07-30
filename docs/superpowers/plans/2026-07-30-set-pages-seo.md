# 套裝頁 SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 由 `data/items.json` 預先生成 1,978 個套裝靜態頁、兩個列表頁、一個索引頁同 sitemap，令 Google 索引到裝備內容。

**Architecture:** 純 Node build script（`scripts/build-seo.mjs`）讀 `data/items.json`，輸出靜態 HTML 落 repository 根目錄。邏輯拆成細模組放 `scripts/lib/`，每個一個責任、各自有測試。`index.html` 個 SPA 完全唔改動。

**Tech Stack:** Node 22（`node --test` 內建測試 runner，零 dependency）、ES modules（`.mjs`）、Vercel 靜態部署。

**Spec:** `docs/superpowers/specs/2026-07-30-set-pages-seo-design.md`

---

## 背景：新手需要知嘅嘢

呢個 repo 而家係**純靜態站**，冇 `package.json`、冇 build step、冇測試。整個網站係一個 69KB 嘅 `index.html`（HTML + CSS + JS 全部 inline）加 `data/items.json`（8.5MB）加 16,051 張 webp。

`data/items.json` 嘅結構：

```js
{
  items: [{
    id: "142397",              // 字串
    name: "20周年鍍金紀念推進器",
    slot: "booster",
    slots: ["booster"],
    subcategory: "助推器",
    category: "飾品",           // 服裝 | 飾品 | 寵物
    icon: "accbooster/all_accbooster_2247.webp",   // 相對 assets/itemimage/
    description: "...",
    stats: [["幸運 +20%", "green"], ["bonus EXP +20%", "blue"]],  // [文字, 顏色]
    blockedFor: [13, 14],      // 黑名單：呢啲角色編號著唔到
    wearGroup: 3,              // index 落 wearGroups；該 group 係白名單
    noVisualFor: 19,           // 著到但唔會變外觀
    sexLock: "F",              // 可選，"M" | "F"
    setId: "142405"            // 可選
  }],
  sets: {
    "1259": { name: "青花瓷套裝(男)", equipmentType: "role", stats: [["最高速度 +1","blue"]] }
  },
  characters: {
    "1": { name:"光光", icon:"character/cw_character_000.webp",
           stats:{speed:3,accel:3,power:3,control:3}, group:"跑者", sex:"M", order:0 }
  },
  wearGroups: [[1,2,3,...], ...],   // array of arrays，每個係角色編號白名單
  characterGroups: [...], noVisualGroups: [...], baseStatCap: 15, capRaisers: {}
}
```

要留意嘅陷阱：

- **`stats` 係預先格式化嘅字串**，唔係數字。`"幸運 +20%"` 咁樣。要加總就要 parse。
- **`wearGroups[n]` 係白名單**（呢啲角色先著到），**`blockedFor` 係黑名單**（呢啲角色著唔到）。兩者同時存在。
- **空 `wearGroup` 陣列 = 冇限制**，唔係「全世界都著唔到」。`index.html:200-203` 就係咁處理。
- `characters` 嘅 key 係字串（`"1"`），但 `wearGroups` 同 `blockedFor` 入面係數字。要 `Number()` 轉換。
- 圖片路徑：`index.html` 用相對路徑 `assets/itemimage/`。生成嘅頁喺 `/set/<slug>/` 之下，**必須用絕對路徑 `/assets/itemimage/`**。

---

## File Structure

**新增檔案：**

| 檔案 | 責任 |
|---|---|
| `package.json` | build／test script，令 Vercel 識行 build |
| `scripts/build-seo.mjs` | 總指揮：讀資料、叫各模組、寫檔、做 assertion |
| `scripts/lib/escape.mjs` | HTML escape |
| `scripts/lib/slug.mjs` | 套裝名 → URL slug／路徑 |
| `scripts/lib/catalog.mjs` | 建 setId→成員索引、套納入規則、輸出頁面清單 |
| `scripts/lib/stats.mjs` | parse stat 字串、加總 |
| `scripts/lib/wearable.mjs` | 邊個角色著到、揀試身角色 |
| `scripts/lib/related.mjs` | 相關套裝排序 |
| `scripts/lib/gender.mjs` | 男女對應版本配對 |
| `scripts/lib/deeplink.mjs` | 試身深連結 |
| `scripts/lib/render-set.mjs` | 一個套裝頁嘅 HTML |
| `scripts/lib/render-listing.mjs` | `/sets/` 索引頁同兩個列表頁 |
| `scripts/lib/sitemap.mjs` | sitemap XML |
| `tests/*.test.mjs` | 每個 lib 模組一個測試檔 |

**唔改嘅檔案：** `index.html`、`data/items.json`、`assets/**`。

**Build 產出（唔入 git）：** `set/**/index.html`、`sets/**/index.html`、`sitemap-sets.xml`、`sitemap-index.xml`。

---

### Task 1: 建立 build／測試骨架

**Files:**
- Create: `package.json`
- Create: `scripts/lib/escape.mjs`
- Test: `tests/escape.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/escape.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../scripts/lib/escape.mjs';

test('escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('leaves Chinese equipment names untouched', () => {
  assert.equal(escapeHtml('青花瓷套裝(男)'), '青花瓷套裝(男)');
});

test('coerces non-strings', () => {
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml(null), 'null');
});
```

- [ ] **Step 2: 建立 package.json**

```json
{
  "name": "talesrunner-wardrobe",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-seo.mjs",
    "test": "node --test tests/"
  }
}
```

`"type": "module"` 令 `.mjs` 同 `.js` 都當 ES module。`private: true` 防止誤 publish。

- [ ] **Step 3: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/escape.mjs'`

- [ ] **Step 4: 寫最小實作**

建立 `scripts/lib/escape.mjs`：

```js
const REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => REPLACEMENTS[character]);
}
```

- [ ] **Step 5: 行測試，確認通過**

Run: `npm test`
Expected: PASS，3 個 test 全綠

- [ ] **Step 6: 更新 .gitignore**

喺 `.gitignore` 尾加：

```
node_modules/
/set/
/sets/
sitemap-sets.xml
sitemap-index.xml
```

前置斜線好重要 —— `/set/` 只擋根目錄嗰個產出目錄，唔會誤擋其他路徑。

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/lib/escape.mjs tests/escape.test.mjs .gitignore
git commit -m "Add a build harness and HTML escaping"
```

---

### Task 2: URL slug

**Files:**
- Create: `scripts/lib/slug.mjs`
- Test: `tests/slug.test.mjs`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/slug.test.mjs`：

```js
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
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/slug.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/slug.mjs`：

```js
const SEPARATORS = /[（）()［］\[\]｛｝{}／/\\、，,\s]+/g;

export function toSlug(name) {
  return String(name)
    .replace(SEPARATORS, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function setPath(setId, name) {
  return `/set/${setId}-${toSlug(name)}`;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/slug.mjs tests/slug.test.mjs
git commit -m "Derive stable set URLs from id and name"
```

---

### Task 3: 目錄同納入規則

**Files:**
- Create: `scripts/lib/catalog.mjs`
- Test: `tests/catalog.test.mjs`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/catalog.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog, EXPECTED_PAGE_COUNT, MIN_MEMBERS } from '../scripts/lib/catalog.mjs';

const fixture = {
  sets: {
    '10': { name: '兩件套', equipmentType: 'role', stats: [['最高速度 +1', 'blue']] },
    '11': { name: '單件套', equipmentType: 'avatar', stats: [] },
    '12': { name: '零件套', equipmentType: 'role', stats: [] },
  },
  items: [
    { id: 'a', setId: '10', name: 'A', stats: [] },
    { id: 'b', setId: '10', name: 'B', stats: [] },
    { id: 'c', setId: '11', name: 'C', stats: [] },
  ],
};

test('drops sets with fewer than MIN_MEMBERS members', () => {
  const pages = buildCatalog(fixture);
  assert.equal(MIN_MEMBERS, 2);
  assert.deepEqual(pages.map((page) => page.setId), ['10']);
});

test('carries the definition and members onto the page descriptor', () => {
  const [page] = buildCatalog(fixture);
  assert.equal(page.name, '兩件套');
  assert.equal(page.equipmentType, 'role');
  assert.deepEqual(page.setStats, [['最高速度 +1', 'blue']]);
  assert.deepEqual(page.members.map((item) => item.id), ['a', 'b']);
});

test('orders pages by numeric set id so builds are reproducible', () => {
  const pages = buildCatalog({
    sets: {
      '100': { name: 'X', equipmentType: 'role', stats: [] },
      '20': { name: 'Y', equipmentType: 'role', stats: [] },
    },
    items: [
      { id: '1', setId: '100' }, { id: '2', setId: '100' },
      { id: '3', setId: '20' }, { id: '4', setId: '20' },
    ],
  });
  assert.deepEqual(pages.map((page) => page.setId), ['20', '100']);
});

test('the real catalogue produces exactly EXPECTED_PAGE_COUNT pages', () => {
  const data = JSON.parse(readFileSync('data/items.json', 'utf8'));
  assert.equal(buildCatalog(data).length, EXPECTED_PAGE_COUNT);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/catalog.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/catalog.mjs`：

```js
export const MIN_MEMBERS = 2;
export const EXPECTED_PAGE_COUNT = 1978;

export function buildCatalog(data) {
  const membersBySetId = new Map();
  for (const item of data.items) {
    if (item.setId == null || item.setId === '') continue;
    const bucket = membersBySetId.get(item.setId);
    if (bucket) bucket.push(item);
    else membersBySetId.set(item.setId, [item]);
  }

  const pages = [];
  for (const [setId, definition] of Object.entries(data.sets)) {
    const members = membersBySetId.get(setId) ?? [];
    if (members.length < MIN_MEMBERS) continue;
    pages.push({
      setId,
      name: definition.name,
      equipmentType: definition.equipmentType ?? 'role',
      setStats: definition.stats ?? [],
      members,
    });
  }

  pages.sort((a, b) => a.setId.localeCompare(b.setId, undefined, { numeric: true }));
  return pages;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS。最後一個 test 讀真實 `data/items.json`，會確認 1,978 呢個數。

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/catalog.mjs tests/catalog.test.mjs
git commit -m "Select which sets earn a page"
```

---

### Task 4: 能力值 parse 同加總

**Files:**
- Create: `scripts/lib/stats.mjs`
- Test: `tests/stats.test.mjs`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/stats.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatLine, summariseStats } from '../scripts/lib/stats.mjs';

test('parses a plain numeric stat', () => {
  assert.deepEqual(parseStatLine('最高速度 +1'),
    { name: '最高速度', value: 1, unit: '' });
});

test('parses a percentage stat', () => {
  assert.deepEqual(parseStatLine('幸運 +20%'),
    { name: '幸運', value: 20, unit: '%' });
});

test('parses a stat with no space before the sign', () => {
  assert.deepEqual(parseStatLine('推進力增加+20%'),
    { name: '推進力增加', value: 20, unit: '%' });
});

test('tolerates a trailing decimal point', () => {
  assert.deepEqual(parseStatLine('憤怒持續時間 +55.%'),
    { name: '憤怒持續時間', value: 55, unit: '%' });
});

test('parses negatives', () => {
  assert.deepEqual(parseStatLine('控制 -2'),
    { name: '控制', value: -2, unit: '' });
});

test('returns null for prose with no number', () => {
  assert.equal(parseStatLine('產生專屬腳印效果'), null);
  assert.equal(parseStatLine('★6月24日維護前'), null);
});

test('sums matching names and keeps units apart', () => {
  const { totals } = summariseStats([
    { stats: [['最高速度 +1', 'blue'], ['幸運 +20%', 'green']] },
    { stats: [['最高速度 +2', 'blue'], ['幸運 +5%', 'green']] },
  ]);
  assert.deepEqual(totals, [
    { name: '幸運', unit: '%', value: 25, colour: 'green' },
    { name: '最高速度', unit: '', value: 3, colour: 'blue' },
  ]);
});

test('rounds away floating point noise', () => {
  const { totals } = summariseStats([
    { stats: [['A +0.1', 'blue']] },
    { stats: [['A +0.2', 'blue']] },
  ]);
  assert.equal(totals[0].value, 0.3);
});

test('collects unparseable lines separately and de-duplicates them', () => {
  const { others } = summariseStats([
    { stats: [['產生專屬腳印效果', 'gold']] },
    { stats: [['產生專屬腳印效果', 'gold']] },
  ]);
  assert.deepEqual(others, [{ text: '產生專屬腳印效果', colour: 'gold' }]);
});

test('handles members with no stats at all', () => {
  const result = summariseStats([{ name: 'X' }, { stats: [] }]);
  assert.deepEqual(result, { totals: [], others: [] });
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/stats.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/stats.mjs`：

```js
// 尾隨小數點係真實資料入面出現過嘅（"+55.%"），所以小數部分容許空。
const STAT_LINE = /^(.+?)\s*([+-])\s*([0-9]+(?:\.[0-9]*)?)\s*(%?)$/;

export function parseStatLine(text) {
  const match = STAT_LINE.exec(String(text).trim());
  if (!match) return null;
  const [, rawName, sign, digits, unit] = match;
  const value = Number(digits.endsWith('.') ? digits.slice(0, -1) : digits);
  if (!Number.isFinite(value)) return null;
  const name = rawName.trim();
  if (!name) return null;
  return { name, value: sign === '-' ? -value : value, unit };
}

export function summariseStats(members) {
  const totals = new Map();
  const others = [];
  const seenOther = new Set();

  for (const member of members) {
    for (const [text, colour] of member.stats ?? []) {
      const parsed = parseStatLine(text);
      if (!parsed) {
        if (!seenOther.has(text)) {
          seenOther.add(text);
          others.push({ text, colour });
        }
        continue;
      }
      const key = `${parsed.name} ${parsed.unit}`;
      const entry = totals.get(key);
      if (entry) entry.value += parsed.value;
      else totals.set(key, { name: parsed.name, unit: parsed.unit, value: parsed.value, colour });
    }
  }

  const rounded = [...totals.values()].map((entry) => ({
    ...entry,
    value: Math.round(entry.value * 100) / 100,
  }));
  rounded.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return { totals: rounded, others };
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/stats.mjs tests/stats.test.mjs
git commit -m "Total a set's stats from its members' formatted strings"
```

---

### Task 5: 穿著限制

**Files:**
- Create: `scripts/lib/wearable.mjs`
- Test: `tests/wearable.test.mjs`

呢個模組要**完全複製** `index.html:197-210` `blockedForSelected()` 嘅邏輯。三重限制：
`wearGroup` 白名單、`sexLock` 性別鎖、`blockedFor` 黑名單。任何一項唔通過就著唔到。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/wearable.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { canWear, wearableCharacters, pickTryOnCharacter, DEFAULT_CHARACTER }
  from '../scripts/lib/wearable.mjs';

const data = {
  characters: {
    '1': { name: '光光', sex: 'M', order: 0 },
    '2': { name: '小美', sex: 'F', order: 1 },
    '3': { name: '阿寶', sex: 'M', order: 2 },
  },
  wearGroups: [
    [1, 2, 3],   // 0: 全部
    [2],         // 1: 淨係小美
    [],          // 2: 空 = 冇限制
  ],
};

test('an unrestricted item fits everyone', () => {
  assert.equal(canWear({}, '1', data), true);
});

test('wearGroup is a whitelist', () => {
  assert.equal(canWear({ wearGroup: 1 }, '2', data), true);
  assert.equal(canWear({ wearGroup: 1 }, '1', data), false);
});

test('an empty wearGroup means no restriction, not a total block', () => {
  assert.equal(canWear({ wearGroup: 2 }, '1', data), true);
});

test('sexLock rejects the other sex', () => {
  assert.equal(canWear({ sexLock: 'F' }, '2', data), true);
  assert.equal(canWear({ sexLock: 'F' }, '1', data), false);
});

test('blockedFor is a blacklist keyed by number', () => {
  assert.equal(canWear({ blockedFor: [3] }, '3', data), false);
  assert.equal(canWear({ blockedFor: [3] }, '1', data), true);
});

test('restrictions compose - any one failing blocks the item', () => {
  assert.equal(canWear({ wearGroup: 0, sexLock: 'M', blockedFor: [3] }, '1', data), true);
  assert.equal(canWear({ wearGroup: 0, sexLock: 'M', blockedFor: [3] }, '3', data), false);
});

test('wearableCharacters keeps only characters who can wear every member', () => {
  const members = [{ sexLock: 'M' }, { blockedFor: [3] }];
  assert.deepEqual(wearableCharacters(members, data), ['1']);
});

test('pickTryOnCharacter takes the lowest-order full match', () => {
  const members = [{ sexLock: 'F' }];
  assert.deepEqual(pickTryOnCharacter(members, data), { characterId: '2', complete: true });
});

test('pickTryOnCharacter falls back and flags an incomplete set', () => {
  const members = [{ sexLock: 'M' }, { sexLock: 'F' }];
  assert.deepEqual(pickTryOnCharacter(members, data),
    { characterId: DEFAULT_CHARACTER, complete: false });
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/wearable.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/wearable.mjs`：

```js
// 對應 index.html 嘅 DEFAULT_CHARACTER（光光）
export const DEFAULT_CHARACTER = '1';

// 完全跟隨 index.html:197-210 blockedForSelected() 嘅規則，只係反轉返正面講。
export function canWear(item, characterId, data) {
  const numericId = Number(characterId);

  if (item.wearGroup != null) {
    const group = data.wearGroups[item.wearGroup];
    // 空 group ＝資產度睇唔出限制，當冇限制
    if (group && group.length && !group.includes(numericId)) return false;
  }

  if (item.sexLock) {
    const sex = data.characters[characterId]?.sex;
    if (sex && sex !== item.sexLock) return false;
  }

  if (Array.isArray(item.blockedFor) && item.blockedFor.includes(numericId)) return false;

  return true;
}

function orderedCharacterIds(data) {
  return Object.keys(data.characters).sort(
    (a, b) => (data.characters[a].order ?? 0) - (data.characters[b].order ?? 0)
      || a.localeCompare(b, undefined, { numeric: true })
  );
}

export function wearableCharacters(members, data) {
  return orderedCharacterIds(data)
    .filter((id) => members.every((item) => canWear(item, id, data)));
}

export function pickTryOnCharacter(members, data) {
  const match = orderedCharacterIds(data)
    .find((id) => members.every((item) => canWear(item, id, data)));
  return match
    ? { characterId: match, complete: true }
    : { characterId: DEFAULT_CHARACTER, complete: false };
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/wearable.mjs tests/wearable.test.mjs
git commit -m "Work out which characters can wear a whole set"
```

---

### Task 6: 男女對應版本

**Files:**
- Create: `scripts/lib/gender.mjs`
- Test: `tests/gender.test.mjs`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/gender.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genderOf, stemOf, buildCounterpartIndex } from '../scripts/lib/gender.mjs';
import { buildCatalog } from '../scripts/lib/catalog.mjs';

test('reads the gender marker in either bracket style', () => {
  assert.equal(genderOf('青花瓷套裝(男)'), '男');
  assert.equal(genderOf('異世界（女）組合'), '女');
  assert.equal(genderOf('暗黑騎士套裝'), null);
});

test('strips the marker to get the shared stem', () => {
  assert.equal(stemOf('青花瓷套裝(男)'), '青花瓷套裝');
  assert.equal(stemOf('異世界（女）組合'), '異世界組合');
});

test('pairs the two sides and leaves singletons out', () => {
  const pages = [
    { setId: '1', name: 'A(男)' },
    { setId: '2', name: 'A(女)' },
    { setId: '3', name: 'B(男)' },
    { setId: '4', name: 'C' },
  ];
  const index = buildCounterpartIndex(pages);
  assert.equal(index.get('1').setId, '2');
  assert.equal(index.get('2').setId, '1');
  assert.equal(index.has('3'), false);
  assert.equal(index.has('4'), false);
});

test('ignores a stem that somehow has three or more sides', () => {
  const index = buildCounterpartIndex([
    { setId: '1', name: 'A(男)' },
    { setId: '2', name: 'A(女)' },
    { setId: '3', name: 'A(男)' },
  ]);
  assert.equal(index.size, 0);
});

test('the real catalogue yields 76 pairs, i.e. 152 linked pages', () => {
  const data = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const index = buildCounterpartIndex(buildCatalog(data));
  assert.equal(index.size, 152);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/gender.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/gender.mjs`：

```js
const MARKER = /[（(]([男女])[）)]/;
const MARKER_GLOBAL = /[（(][男女][）)]/g;

export function genderOf(name) {
  const match = MARKER.exec(String(name));
  return match ? match[1] : null;
}

export function stemOf(name) {
  return String(name).replace(MARKER_GLOBAL, '').trim();
}

export function buildCounterpartIndex(pages) {
  const byStem = new Map();
  for (const page of pages) {
    if (!genderOf(page.name)) continue;
    const stem = stemOf(page.name);
    const bucket = byStem.get(stem);
    if (bucket) bucket.push(page);
    else byStem.set(stem, [page]);
  }

  const index = new Map();
  for (const group of byStem.values()) {
    // 只處理乾淨嘅一男一女配對；其他情況寧願唔連，唔好連錯。
    if (group.length !== 2) continue;
    const genders = new Set(group.map((page) => genderOf(page.name)));
    if (genders.size !== 2) continue;
    index.set(group[0].setId, group[1]);
    index.set(group[1].setId, group[0]);
  }
  return index;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS，包括真實資料嗰個 152 嘅斷言

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/gender.mjs tests/gender.test.mjs
git commit -m "Pair each gendered set with its opposite number"
```

---

### Task 7: 相關套裝

**Files:**
- Create: `scripts/lib/related.mjs`
- Test: `tests/related.test.mjs`

排序規則（spec §3）：同 `equipmentType` 嘅候選，按（1）共用套裝效果條數多到少、
（2）成員件數差距細到大、（3）`setId` 細到大。第三層保證同一份 `items.json` 每次 build 結果一樣。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/related.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedSets, RELATED_LIMIT } from '../scripts/lib/related.mjs';

const page = (setId, equipmentType, statTexts, memberCount) => ({
  setId,
  equipmentType,
  setStats: statTexts.map((text) => [text, 'blue']),
  members: Array.from({ length: memberCount }, (_, i) => ({ id: `${setId}-${i}` })),
});

test('never returns the page itself or a different equipment type', () => {
  const target = page('1', 'role', ['S'], 3);
  const result = relatedSets(target, [target, page('2', 'avatar', ['S'], 3)]);
  assert.deepEqual(result, []);
});

test('ranks by shared stat lines first', () => {
  const target = page('1', 'role', ['A', 'B'], 3);
  const result = relatedSets(target, [
    target,
    page('2', 'role', ['A'], 3),
    page('3', 'role', ['A', 'B'], 9),
  ]);
  assert.deepEqual(result.map((p) => p.setId), ['3', '2']);
});

test('breaks a shared-stat tie on member-count distance', () => {
  const target = page('1', 'role', ['A'], 3);
  const result = relatedSets(target, [
    target,
    page('2', 'role', ['A'], 8),
    page('3', 'role', ['A'], 4),
  ]);
  assert.deepEqual(result.map((p) => p.setId), ['3', '2']);
});

test('breaks a full tie on numeric set id for reproducible builds', () => {
  const target = page('1', 'role', [], 3);
  const result = relatedSets(target, [
    target,
    page('30', 'role', [], 3),
    page('4', 'role', [], 3),
  ]);
  assert.deepEqual(result.map((p) => p.setId), ['4', '30']);
});

test('caps the list at RELATED_LIMIT', () => {
  const target = page('1', 'role', [], 3);
  const others = Array.from({ length: 20 }, (_, i) => page(`${i + 2}`, 'role', [], 3));
  assert.equal(relatedSets(target, [target, ...others]).length, RELATED_LIMIT);
  assert.equal(RELATED_LIMIT, 8);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/related.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/related.mjs`：

```js
export const RELATED_LIMIT = 8;

export function relatedSets(target, pages, limit = RELATED_LIMIT) {
  const targetStats = new Set((target.setStats ?? []).map(([text]) => text));

  return pages
    .filter((page) =>
      page.setId !== target.setId && page.equipmentType === target.equipmentType)
    .map((page) => ({
      page,
      shared: (page.setStats ?? []).filter(([text]) => targetStats.has(text)).length,
      sizeGap: Math.abs(page.members.length - target.members.length),
    }))
    .sort((a, b) =>
      b.shared - a.shared
      || a.sizeGap - b.sizeGap
      || a.page.setId.localeCompare(b.page.setId, undefined, { numeric: true }))
    .slice(0, limit)
    .map((entry) => entry.page);
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/related.mjs tests/related.test.mjs
git commit -m "Order related sets deterministically"
```

---

### Task 8: 試身深連結

**Files:**
- Create: `scripts/lib/deeplink.mjs`
- Test: `tests/deeplink.test.mjs`

格式同 `index.html:291-297` `buildShareUrl()` 一樣，唔加新機制。`equipmentType` 決定件數放
`avatar=` 定 `role=`，另一邊留空。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/deeplink.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTryOnUrl } from '../scripts/lib/deeplink.mjs';

const rolePage = {
  equipmentType: 'role',
  members: [{ id: '101' }, { id: '102' }],
};

test('puts role sets in the role slot and leaves avatar empty', () => {
  assert.equal(buildTryOnUrl(rolePage, '1'),
    '/#v=1&char=1&avatar=&role=101,102&view=role');
});

test('puts avatar sets in the avatar slot', () => {
  assert.equal(buildTryOnUrl({ ...rolePage, equipmentType: 'avatar' }, '7'),
    '/#v=1&char=7&avatar=101,102&role=&view=avatar');
});

test('keeps member order stable', () => {
  const url = buildTryOnUrl({ equipmentType: 'role', members: [{ id: 'b' }, { id: 'a' }] }, '1');
  assert.match(url, /role=b,a/);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/deeplink.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/deeplink.mjs`：

```js
// 對應 index.html:291-297 buildShareUrl() 嘅 hash 格式。
export function buildTryOnUrl(page, characterId) {
  const ids = page.members.map((item) => item.id).join(',');
  const layer = page.equipmentType === 'avatar' ? 'avatar' : 'role';
  const avatar = layer === 'avatar' ? ids : '';
  const role = layer === 'role' ? ids : '';
  return `/#v=1&char=${characterId}&avatar=${avatar}&role=${role}&view=${layer}`;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/deeplink.mjs tests/deeplink.test.mjs
git commit -m "Link set pages back into the wardrobe with the set worn"
```

---

### Task 9: 套裝頁 HTML

**Files:**
- Create: `scripts/lib/render-set.mjs`
- Test: `tests/render-set.test.mjs`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/render-set.test.mjs`：

```js
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
  assert.match(render(), /最高速度 \+1/);
});

test('falls back to explanatory copy when the set has no bonus', () => {
  const html = render({ page: { ...page, setStats: [] } });
  assert.match(html, /冇套裝效果/);
});

test('shows the summed member stats', () => {
  const html = render();
  assert.match(html, /加速度[^<]*\+2/);
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

test('a name containing a script tag cannot break out of the JSON-LD block', () => {
  const html = renderSetPage({
    page: { ...page, name: '</script><img onerror=alert(1)>' },
    data, related: [], counterpart: null,
  });
  const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g);
  assert.equal(blocks.length, 1);
  assert.doesNotMatch(html, /<img onerror/);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/render-set.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/render-set.mjs`：

```js
import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';
import { summariseStats } from './stats.mjs';
import { wearableCharacters, pickTryOnCharacter } from './wearable.mjs';
import { buildTryOnUrl } from './deeplink.mjs';

export const SITE_ORIGIN = 'https://talesrunner-wardrobe.kennylaisk.com';
const ICON_BASE = '/assets/itemimage/';

const statLine = ([text, colour]) =>
  `<li class="stat ${escapeHtml(colour)}">${escapeHtml(text)}</li>`;

const totalLine = (entry) =>
  `<li class="stat ${escapeHtml(entry.colour)}">${escapeHtml(entry.name)} `
  + `${entry.value >= 0 ? '+' : ''}${entry.value}${escapeHtml(entry.unit)}</li>`;

function memberCard(item) {
  const icon = item.icon
    ? `<img src="${ICON_BASE}${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}"`
      + ` width="54" height="54" loading="lazy">`
    : '';
  const stats = (item.stats ?? []).map(statLine).join('');
  return `<li class="member">${icon}<h3>${escapeHtml(item.name)}</h3>`
    + `<p class="slot">${escapeHtml(item.subcategory ?? '')}</p>`
    + (stats ? `<ul class="stats">${stats}</ul>` : '')
    + `</li>`;
}

function description(page, totals) {
  const bonus = page.setStats.length
    ? page.setStats.map(([text]) => text).join('、')
    : totals.slice(0, 3).map((entry) => `${entry.name} ${entry.value}${entry.unit}`).join('、');
  return `《跑Online》${page.name}：共 ${page.members.length} 件`
    + (bonus ? `，${bonus}` : '')
    + '。查看每件裝備能力值、可穿著角色，並一鍵試身。';
}

export function renderSetPage({ page, data, related, counterpart }) {
  const path = setPath(page.setId, page.name);
  const url = `${SITE_ORIGIN}${path}`;
  const { totals, others } = summariseStats(page.members);
  const wearers = wearableCharacters(page.members, data);
  const tryOn = pickTryOnCharacter(page.members, data);
  const title = `${page.name}｜套裝效果・能力值・可穿著角色 - 跑Online 配裝分享器`;
  const summary = description(page, totals);

  // JSON.stringify 唔會 escape "<"，所以一個叫 "</script>" 嘅裝備名可以標走個 script
  // block。目前 items.json 冇任何 "<" 或 ">"，但生成器唔可以繼承呢個假設。
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page.name,
    description: summary,
    url,
    numberOfItems: page.members.length,
    itemListElement: page.members.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
    })),
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(summary)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(summary)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${SITE_ORIGIN}/assets/og-image.jpg">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<nav><a href="/">跑Online 配裝分享器</a> › <a href="/sets/">套裝</a></nav>
<main>
<h1>${escapeHtml(page.name)}</h1>
<p class="lead">${escapeHtml(summary)}</p>

<p><a class="try-on" href="${escapeHtml(buildTryOnUrl(page, tryOn.characterId))}">立即試身</a>
${tryOn.complete ? '' : '<em>冇角色可以著齊呢套裝備</em>'}</p>

<section>
<h2>套裝效果</h2>
${page.setStats.length
    ? `<ul class="stats">${page.setStats.map(statLine).join('')}</ul>`
    : '<p>呢套裝備冇套裝效果，能力值淨係計每件裝備自己嘅數值。</p>'}
</section>

<section>
<h2>成員裝備（${page.members.length} 件）</h2>
<ul class="members">${page.members.map(memberCard).join('')}</ul>
</section>

<section>
<h2>著齊全套合計</h2>
${totals.length ? `<ul class="stats">${totals.map(totalLine).join('')}</ul>` : '<p>冇可加總嘅能力值。</p>'}
${others.length
    ? `<h3>其他效果</h3><ul class="stats">${others.map((o) => statLine([o.text, o.colour])).join('')}</ul>`
    : ''}
</section>

<section>
<h2>可穿著角色</h2>
${wearers.length
    ? `<p>${wearers.map((id) => escapeHtml(data.characters[id].name)).join('、')}</p>`
    : '<p>冇角色可以著齊呢套裝備。</p>'}
</section>

${counterpart
    ? `<section><h2>另一個版本</h2><p><a href="${escapeHtml(setPath(counterpart.setId, counterpart.name))}">${escapeHtml(counterpart.name)}</a></p></section>`
    : ''}

${related.length
    ? `<section><h2>相關套裝</h2><ul>${related.map((r) =>
        `<li><a href="${escapeHtml(setPath(r.setId, r.name))}">${escapeHtml(r.name)}</a></li>`).join('')}</ul></section>`
    : ''}
</main>
</body>
</html>
`;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS，14 個 test 全綠

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render-set.mjs tests/render-set.test.mjs
git commit -m "Render a set page with enough substance to index"
```

---

### Task 10: 索引頁同列表頁

**Files:**
- Create: `scripts/lib/render-listing.mjs`
- Test: `tests/render-listing.test.mjs`

結構：`/sets/`（索引）→ `/sets/role/`（1,164 個）同 `/sets/avatar/`（814 個）→ 套裝頁。
任何套裝頁距離首頁 3 下 click。**只按 `equipmentType` 分組** —— spec 有解釋點解唔按 `category`。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/render-listing.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHub, renderListing, LISTINGS } from '../scripts/lib/render-listing.mjs';

const pages = [
  { setId: '1', name: 'R一', equipmentType: 'role', members: [{}, {}] },
  { setId: '2', name: 'A一', equipmentType: 'avatar', members: [{}, {}] },
];

test('LISTINGS covers both equipment types', () => {
  assert.deepEqual(LISTINGS.map((l) => l.equipmentType), ['role', 'avatar']);
  assert.deepEqual(LISTINGS.map((l) => l.path), ['/sets/role', '/sets/avatar']);
});

test('the hub links to both listings with counts', () => {
  const html = renderHub(pages);
  assert.match(html, /href="\/sets\/role"/);
  assert.match(html, /href="\/sets\/avatar"/);
  assert.match(html, /1 個/);
});

test('a listing links every set of its own type and no others', () => {
  const html = renderListing(LISTINGS[0], pages);
  assert.match(html, /href="\/set\/1-R一"/);
  assert.doesNotMatch(html, /href="\/set\/2-A一"/);
});

test('a listing declares its own canonical', () => {
  assert.match(renderListing(LISTINGS[0], pages), /rel="canonical"[^>]*\/sets\/role"/);
});

test('escapes set names in listings', () => {
  const html = renderListing(LISTINGS[0],
    [{ setId: '1', name: '<b>x</b>', equipmentType: 'role', members: [{}, {}] }]);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/render-listing.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/render-listing.mjs`：

```js
import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';
import { SITE_ORIGIN } from './render-set.mjs';

export const LISTINGS = [
  { equipmentType: 'role', path: '/sets/role', label: '角色裝備套裝' },
  { equipmentType: 'avatar', path: '/sets/avatar', label: 'Avatar 套裝' },
];

function shell({ title, description, path, body }) {
  const url = `${SITE_ORIGIN}${path}`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${SITE_ORIGIN}/assets/og-image.jpg">
</head>
<body>
<nav><a href="/">跑Online 配裝分享器</a></nav>
<main>${body}</main>
</body>
</html>
`;
}

const countFor = (listing, pages) =>
  pages.filter((page) => page.equipmentType === listing.equipmentType).length;

export function renderHub(pages) {
  const cards = LISTINGS.map((listing) =>
    `<li><a href="${listing.path}">${escapeHtml(listing.label)}</a>`
    + `（${countFor(listing, pages)} 個）</li>`).join('');

  return shell({
    title: '《跑Online》套裝一覽｜套裝效果與能力值 - 跑Online 配裝分享器',
    description: `《跑Online》全部 ${pages.length} 套套裝，分角色裝備同 Avatar 兩類，`
      + '每套列出成員裝備、套裝效果同可穿著角色。',
    path: '/sets',
    body: `<h1>《跑Online》套裝一覽</h1>
<p>共 ${pages.length} 套。</p>
<ul>${cards}</ul>`,
  });
}

export function renderListing(listing, pages) {
  const mine = pages.filter((page) => page.equipmentType === listing.equipmentType);
  const items = mine.map((page) =>
    `<li><a href="${escapeHtml(setPath(page.setId, page.name))}">${escapeHtml(page.name)}</a>`
    + `（${page.members.length} 件）</li>`).join('');

  return shell({
    title: `${listing.label}一覽（${mine.length} 套）- 跑Online 配裝分享器`,
    description: `《跑Online》${listing.label}共 ${mine.length} 套，`
      + '每套列出成員裝備、套裝效果同可穿著角色。',
    path: listing.path,
    body: `<h1>${escapeHtml(listing.label)}</h1>
<p>共 ${mine.length} 套。</p>
<ul class="set-list">${items}</ul>`,
  });
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render-listing.mjs tests/render-listing.test.mjs
git commit -m "Give crawlers a path from the home page to every set"
```

---

### Task 11: Sitemap

**Files:**
- Create: `scripts/lib/sitemap.mjs`
- Test: `tests/sitemap.test.mjs`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/sitemap.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSitemap, renderSitemapIndex } from '../scripts/lib/sitemap.mjs';

test('wraps every URL in a loc element', () => {
  const xml = renderSitemap(['/a', '/b'], '2026-07-30');
  assert.match(xml, /<loc>https:\/\/talesrunner-wardrobe\.kennylaisk\.com\/a<\/loc>/);
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
});

test('stamps lastmod on each entry', () => {
  assert.match(renderSitemap(['/a'], '2026-07-30'), /<lastmod>2026-07-30<\/lastmod>/);
});

test('percent-encodes Chinese paths', () => {
  const xml = renderSitemap(['/set/1-青花瓷'], '2026-07-30');
  assert.match(xml, /%E9%9D%92/);
  assert.doesNotMatch(xml, /青花瓷/);
});

test('escapes ampersands so the XML stays well formed', () => {
  assert.doesNotMatch(renderSitemap(['/a?x=1&y=2'], '2026-07-30'), /&(?!amp;)/);
});

test('the index lists each child sitemap', () => {
  const xml = renderSitemapIndex(['/sitemap-sets.xml'], '2026-07-30');
  assert.match(xml, /<sitemapindex/);
  assert.match(xml, /sitemap-sets\.xml/);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/lib/sitemap.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/sitemap.mjs`：

```js
import { SITE_ORIGIN } from './render-set.mjs';

// encodeURI 處理中文，再手動轉 & —— XML 入面裸露嘅 & 係語法錯誤。
function absolute(path) {
  return `${SITE_ORIGIN}${encodeURI(path)}`.replace(/&/g, '&amp;');
}

export function renderSitemap(paths, lastmod) {
  const entries = paths.map((path) =>
    `  <url><loc>${absolute(path)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function renderSitemapIndex(paths, lastmod) {
  const entries = paths.map((path) =>
    `  <sitemap><loc>${absolute(path)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sitemap.mjs tests/sitemap.test.mjs
git commit -m "Emit sitemaps that survive Chinese paths"
```

---

### Task 12: 總指揮 script

**Files:**
- Create: `scripts/build-seo.mjs`
- Test: `tests/build-seo.test.mjs`

`assertEveryPageReachable` 係 spec 要求嘅檢查：每個套裝頁最少要有一條入邊連結。
列表頁必然連晒全部，所以正常情況一定通過 —— 佢係一個回歸防護，防止日後有人改咗
列表邏輯而唔為意有頁面變成孤島。同時報告有幾多頁**冇任何相關套裝入邊連結**，
呢個數字係內容質素信號（304 個冇套裝效果嘅套裝最易中招），報告出嚟但唔 fail build。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/build-seo.test.mjs`：

```js
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
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL，`Cannot find module '.../scripts/build-seo.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/build-seo.mjs`：

```js
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildCatalog, EXPECTED_PAGE_COUNT } from './lib/catalog.mjs';
import { buildCounterpartIndex } from './lib/gender.mjs';
import { relatedSets } from './lib/related.mjs';
import { setPath } from './lib/slug.mjs';
import { renderSetPage } from './lib/render-set.mjs';
import { renderHub, renderListing, LISTINGS } from './lib/render-listing.mjs';
import { renderSitemap, renderSitemapIndex } from './lib/sitemap.mjs';

export function collectLinkTargets(pages, relatedBySetId, counterparts) {
  const inbound = new Map(pages.map((page) => [page.setId, 1])); // 列表頁連晒全部
  for (const targets of relatedBySetId.values()) {
    for (const target of targets) {
      inbound.set(target.setId, (inbound.get(target.setId) ?? 0) + 1);
    }
  }
  for (const target of counterparts.values()) {
    inbound.set(target.setId, (inbound.get(target.setId) ?? 0) + 1);
  }
  return inbound;
}

export function assertEveryPageReachable(pages, inbound) {
  const orphans = pages.filter((page) => !(inbound.get(page.setId) > 0));
  if (orphans.length) {
    throw new Error(
      `${orphans.length} set page(s) have no inbound link: `
      + orphans.slice(0, 10).map((page) => page.setId).join(', '));
  }
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const data = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const pages = buildCatalog(data);

  if (pages.length !== EXPECTED_PAGE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PAGE_COUNT} set pages, got ${pages.length}. `
      + 'If data/items.json changed on purpose, update EXPECTED_PAGE_COUNT in '
      + 'scripts/lib/catalog.mjs and the figures in the spec.');
  }

  const counterparts = buildCounterpartIndex(pages);
  const relatedBySetId = new Map(
    pages.map((page) => [page.setId, relatedSets(page, pages)]));

  const inbound = collectLinkTargets(pages, relatedBySetId, counterparts);
  assertEveryPageReachable(pages, inbound);

  const withoutRelatedInbound = pages.filter((page) =>
    inbound.get(page.setId) === 1 && !counterparts.has(page.setId)).length;

  rmSync('set', { recursive: true, force: true });
  rmSync('sets', { recursive: true, force: true });

  for (const page of pages) {
    write(`.${setPath(page.setId, page.name)}/index.html`, renderSetPage({
      page,
      data,
      related: relatedBySetId.get(page.setId),
      counterpart: counterparts.get(page.setId) ?? null,
    }));
  }

  write('./sets/index.html', renderHub(pages));
  for (const listing of LISTINGS) {
    write(`.${listing.path}/index.html`, renderListing(listing, pages));
  }

  const paths = ['/sets', ...LISTINGS.map((l) => l.path),
    ...pages.map((page) => setPath(page.setId, page.name))];
  write('./sitemap-sets.xml', renderSitemap(paths, today));
  write('./sitemap-index.xml', renderSitemapIndex(['/sitemap-sets.xml'], today));

  console.log(`Built ${pages.length} set pages, ${LISTINGS.length} listings, 1 hub.`);
  console.log(`${withoutRelatedInbound} page(s) reachable only from their listing.`);
}

// 只有直接行呢個檔先執行 main()。測試 import 佢嗰陣唔可以觸發 build。
// 用 fileURLToPath 而唔係字串比對 —— Windows 路徑分隔符會令字串比對失敗。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

`build-seo.mjs` 個 import 區要有埋：

```js
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
```

（取代上面淨係 import `dirname` 嗰行。）

**Script 假設 cwd 係 repository 根目錄** —— 佢會 `rmSync('set')` 同 `rmSync('sets')`。
`npm run build` 一定喺根目錄行，但唔好喺其他地方手動行。

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 真正行一次 build**

Run: `npm run build`
Expected 輸出類似：

```
Built 1978 set pages, 2 listings, 1 hub.
N page(s) reachable only from their listing.
```

- [ ] **Step 6: 人手抽查產出**

```bash
ls set | head -3
node -e "console.log(require('fs').readFileSync('set/1259-青花瓷套裝-男/index.html','utf8').slice(0,600))"
grep -c "<url>" sitemap-sets.xml
```

Expected：`grep -c` 出 1981（1,978 個套裝 + 1 個 hub + 2 個列表頁）。
抽查嗰版 HTML 要見到 `<h1>青花瓷套裝(男)</h1>` 同 `src="/assets/itemimage/`。

- [ ] **Step 7: Commit**

```bash
git add scripts/build-seo.mjs tests/build-seo.test.mjs
git commit -m "Wire the generator together and refuse to ship orphan pages"
```

---

### Task 13: 首頁入口同部署驗證

**Files:**
- Modify: `index.html`（`<head>` 加一行，`<body>` 加一個連結）

首頁必須連去 `/sets/`，否則成個結構同首頁斷開，crawler 由首頁行唔到落去。

- [ ] **Step 1: 加 sitemap 同入口連結**

喺 `index.html` `<head>` 內、`<style>` 之前加：

```html
  <link rel="sitemap" type="application/xml" href="/sitemap-index.xml" />
```

喺 `index.html` 嘅 `</body>` 之前加一個唔影響版面嘅入口。個 SPA 用 `overflow:hidden`
同絕對定位，所以要用一個離開可視區但仍然畀 crawler 讀到嘅連結 —— **唔可以用
`display:none`**，Google 會忽略隱藏內容嘅連結：

```html
  <a href="/sets/" style="position:absolute;left:-9999px;top:auto">《跑Online》套裝一覽</a>
```

- [ ] **Step 2: 確認 SPA 冇壞**

Run: `npm run build && npx serve . -l 3000`（另開一個 terminal）
開 `http://localhost:3000/`，確認衣櫃照常載入、可以揀裝備、分享連結照舊。
再開 `http://localhost:3000/sets/`，確認見到兩個列表連結。
再開 `http://localhost:3000/set/1259-青花瓷套裝-男`，確認見到成員裝備同圖。

Expected：三版都正常，SPA 功能零改變。

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Point the home page at the set index"
```

- [ ] **Step 4: 開 PR，用 preview deployment 驗證**

```bash
git push -u origin <branch>
gh pr create --base main --title "Generate set pages for search" --body "..."
```

Vercel 會為 PR 起一個 preview。**呢一步係最重要嘅驗證** —— 因為加咗 `package.json`
之後 Vercel 會由「純靜態」變成「行 npm run build」，output directory 嘅判斷可能唔同。

喺 preview URL 上面確認：

- `/` 個 SPA 正常
- `/sets/` 載入到
- `/set/1259-青花瓷套裝-男` 載入到，圖片顯示到
- `/sitemap-sets.xml` 返回 XML
- `/google2085331cda3ef3a1.html` **仍然返回 200**（Search Console 驗證檔冇被 build 覆蓋或者路由改寫）

如果 output directory 出問題，喺 Vercel project settings 將 Output Directory 明確設做
`.`（根目錄），唔好加 `vercel.json` —— `vercel.json` 留返落一個 PR 處理 cache headers。

- [ ] **Step 5: 合併後交 sitemap**

Merge 之後等 production deploy 完，喺 Google Search Console「Sitemap」交
`sitemap-index.xml`。之後 4–8 星期睇索引率，按 spec §6 嘅門檻決定做唔做第二層。

---

## Self-Review

**Spec 覆蓋核對：**

| Spec 章節 | 對應 Task |
|---|---|
| §1 頁數同納入規則（1,978、assert） | Task 3、Task 12 |
| §1 男女變體各自一頁、互連、唔落 canonical | Task 6、Task 9 |
| §2 URL `/set/<id>-<slug>`、目錄結構避開 cleanUrls | Task 2、Task 12 |
| §3 每頁內容各區塊 | Task 9 |
| §3 相關套裝排序規則 | Task 7 |
| §3 能力值加總 parse 規則 | Task 4 |
| §3 圖片絕對路徑同 alt | Task 9 |
| §3 試身深連結、揀角色規則 | Task 5、Task 8 |
| §4 生成 script、HTML escape | Task 1、Task 12 |
| §5 sitemap 分層 | Task 11、Task 12 |
| §5 內部連結 ≤3 click、入邊連結檢查 | Task 10、Task 12、Task 13 |
| §6 成功指標 | Task 13 Step 5 |

**類型一致性核對：** `page` descriptor 嘅欄位（`setId`、`name`、`equipmentType`、`setStats`、
`members`）喺 Task 3 定義，Task 6/7/8/9/10/12 全部用同一組名。`SITE_ORIGIN` 喺
`render-set.mjs` 定義一次，`render-listing.mjs` 同 `sitemap.mjs` import 過去。
`DEFAULT_CHARACTER` 只喺 `wearable.mjs` 定義。

**已知取捨：**

- `EXPECTED_PAGE_COUNT` 係 hardcode 嘅 1978。呢個係刻意嘅 —— 佢嘅作用就係喺
  `items.json` 重新生成之後迫人手 review。錯誤訊息有寫明點更新。
- 列表頁一版有 1,164 條連結。大，但 directory 頁常見。如果 Search Console 顯示列表頁
  本身索引唔到，就要分拆，但分拆會加深 crawl 深度，所以唔好預先做。
