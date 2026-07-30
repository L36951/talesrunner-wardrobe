# 套裝頁 wiki 版面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將已上線嘅 1,978 個套裝頁由裸 HTML 改成 wiki 版面 —— 右側 infobox、能力值用表格、頁首導語段落 —— 並加一個共用 stylesheet。

**Architecture:** 導語同 infobox 各自抽做獨立模組（有自己嘅規則同邊界情況，值得獨立測試），`render-set.mjs` 保持做版面模板。樣式係一個手寫嘅 `assets/set-page.css`，唔經 build 生成。

**Tech Stack:** Node 22（`node --test`）、ES modules、零 npm 依賴、純靜態 HTML + CSS。

**Spec:** `docs/superpowers/specs/2026-07-30-set-page-wiki-design.md`
**已批准嘅視覺參考：** `docs/superpowers/specs/2026-07-30-set-page-wiki-mockup.html` ← **用瀏覽器打開佢，實作以佢為準**

---

## 你要知嘅背景

呢個 repo 已經有一套行緊嘅 build：`npm run build` 由 `data/items.json` 生成 1,978 個
套裝頁 + 3 個列表頁 + sitemap，6 秒完成，兩次跑出嚟 SHA-256 完全一樣。`npm test`
目前 **81 個全綠**。**呢啲頁面已經 deploy 咗上 production**，Google 可能已經開始爬。

已有嘅模組（唔好重寫，直接用）：

| 模組 | 你會用到嘅 export |
|---|---|
| `escape.mjs` | `escapeHtml(value)` —— 每個插值都要用 |
| `slug.mjs` | `setPath(setId, name)` → `/set/1259-青花瓷套裝-男` |
| `stats.mjs` | `summariseStats(members)` → `{totals, others}` |
| `wearable.mjs` | `wearableCharacters(members, data)` → 角色 id 陣列 |
| `wearable.mjs` | `pickTryOnCharacter(members, data)` → `{characterId, complete}` |
| `deeplink.mjs` | `buildTryOnUrl(page, characterId)` |
| `site.mjs` | `SITE_ORIGIN` |

頁面描述元（`page`）：

```js
{ setId: '1259', name: '青花瓷套裝(男)', equipmentType: 'role'|'avatar',
  setStats: [['最高速度 +1','blue']],   // 可以係空陣列（304 個套裝）
  members: [{ id, name, subcategory, icon, description, stats }] }  // 2–9 件
```

`summariseStats` 回傳嘅 `totals` 每項係 `{name, unit, value, colour}`，
`others` 每項係 `{text, colour}`。

**四條唔可以踩嘅底線**（前一份 spec 嘅硬要求，今次大改版面好易整跌）：

1. 剛好一個 `<link rel="canonical">`，而且指向自己 —— **唔可以指向男女對應版本**
2. 圖片用絕對路徑 `/assets/itemimage/`（頁面喺 `/set/<slug>/` 之下，相對路徑會爛）
3. JSON-LD 用 `.replace(/</g, '\\u003c')` 防標走，唔可以移除
4. 冇角色著得齊時要出提示

## File Structure

| 檔案 | 責任 |
|---|---|
| `scripts/lib/lead.mjs` | **新** — 生成導語段落純文字 |
| `scripts/lib/infobox.mjs` | **新** — 生成右側速查欄 HTML |
| `scripts/lib/render-set.mjs` | **改** — wiki 版面模板 |
| `scripts/lib/render-listing.mjs` | **改** — 加樣式連結、列表改多欄 |
| `assets/set-page.css` | **新** — 手寫樣式，commit 入 repo |
| `tests/lead.test.mjs` | **新** |
| `tests/infobox.test.mjs` | **新** |
| `tests/render-set.test.mjs` | **改** |
| `tests/render-listing.test.mjs` | **改** |

---

### Task 1: 導語段落

**Files:**
- Create: `scripts/lib/lead.mjs`
- Test: `tests/lead.test.mjs`

呢個係本次唯一新增嘅**文字內容**。每版多約 60–90 字完整句子；對最薄嗰批（目前 382 字）
係 +20%，而且散文對索引嘅幫助大過同等字數嘅散碎詞語。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/lead.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLead, LEAD_MEMBER_LIMIT } from '../scripts/lib/lead.mjs';

const page = (over = {}) => ({
  name: '青花瓷套裝(男)',
  equipmentType: 'role',
  setStats: [['最高速度 +1', 'blue']],
  members: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  ...over,
});

test('names the set, its kind, its size and its members', () => {
  assert.equal(buildLead(page(), 29),
    '青花瓷套裝(男) 係《跑Online》嘅角色裝備套裝，由 3 件裝備組成：A、B、C。'
    + '著齊全套會觸發套裝效果，共 29 個角色可以著齊。');
});

test('calls an avatar set an Avatar set', () => {
  assert.match(buildLead(page({ equipmentType: 'avatar' }), 5), /嘅Avatar套裝/);
});

test('says so when the set carries no bonus', () => {
  assert.match(buildLead(page({ setStats: [] }), 5), /呢套裝備冇套裝效果，/);
});

test('says so when nobody can wear the whole set', () => {
  assert.match(buildLead(page(), 0), /暫時冇角色可以著齊全套。$/);
});

test('truncates a long member list rather than reciting all nine', () => {
  const members = Array.from({ length: 9 }, (_, i) => ({ name: `件${i + 1}` }));
  const lead = buildLead(page({ members }), 3);
  assert.equal(LEAD_MEMBER_LIMIT, 6);
  assert.match(lead, /件1、件2、件3、件4、件5、件6 等 9 件。/);
  assert.doesNotMatch(lead, /件7/);
});

test('lists every member when at or under the limit', () => {
  const members = Array.from({ length: 6 }, (_, i) => ({ name: `件${i + 1}` }));
  assert.match(buildLead(page({ members }), 3), /件6。/);
  assert.doesNotMatch(buildLead(page({ members }), 3), /等 6 件/);
});

test('returns plain text, not HTML - escaping is the caller"s job', () => {
  const lead = buildLead(page({ name: '<b>x</b>' }), 1);
  assert.match(lead, /<b>x<\/b>/);
});
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/lib/lead.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/lead.mjs`：

```js
// 成員多過呢個數就唔逐個列，避免導語變成一條清單。
export const LEAD_MEMBER_LIMIT = 6;

export function buildLead(page, wearerCount) {
  const kind = page.equipmentType === 'avatar' ? 'Avatar' : '角色裝備';
  const names = page.members.map((item) => item.name);
  const shown = names.slice(0, LEAD_MEMBER_LIMIT).join('、');
  const listing = names.length > LEAD_MEMBER_LIMIT
    ? `${shown} 等 ${names.length} 件`
    : shown;

  const bonus = page.setStats.length
    ? '著齊全套會觸發套裝效果，'
    : '呢套裝備冇套裝效果，';

  const wearers = wearerCount > 0
    ? `共 ${wearerCount} 個角色可以著齊。`
    : '暫時冇角色可以著齊全套。';

  return `${page.name} 係《跑Online》嘅${kind}套裝，由 ${names.length} 件裝備組成：`
    + `${listing}。${bonus}${wearers}`;
}
```

回傳純文字，**唔做 escape** —— 呼叫方插入 HTML 之前先 escape，同其他模組一致。

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS，88 個（81 + 7）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/lead.mjs tests/lead.test.mjs
git commit -m "Open each set page with a sentence about the set"
```

---

### Task 2: Infobox

**Files:**
- Create: `scripts/lib/infobox.mjs`
- Test: `tests/infobox.test.mjs`

右側速查欄。抽做獨立模組因為佢有自己嘅資料對應（部位去重、可穿著比例），
唔應該塞入版面模板。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/infobox.test.mjs`：

```js
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
```

- [ ] **Step 2: 行測試，確認佢失敗**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/lib/infobox.mjs'`

- [ ] **Step 3: 寫實作**

建立 `scripts/lib/infobox.mjs`：

```js
import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';

const ICON_BASE = '/assets/itemimage/';

const row = (label, value) =>
  `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;

export function renderInfobox({ page, wearerCount, characterCount, counterpart, tryOnUrl }) {
  const kind = page.equipmentType === 'avatar' ? 'Avatar' : '角色裝備';

  const icons = page.members
    .filter((item) => item.icon)
    .map((item) =>
      `<img src="${ICON_BASE}${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}"`
      + ` width="48" height="48" loading="lazy">`)
    .join('');

  // 去重但保持成員次序 —— Set 會保留插入次序。
  const slots = [...new Set(page.members.map((item) => item.subcategory).filter(Boolean))]
    .map(escapeHtml).join('、');

  const bonus = page.setStats.length
    ? page.setStats
      .map(([text, colour]) => `<span class="${escapeHtml(colour)}">${escapeHtml(text)}</span>`)
      .join('<br>')
    : '<span class="empty">冇</span>';

  return `<aside class="infobox">
<div class="ib-title">${escapeHtml(page.name)}</div>
${icons ? `<div class="ib-imgs">${icons}</div>` : ''}
<table>
${row('類型', escapeHtml(kind))}
${row('件數', `${page.members.length} 件`)}
${slots ? row('部位', slots) : ''}
${row('套裝效果', bonus)}
${row('可穿著', `${wearerCount} / ${characterCount} 個角色`)}
${counterpart
    ? row('另一版本',
      `<a href="${escapeHtml(setPath(counterpart.setId, counterpart.name))}">`
      + `${escapeHtml(counterpart.name)}</a>`)
    : ''}
</table>
<div class="ib-cta"><a href="${escapeHtml(tryOnUrl)}">🔗 立即試身</a></div>
</aside>`;
}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS，98 個（88 + 10）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/infobox.mjs tests/infobox.test.mjs
git commit -m "Put the set's key facts in a box you can read at a glance"
```

---

### Task 3: 套裝頁改 wiki 版面

**Files:**
- Modify: `scripts/lib/render-set.mjs`
- Modify: `tests/render-set.test.mjs`

**呢個係最大嗰個 task。開住 `docs/superpowers/specs/2026-07-30-set-page-wiki-mockup.html`
做參考** —— 佢係已批准嘅設計，HTML 結構同 class 名以佢為準。

- [ ] **Step 1: 改測試**

`tests/render-set.test.mjs` 現有 17 個測試。**四個要改**（因為結構由 `<ul>` 變表格），
**四個一個字都唔准郁**（底線）。

改呢兩個：

```js
test('lists the set bonus', () => {
  const html = render();
  assert.match(html, /<table class="data">[\s\S]*最高速度[\s\S]*\+1[\s\S]*<\/table>/);
});

test('shows the summed member stats', () => {
  const html = render();
  assert.match(html, /著齊全套合計[\s\S]*加速度[\s\S]*\+2/);
});
```

加呢五個新測試：

```js
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
```

**唔准改嘅四個**（改咗就係退步）：`declares a canonical URL built from the set path`、
`uses absolute image paths so they survive the nested directory`、
`never emits a canonical pointing at the counterpart`、
`a name containing a script tag cannot break out of the JSON-LD block`。

- [ ] **Step 2: 行測試，確認新嗰啲失敗**

Run: `npm test`
Expected: FAIL — 新加嘅 5 個同改咗嘅 2 個失敗，其餘全部仍然通過

- [ ] **Step 3: 改實作**

`scripts/lib/render-set.mjs` —— 加 import：

```js
import { buildLead } from './lead.mjs';
import { renderInfobox } from './infobox.mjs';
```

用呢三個 helper 取代 `statLine` / `totalLine` / `memberCard`：

```js
const statRow = ([text, colour]) =>
  `<tr><td class="${escapeHtml(colour)}">${escapeHtml(text)}</td></tr>`;

const totalRow = (entry) =>
  `<tr><td>${escapeHtml(entry.name)}</td>`
  + `<td class="num ${escapeHtml(entry.colour)}">`
  + `${entry.value >= 0 ? '+' : ''}${entry.value}${escapeHtml(entry.unit)}</td></tr>`;

function memberRow(item) {
  const icon = item.icon
    ? `<td class="icon"><img src="${ICON_BASE}${escapeHtml(item.icon)}"`
      + ` alt="${escapeHtml(item.name)}" width="36" height="36" loading="lazy"></td>`
    : '<td class="icon"></td>';
  const stats = (item.stats ?? []).length
    ? (item.stats).map(([text, colour]) =>
      `<span class="${escapeHtml(colour)}">${escapeHtml(text)}</span>`).join('、')
    : '<span class="empty">—</span>';
  return `<tr>${icon}`
    + `<td><b>${escapeHtml(item.name)}</b>`
    + (item.description ? `<br><span class="mdesc">${escapeHtml(item.description)}</span>` : '')
    + `</td>`
    + `<td>${escapeHtml(item.subcategory ?? '')}</td>`
    + `<td class="mstats">${stats}</td></tr>`;
}
```

`statRow` 只有一欄（套裝效果冇獨立數值欄，原文已含數字）。

`renderSetPage` 內部，喺 `const summary = ...` 之後加：

```js
  const lead = buildLead(page, wearers.length);
  const infobox = renderInfobox({
    page,
    wearerCount: wearers.length,
    characterCount: Object.keys(data.characters).length,
    counterpart,
    tryOnUrl: buildTryOnUrl(page, tryOn.characterId),
  });
```

`<head>` 加一行（喺 JSON-LD 之前）：

```html
<link rel="stylesheet" href="/assets/set-page.css">
```

`<body>` 全部換成 wiki 結構：

```js
  return `<!doctype html>
<html lang="zh-Hant">
<head>
... (head 照舊，加咗 stylesheet 那行)
</head>
<body>
<div class="topbar"><div class="topbar-in">
<span class="brand"><a href="/">跑Online 配裝分享器</a></span>
<nav><a href="/sets">套裝一覽</a><a href="/sets/role">角色裝備</a><a href="/sets/avatar">Avatar</a></nav>
</div></div>
<div class="page">
<div class="crumb"><a href="/">首頁</a> › <a href="/sets">套裝</a> › ${escapeHtml(page.name)}</div>
<h1>${escapeHtml(page.name)}</h1>
<p class="subtitle">《跑Online》${page.equipmentType === 'avatar' ? 'Avatar' : '角色裝備'}套裝，共 ${page.members.length} 件</p>
<div class="layout">
<div class="main">
${counterpart
    ? `<p class="hatnote">本套裝有另一個版本：<a href="${escapeHtml(setPath(counterpart.setId, counterpart.name))}">${escapeHtml(counterpart.name)}</a>。兩者成員裝備完全不同。</p>`
    : ''}
<p class="lead">${escapeHtml(lead)}</p>
${tryOn.complete ? '' : '<p class="hatnote">冇角色可以著齊呢套裝備。</p>'}

<h2>套裝效果</h2>
${page.setStats.length
    ? `<table class="data"><tbody>${page.setStats.map(statRow).join('')}</tbody></table>`
    : '<p class="empty">呢套裝備冇套裝效果，能力值淨係計每件裝備自己嘅數值。</p>'}

<h2>成員裝備（${page.members.length} 件）</h2>
<div class="tablewrap"><table class="data">
<thead><tr><th colspan="2">裝備</th><th>部位</th><th>能力值</th></tr></thead>
<tbody>${page.members.map(memberRow).join('')}</tbody>
</table></div>

<h2>著齊全套合計</h2>
${totals.length
    ? `<div class="tablewrap"><table class="data"><thead><tr><th>能力值</th><th>合計</th></tr></thead>`
      + `<tbody>${totals.map(totalRow).join('')}</tbody></table></div>`
    : '<p class="empty">冇可加總嘅能力值。</p>'}
${others.length
    ? `<h3>其他效果</h3><p class="hint">以下項目無法加總，原文列出：</p>`
      + `<ul class="plain">${others.map((o) =>
        `<li class="${escapeHtml(o.colour)}">${escapeHtml(o.text)}</li>`).join('')}</ul>`
    : ''}

<h2>可穿著角色</h2>
${wearers.length
    ? `<p class="charlist">${wearers.map((id) => escapeHtml(data.characters[id].name)).join('、')}</p>`
    : '<p class="empty">冇角色可以著齊呢套裝備。</p>'}

${related.length
    ? `<h2>相關套裝</h2><ul class="tags">${related.map((r) =>
        `<li><a href="${escapeHtml(setPath(r.setId, r.name))}">${escapeHtml(r.name)}</a></li>`).join('')}</ul>`
    : ''}
</div>
${infobox}
</div>
</div>
</body>
</html>
`;
```

**注意**：`冇角色可以著齊` 出現喺兩處（hatnote 同「可穿著角色」區段）。呢個係刻意 ——
測試 `says so when no character can wear the whole set` 要求要有，而 hatnote 令佢
喺頂部就見到。

- [ ] **Step 4: 行測試，確認全部通過**

Run: `npm test`
Expected: PASS，103 個（98 + 5 新）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render-set.mjs tests/render-set.test.mjs
git commit -m "Lay the set pages out like a wiki article"
```

---

### Task 4: Stylesheet

**Files:**
- Create: `assets/set-page.css`

- [ ] **Step 1: 由 mockup 抽出樣式**

開 `docs/superpowers/specs/2026-07-30-set-page-wiki-mockup.html`，將 `<style>` 塊
內容複製入 `assets/set-page.css`，然後**剷走 `.note` 相關規則**（嗰啲淨係
mockup 用嚟做說明框，唔屬於真頁面）。

再加 mockup 冇但實作需要嘅三條：

```css
/* 表格喺窄螢幕可以橫向捲，唔好撐爆版面 */
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
/* 成員能力值格 */
.mstats{font-size:13.5px}
.mdesc{font-size:13px;color:#54595d}
/* 加總欄數字右對齊 */
table.data td.num{text-align:right;font-variant-numeric:tabular-nums;
  font-weight:600;white-space:nowrap}
.hint{font-size:14px;color:#54595d;margin:6px 0}
```

CSS 頂部保留 mockup 入面嗰段註釋，講明四隻能力值顏色對應 SPA 邊個值：

```css
/* stat 顏色：SPA（index.html）嗰四隻係為深色 tooltip 設計，喺淺底對比嚴重不足。
   以下係同色相加深版，對白底 ≥4.5:1。
   增益 #0f5f9e ← SPA #37c7ff  ／ 正面 #186f2a ← SPA #38ef4c
   負面 #b81f26 ← SPA #ff4545  ／ 特殊 #7d5600 ← SPA #ffe13c        */
```

- [ ] **Step 2: 確認唔會被 gitignore 擋**

Run: `git check-ignore -v assets/set-page.css`
Expected: 冇輸出（即係唔會被擋）。有輸出就停手報告。

- [ ] **Step 3: Build 並肉眼檢查**

```bash
npm run build
npx --yes serve . -l 4180
```

（`serve` 裝唔到就用 `python -m http.server 4180`。）

開 `http://localhost:4180/set/1259-青花瓷套裝-男`，同 mockup 並排比較。
再縮窄到 400px 闊，確認 infobox 跌咗上頂、表格可以捲。

- [ ] **Step 4: Commit**

```bash
git add assets/set-page.css
git commit -m "Style the set pages"
```

---

### Task 5: 列表頁

**Files:**
- Modify: `scripts/lib/render-listing.mjs`
- Modify: `tests/render-listing.test.mjs`

`/sets/role` 有 1,164 條連結，目前係一條單欄 `<ul>`，要碌好耐。

- [ ] **Step 1: 加測試**

`tests/render-listing.test.mjs` 加：

```js
test('links the shared stylesheet', () => {
  assert.match(renderHub(pages), /<link rel="stylesheet" href="\/assets\/set-page\.css">/);
  assert.match(renderListing(LISTINGS[0], pages),
    /<link rel="stylesheet" href="\/assets\/set-page\.css">/);
});

test('lays the set list out in columns', () => {
  assert.match(renderListing(LISTINGS[0], pages), /class="set-list"/);
});
```

現有 5 個測試一個都唔使改。

- [ ] **Step 2: 行測試，確認失敗**

Run: `npm test`
Expected: FAIL — `links the shared stylesheet` 失敗

- [ ] **Step 3: 改實作**

`scripts/lib/render-listing.mjs` 嘅 `shell()` 函數，喺 `<head>` 加一行
（`og:image` 之後）：

```html
<link rel="stylesheet" href="/assets/set-page.css">
```

`<body>` 改用同套裝頁一樣嘅外殼：

```js
<body>
<div class="topbar"><div class="topbar-in">
<span class="brand"><a href="/">跑Online 配裝分享器</a></span>
<nav><a href="/sets">套裝一覽</a><a href="/sets/role">角色裝備</a><a href="/sets/avatar">Avatar</a></nav>
</div></div>
<div class="page">${body}</div>
</body>
```

`assets/set-page.css` 加多欄樣式：

```css
.set-list{column-width:230px;column-gap:26px;list-style:none;margin:14px 0;padding:0}
.set-list li{break-inside:avoid;padding:3px 0;font-size:14.5px}
.set-list li a{display:inline}
```

- [ ] **Step 4: 行測試，確認通過**

Run: `npm test`
Expected: PASS，105 個（103 + 2）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render-listing.mjs tests/render-listing.test.mjs assets/set-page.css
git commit -m "Give the listings the same shell and columns"
```

---

### Task 6: 全量驗證

**Files:** 冇改動 —— 純驗證

呢個 task 存在嘅原因：**改嘅係已上線嘅 1,978 頁**，Google 可能已經爬過。
URL、標題、canonical 全部唔變，但要證明**文字內容只增不減**。

- [ ] **Step 1: 喺暫存目錄 build 一次舊版**

`git archive` 唔會掂 index 或者工作區，所以安全。**唔好喺呢個 worktree 度切 branch。**

```bash
tmp=$(mktemp -d)
git archive 3c7842a | tar -x -C "$tmp"
(cd "$tmp" && npm run build)
echo "舊版喺: $tmp"
```

- [ ] **Step 2: 對比每一版嘅純文字長度**

將以下 script 寫入 `$tmp/../compare.mjs`（即係 repo 外面），行完刪：

```js
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OLD = process.argv[2];   // 舊版 build 嘅根目錄
const NEW = process.argv[3];   // 新版（呢個 worktree）嘅根目錄

const textOf = (file) => readFileSync(file, 'utf8')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;|&#\d+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim().length;

const dirs = readdirSync(join(NEW, 'set'));
let shrunk = [], oldLens = [], newLens = [];
for (const d of dirs) {
  const a = join(OLD, 'set', d, 'index.html');
  const b = join(NEW, 'set', d, 'index.html');
  let oldLen;
  try { oldLen = textOf(a); } catch { continue; }   // 新增嘅版冇舊版
  const newLen = textOf(b);
  oldLens.push(oldLen); newLens.push(newLen);
  if (newLen < oldLen) shrunk.push(`${d}  ${oldLen} → ${newLen}`);
}
const stat = (xs) => { const s=[...xs].sort((a,b)=>a-b);
  return `min ${s[0]} / median ${s[Math.floor(s.length/2)]} / max ${s[s.length-1]}`; };

console.log('比對版數      :', oldLens.length);
console.log('舊版文字長度  :', stat(oldLens));
console.log('新版文字長度  :', stat(newLens));
console.log('文字縮水嘅版數:', shrunk.length);
shrunk.slice(0, 20).forEach((s) => console.log('   ✗', s));
```

行法：

```bash
node /path/to/compare.mjs "$tmp" "$PWD"
```

**預期「文字縮水嘅版數」係 0。** 任何一版縮水都要停手報告，唔好自己改 ——
改嘅係已上線內容，縮水即係退步。

- [ ] **Step 3: 確認四條底線仍然成立**

對全部 1,978 版檢查：

```
剛好一個 <link rel="canonical"> 且自我指向    預期 1978/1978
零個 src="assets/（相對路徑）                  預期 0
JSON-LD 全部 JSON.parse 得到                   預期 1978/1978
<link rel="stylesheet" href="/assets/set-page.css">  預期 1978/1978
```

- [ ] **Step 4: 確認 build 仍然可重現**

```bash
npm run build && find set sets -name index.html | sort | xargs sha256sum | sha256sum
npm run build && find set sets -name index.html | sort | xargs sha256sum | sha256sum
```

兩次輸出要一模一樣。

- [ ] **Step 5: 報告數字**

報告：改動前後嘅文字長度 min / median / max、頁面位元組總量、build 秒數、
`npm test` 總數。

---

## Self-Review

**Spec 覆蓋核對：**

| Spec 章節 | 對應 Task |
|---|---|
| §1 導語段落（模板、變數規則、6 件截斷） | Task 1 |
| §2 版面：infobox 內容 | Task 2 |
| §2 版面：表格、hatnote、目錄位置 | Task 3 |
| §3 CSS 外部檔、唔被 gitignore | Task 4 |
| §3 能力值淺底顏色 + 註明來源 | Task 4 |
| §4 響應式：820px 斷點、表格可捲、字級 | Task 4 |
| §5 列表頁多欄 | Task 5 |
| §6 對現有測試嘅影響、四條底線 | Task 3（改測試）、Task 6（全量驗證）|
| §7 風險：文字只增不減 | Task 6 |

**已知取捨：**

- **目錄（TOC）冇做。** Mockup 有，但每版得 5 個區段、桌面版一屏睇得晒，
  加咗反而推低正文。Spec §2 個圖有列出佢 —— 呢個係刻意唔做，唔係漏咗。
- `冇角色可以著齊` 喺兩處出現（hatnote + 區段）。刻意重複，令頂部即刻見到。
- 導語喺「有套裝效果但零人著得齊」時會讀落有少少矛盾（「會觸發套裝效果，暫時冇角色
  可以著齊全套」）。真實資料 0 個套裝中招，純防禦性，唔值得為佢加分支。
